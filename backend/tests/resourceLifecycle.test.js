const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { isResourceEligible, isStudentMaterial } = require("../services/resourceEligibility");
const { readMetadata } = require("../services/resourceLifecycle");
const id = "012345678901234567890123";
const active = {
  _id: id,
  title: "Reference",
  topic: "Stress",
  resourceType: "reference",
  processingStatus: "Ready",
  isActive: true,
};
const chunk = {
  _id: "chunk",
  score: 0.9,
  content: "Grounded guidance",
  metadata: { resourceId: id, resourceType: "reference", approvalStatus: "approved" },
};
function retrievalContext(getResource) {
  const context = {
    module: { exports: {} },
    require: (name) => {
      if (name === "../../models/knowledgeResource")
        return { find: () => ({ lean: async () => getResource() }) };
      if (name === "../../models/knowledgeChunk") return { aggregate: async () => [chunk] };
      if (name === "../resourceEligibility") return require("../services/resourceEligibility");
      if (name === "./embeddingService") return { generateEmbedding: async () => [0, 1] };
      throw new Error(name);
    },
    process,
  };
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../services/rag/retrievalService"), "utf8"),
    context
  );
  return context.module.exports;
}
test("legacy resources default Active without overriding disabled, failed or replaced records", () => {
  assert.equal(isResourceEligible(active), true);
  for (const override of [
    { status: "Under Review" },
    { status: "Obsolete" },
    { isActive: false },
    { processingStatus: "Failed" },
    { processingStatus: "Processing" },
    { replacedBy: id },
  ])
    assert.equal(isResourceEligible({ ...active, ...override }), false);
  assert.equal(isStudentMaterial({ ...active, status: "Active" }), false);
  assert.equal(isStudentMaterial({ ...active, resourceType: "worksheet" }), true);
});
test("retrieval rechecks authoritative lifecycle status and restores eligibility on reactivation", async () => {
  let resource = { ...active };
  const { retrieveRelevantChunks } = retrievalContext(() => [resource]);
  assert.equal((await retrieveRelevantChunks("stress")).length, 1);
  for (const status of ["Obsolete", "Under Review"]) {
    resource.status = status;
    assert.equal((await retrieveRelevantChunks("stress")).length, 0);
  }
  resource.status = "Active";
  assert.equal((await retrieveRelevantChunks("stress")).length, 1);
  resource.isActive = false;
  assert.equal((await retrieveRelevantChunks("stress")).length, 0);
});
test("retrieval excludes orphaned and unapproved passages and uses current parent metadata", async () => {
  const { filterEligibleChunks } = retrievalContext(() => [
    { ...active, title: "Updated title", resourceType: "handout" },
  ]);
  assert.equal(
    (
      await filterEligibleChunks([
        { ...chunk, metadata: { ...chunk.metadata, approvalStatus: "rejected" } },
      ])
    ).length,
    0
  );
  assert.equal(
    (
      await filterEligibleChunks([
        { ...chunk, metadata: { ...chunk.metadata, resourceId: "unknown" } },
      ])
    ).length,
    0
  );
  const [result] = await filterEligibleChunks([chunk]);
  assert.equal(result.metadata.title, "Updated title");
  assert.equal(result.metadata.resourceType, "handout");
});
test("metadata validation retains existing types and rejects invalid status, year and blank required fields", () => {
  assert.equal(readMetadata({ status: "Obsolete" }, active).status, "Obsolete");
  assert.equal(readMetadata({ publicationYear: "2026" }, active).publicationYear, 2026);
  for (const body of [
    { status: "approved" },
    { publicationYear: "twenty" },
    { title: " " },
    { resourceType: "unknown" },
  ])
    assert.throws(() => readMetadata(body, active));
  assert.equal(
    readMetadata({ resourceType: "legacy" }, { ...active, resourceType: "legacy" }).resourceType,
    undefined
  );
});
function controllerContext({
  resource = active,
  ingest = async () => {
    throw Error("Processing failed");
  },
} = {}) {
  let processingCalls = 0;
  const store = { ...resource, statusHistory: [], updatedAt: new Date(), async save() {} };
  const model = {
    findById: async () => store,
    create: async (data) => ({ ...data, _id: id, async save() {} }),
    findOneAndUpdate: async (query, change) => {
      Object.assign(store, change.$set);
      return store;
    },
    updateOne: async () => ({ modifiedCount: 1 }),
  };
  const context = {
    module: { exports: {} },
    console: { error() {}, warn() {} },
    process,
    require: (name) => {
      if (name === "../models/knowledgeResource") return model;
      if (name === "../models/knowledgeChunk")
        return { deleteMany: async () => ({ deletedCount: 0 }) };
      if (name === "../models/case") return {};
      if (name === "../services/resourceEligibility")
        return require("../services/resourceEligibility");
      if (name === "../services/resourceLifecycle") return require("../services/resourceLifecycle");
      if (name === "../services/rag/knowledgeIngestionService")
        return {
          ingestKnowledgeResource: async (...args) => {
            processingCalls++;
            return ingest(...args);
          },
        };
      if (name === "fs/promises") return { unlink: async () => {} };
      return require(name);
    },
  };
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../controllers/knowledgeBaseController"), "utf8"),
    context
  );
  return {
    ...context.module.exports,
    store,
    get processingCalls() {
      return processingCalls;
    },
  };
}
const response = () => ({
  status(code) {
    this.code = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});
test("metadata/status-only edits never call ingestion and retain the original PDF", async () => {
  const controller = controllerContext({ resource: { ...active, filePath: "/original.pdf" } });
  const res = response();
  await controller.updateKnowledgeResource(
    { params: { id }, body: { status: "Obsolete" }, user: { _id: id } },
    res
  );
  assert.equal(res.body.success, true);
  assert.equal(controller.store.status, "Obsolete");
  assert.equal(controller.store.filePath, "/original.pdf");
  assert.equal(controller.processingCalls, 0);
});
test("failed replacement leaves the original active and available", async () => {
  const controller = controllerContext();
  const res = response();
  await controller.uploadKnowledgeResource(
    {
      params: { id },
      body: { title: "Replacement", topic: "Stress", resourceType: "reference", status: "Active" },
      user: { _id: id },
      file: {
        originalname: "new.pdf",
        filename: "new.pdf",
        path: "/new.pdf",
        mimetype: "application/pdf",
      },
    },
    res
  );
  assert.equal(res.code, 500);
  assert.equal(controller.processingCalls, 1);
  assert.equal(controller.store.status, undefined);
  assert.equal(isResourceEligible(controller.store), true);
});
test("replacement and status edits reject a resource already being processed", async () => {
  const controller = controllerContext({ resource: { ...active, processingStatus: "Processing" } });
  const res = response();
  await controller.updateKnowledgeResource(
    { params: { id }, body: { status: "Obsolete" }, user: { _id: id } },
    res
  );
  assert.equal(res.code, 409);
});
test("management routes enforce the existing admin guard", () => {
  const calls = [];
  const handler = () => {};
  const protect = () => {},
    adminOnly = () => {};
  const context = {
    module: { exports: {} },
    require: (name) => {
      if (name === "express")
        return {
          Router: () =>
            Object.fromEntries(
              ["get", "post", "patch", "delete"].map((method) => [
                method,
                (...args) => calls.push([method, ...args]),
              ])
            ),
        };
      if (name.includes("authValidator")) return { protect, adminOnly };
      if (name.includes("uploadKnowledgeResource")) return { single: () => handler };
      return new Proxy({}, { get: () => handler });
    },
  };
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../routes/knowledgeBaseRoutes"), "utf8"),
    context
  );
  for (const call of calls.filter((item) => ["post", "patch", "delete"].includes(item[0]))) {
    assert.equal(call[2], protect);
    assert.equal(call[3], adminOnly);
  }
});

