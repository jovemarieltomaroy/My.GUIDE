const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  RESOURCE_TYPES,
  isResourceEligible,
  isStudentMaterial,
} = require("../services/resourceEligibility");
const Resource = require("../models/knowledgeResource");
const id = "012345678901234567890123";
const user = { _id: "counselor", role: "Counselor-User" };
const ready = {
  _id: id,
  title: "Fixture",
  processingStatus: "Ready",
  status: "Active",
  isActive: true,
};
const url = `/api/knowledge-base/${id}/pdf`;
function validator(getResource) {
  const context = {
    module: { exports: {} },
    require: (name) =>
      name === "../models/knowledgeResource"
        ? { findById: async () => getResource() }
        : require("../services/resourceEligibility"),
  };
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../services/knowledgeAttachments"), "utf8"),
    context
  );
  return context.module.exports.validateKnowledgeAttachments;
}
for (const type of RESOURCE_TYPES) {
  test(`Active ${type} supports RAG; student eligibility matches final classification`, () => {
    assert.equal(isResourceEligible({ ...ready, resourceType: type }), true);
    assert.equal(isStudentMaterial({ ...ready, resourceType: type }), type !== "reference");
  });
}
test("final types reject new legacy classifications but preserve existing records until reviewed", async () => {
  assert.deepEqual(RESOURCE_TYPES, ["reference", "worksheet", "handout"]);
  const record = new Resource({
    title: "Legacy",
    topic: "Stress",
    resourceType: "exercise",
    filePath: "/existing.pdf",
    originalFileName: "existing.pdf",
  });
  await assert.rejects(record.validate(), /Legacy types require review/);
  const legacy = Resource.hydrate({
    ...ready,
    title: "Legacy",
    topic: "Stress",
    resourceType: "exercise",
    filePath: "/existing.pdf",
    originalFileName: "existing.pdf",
  });
  await legacy.validate();
  assert.equal(legacy.filePath, "/existing.pdf");
  assert.equal(isResourceEligible(legacy), false);
  legacy.resourceType = "worksheet";
  await legacy.validate();
});
test("forged Reference IDs, Link labels, malformed IDs and direct PDF paths are rejected", async () => {
  const validate = validator(() => ({ ...ready, resourceType: "reference" }));
  await assert.rejects(validate([{ url, type: "PDF" }], user), /Reference PDFs cannot/);
  await assert.rejects(validate([{ url, type: "Link" }], user), /Reference PDFs cannot/);
  await assert.rejects(
    validate([{ url: "/api/knowledge-base/bad/pdf", type: "PDF" }], user),
    /Invalid/
  );
  await assert.rejects(
    validate([{ url: "/uploads/knowledge-resources/reference.pdf" }], user),
    /Invalid/
  );
  await assert.rejects(
    validate([{ resourceId: id, url: "/uploads/intervention-resources/forged.pdf" }], user),
    /protected/
  );
});
for (const type of ["worksheet", "handout"]) {
  test(`Active ${type} can be explicitly selected, but later review/obsolete status blocks sending`, async () => {
    let record = { ...ready, resourceType: type };
    const validate = validator(() => record);
    assert.equal((await validate([{ url }], user)).size, 1);
    for (const status of ["Under Review", "Obsolete"]) {
      record.status = status;
      await assert.rejects(validate([{ url }], user), /cannot be attached/);
    }
    record.status = "Active";
    await assert.rejects(
      validate([{ url }], { _id: "student", role: "Student" }),
      /Not authorized/
    );
  });
}
test("approved plan send rechecks eligibility and authorization before SMTP", async () => {
  const source = fs.readFileSync(require.resolve("../controllers/caseController"), "utf8");
  const code = source.slice(
    source.indexOf("const sendApprovedInterventionPlan ="),
    source.indexOf("const getArchivedCases =")
  );
  for (const variant of [
    "worksheet",
    "handout",
    "reference",
    "obsolete",
    "unapproved",
    "unassigned",
    "changed-before-send",
  ]) {
    let record = {
      ...ready,
      resourceType:
        variant === "handout" ? "handout" : variant === "reference" ? "reference" : "worksheet",
      status: variant === "obsolete" ? "Obsolete" : "Active",
    };
    const validate = validator(() => record);
    const plan = {
      _id: "plan",
      approvalStatus: variant === "unapproved" ? "Pending Review" : "Approved",
      problem: "Stress",
      planOfAction: "Review worksheet",
      resources: [{ url, type: "PDF", title: "Worksheet" }],
    };
    const plans = [plan];
    plans.id = () => plan;
    const foundCase = {
      _id: "case",
      caseStatus: "Open",
      assignedCounselor: variant === "unassigned" ? "other" : "counselor",
      student: { email: "student@example.test", firstName: "Fixture" },
      interventionPlans: plans,
      actionHistory: [],
      async save() {},
    };
    let sends = 0;
    const chain = {
      populate() {
        return this;
      },
      then(resolve) {
        return Promise.resolve(foundCase).then(resolve);
      },
    };
    const context = {
      module: { exports: {} },
      console,
      process,
      AsyncHandler: (fn) => fn,
      Case: { findById: () => chain, exists: async () => variant !== "changed-before-send" },
      resolveInterventionAttachments: async (resources, { user }) => {
        await validate(resources, user);
        return [{ filename: "fixture.pdf", path: "/fixture.pdf", resource: resources[0] }];
      },
      validateKnowledgeAttachments: validate,
      transporter: {
        sendMail: async () => {
          sends++;
        },
      },
    };
    vm.runInNewContext(code + "\nmodule.exports = sendApprovedInterventionPlan;", context);
    const res = {
      status(code) {
        this.code = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    await context.module.exports({ params: { id: "case", planId: "plan" }, user }, res);
    assert.equal(sends, ["worksheet", "handout"].includes(variant) ? 1 : 0, variant);
    assert.equal(
      res.code,
      ["worksheet", "handout"].includes(variant)
        ? 200
        : ["unassigned", "changed-before-send"].includes(variant)
          ? 403
          : 400,
      variant
    );
  }
});
test("counselor uploaded case PDFs are preserved; unrelated local paths are blocked", async () => {
  const filePath = path.resolve("uploads/intervention-resources/test-fixture.pdf");
  const uploadUrl = "/uploads/intervention-resources/test-fixture.pdf";
  const context = {
    module: { exports: {} },
    process,
    require: (name) => {
      if (name === "./knowledgeAttachments")
        return { validateKnowledgeAttachments: validator(() => null) };
      if (name === "node:fs/promises")
        return {
          stat: async () => ({ isFile: () => true }),
          access: async () => {},
          constants: { R_OK: 4 },
        };
      return require(name);
    },
  };
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../services/interventionAttachments"), "utf8"),
    context
  );
  const resolve = context.module.exports.resolveInterventionAttachments;
  const [attachment] = await resolve([{ url: uploadUrl, title: "Case PDF" }], {
    user,
    allowedUploadUrls: [uploadUrl],
  });
  assert.equal(attachment.path, filePath);
  await assert.rejects(resolve([{ url: uploadUrl }], { user }), /unavailable/);
});