test("replacement activation saves both versions in the same transaction and preserves both files", async () => {
  const saved = [];
  const session = {};
  const old = {
    ...active,
    filePath: "/old.pdf",
    statusHistory: [],
    async save(options) {
      saved.push(["old", options.session]);
    },
  };
  const replacement = {
    ...active,
    _id: "112345678901234567890123",
    filePath: "/new.pdf",
    replaces: id,
    status: "Under Review",
    totalChunks: 2,
    statusHistory: [],
    async save(options) {
      saved.push(["new", options.session]);
    },
  };
  const context = {
    module: { exports: {} },
    require: (name) => {
      if (name === "mongoose") return require("mongoose");
      if (name === "./resourceEligibility") return require("../services/resourceEligibility");
      if (name === "../models/knowledgeResource")
        return {
          db: { transaction: async (callback) => callback(session) },
          findOne: () => ({ session: async () => old }),
        };
      throw Error(name);
    },
  };
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../services/resourceLifecycle"), "utf8"),
    context
  );
  await context.module.exports.activateReplacement(replacement, id);
  assert.equal(replacement.status, "Active");
  assert.equal(old.status, "Obsolete");
  assert.equal(String(old.replacedBy), replacement._id);
  assert.equal(old.filePath, "/old.pdf");
  assert.equal(replacement.filePath, "/new.pdf");
  assert.equal(saved.length, 2);
  assert.ok(saved.every(([, actual]) => actual === session));
  replacement.processingStatus = "Failed";
  old.replacedBy = null;
  saved.length = 0;
  await assert.rejects(context.module.exports.activateReplacement(replacement, id), /not ready/);
  assert.equal(saved.length, 0);
});

test("generation rechecks eligibility before creating a prompt and rejects mid-generation status changes", async () => {
  for (const changeDuringGeneration of [false, true]) {
    let filterCalls = 0,
      modelCalls = 0,
      promptCalls = 0;
    const context = {
      module: { exports: {} },
      console,
      require: (name) => {
        if (name === "./recommendationOutputValidation") return require("../services/rag/recommendationOutputValidation");
        if (name === "./evidenceReviewService") return require("../services/rag/evidenceReviewService");
        if (name === "./retrievalService")
          return {
            retrieveInterventionMaterials: async () => [chunk],
            filterEligibleChunks: async () => {
              filterCalls++;
              return changeDuringGeneration && filterCalls === 1 ? [chunk] : [];
            },
          };
        if (name === "./promptBuilderService")
          return {
            buildInterventionPrompt: () => {
              promptCalls++;
              return "Grounded prompt";
            },
          };
        if (name === "../llm/ollamaService")
          return {
            generateResponse: async () => {
              modelCalls++;
              return "{}";
            },
          };
        throw Error(name);
      },
    };
    vm.runInNewContext(
      fs.readFileSync(require.resolve("../services/rag/interventionRecommendationService"), "utf8"),
      context
    );
    const result = await context.module.exports.generateInterventionRecommendations({
      currentPresentation: "Stress",
    });
    assert.equal(result.status, "insufficient_reference_material");
    assert.equal(modelCalls, changeDuringGeneration ? 1 : 0);
    assert.equal(promptCalls, changeDuringGeneration ? 1 : 0);
    assert.equal(result.recommendations.length, 0);
  }
});

test("updated retrieval searches next steps separately and limits repeated chunks without excluding prior resources", async () => {
  const otherId = "112345678901234567890123";
  const queries = [];
  const resources = [active, { ...active, _id: otherId, title: "Task steps", resourceType: "handout" }];
  const make = (key, resourceId) => ({ ...chunk, _id: key, metadata: { ...chunk.metadata, resourceId } });
  const context = { module: { exports: {} }, process, require(name) {
    if (name === "../../models/knowledgeResource") return { find: () => ({ lean: async () => resources }) };
    if (name === "../../models/knowledgeChunk") return { aggregate: async (pipeline) => pipeline[0].$vectorSearch.queryVector[0] === 1
      ? [make("task", otherId), make("old1", id), make("old2", id), make("old3", id)]
      : [make("old1", id), make("old2", id), make("old3", id)] };
    if (name === "../resourceEligibility") return require("../services/resourceEligibility");
    if (name === "./embeddingService") return { generateEmbedding: async (query) => { queries.push(query); return [query === "next steps" ? 1 : 0, 0]; } };
    throw Error(name);
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve("../services/rag/retrievalService"), "utf8"), context);
  const results = await context.module.exports.retrieveInterventionMaterials("current difficulties", { targetedQuery: "next steps" });
  assert.deepEqual(queries, ["next steps", "current difficulties"]);
  assert.equal(results[0].metadata.title, "Task steps");
  assert.equal(results.filter(item => item.metadata.resourceId === id).length, 2);
  assert.equal(new Set(results.map(item => item._id)).size, results.length);
});
