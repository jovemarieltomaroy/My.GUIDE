const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const {
  collectSuggestedMaterials,
  selectSuggestedMaterials,
} = require("../services/suggestedMaterials");
const id = "012345678901234567890123";
const suggestion = {
  resourceId: id,
  title: "Academic Stress Check-In",
  resourceType: "worksheet",
  pageNumber: 1,
};
test("suggestions retain the actual selected PDF and intervention association without attaching it", () => {
  const result = collectSuggestedMaterials([
    {
      intervention: "Academic Stress Identification and Management",
      supportingResource: suggestion,
    },
    { intervention: "Review stress", supportingResource: suggestion },
    { intervention: "Theory", supportingResource: { ...suggestion, resourceType: "reference" } },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Academic Stress Check-In");
  assert.equal(result[0].interventions.length, 2);
  assert.equal(result[0].url, `/api/knowledge-base/${id}/pdf`);
  assert.equal(selectSuggestedMaterials({ suggestedMaterials: result }).length, 0);
  assert.equal(selectSuggestedMaterials({ suggestedMaterials: result }, [id, id]).length, 1);
  assert.throws(
    () => selectSuggestedMaterials({ suggestedMaterials: result }, ["112345678901234567890123"]),
    /not suggested/
  );
  assert.throws(() => selectSuggestedMaterials({}, "bad"), /valid/);
});
test("acceptance copies only explicitly selected suggestions and retains plan approval requirements", async () => {
  const source = fs.readFileSync(require.resolve("../controllers/caseController"), "utf8");
  const start = source.indexOf("const acceptLLMRecommendation =");
  const code = source.slice(start, source.indexOf("const rejectLLMRecommendation =", start));
  for (const mode of ["none", "selected", "obsolete", "unauthorized", "forged"]) {
    const recommendation = {
      _id: "recommendation",
      status: "Draft",
      goal: "Review stress",
      planOfAction: "Complete a check-in",
      suggestedMaterials: [suggestion],
      resources: [],
    };
    const recs = [recommendation];
    recs.id = () => recommendation;
    const record = {
      _id: "case",
      caseStatus: "Open",
      interventionPlans: [],
      llmRecommendations: recs,
      actionHistory: [],
      async save() {},
    };
    let validations = 0;
    const context = {
      module: { exports: {} },
      AsyncHandler: (fn) => fn,
      selectSuggestedMaterials,
      Case: { findById: async () => record },
      canManageRecommendations: () => mode !== "unauthorized",
      populateRecommendationCase: async () => record,
      validateKnowledgeAttachments: async (resources) => {
        validations++;
        if (mode === "obsolete" && resources.length) throw Error("Resource is obsolete");
      },
    };
    vm.runInNewContext(code + "\nmodule.exports=acceptLLMRecommendation;", context);
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
    await context.module.exports(
      {
        params: { id: "case", recommendationId: "recommendation" },
        user: { _id: "counselor" },
        body: {
          selectedSuggestedMaterialIds:
            mode === "none" ? [] : [mode === "forged" ? "112345678901234567890123" : id],
        },
      },
      res
    );
    if (mode === "none" || mode === "selected") {
      assert.equal(res.code, 200);
      assert.equal(record.interventionPlans[0].resources.length, mode === "selected" ? 1 : 0);
      assert.equal(record.interventionPlans[0].approvalStatus, "Pending Review");
      assert.equal(recommendation.resources.length, 0);
      assert.equal(validations, 1);
    } else {
      assert.equal(record.interventionPlans.length, 0);
      assert.equal(res.code, mode === "unauthorized" ? 403 : 400);
    }
  }
});

test("Revise saves explicitly selected suggested PDFs and allows removing them without deleting suggestions", async () => {
  const source = fs.readFileSync(require.resolve("../controllers/caseController"), "utf8");
  const start = source.indexOf("const reviseLLMRecommendation =");
  const code = source.slice(start, source.indexOf("const acceptLLMRecommendation =", start));
  const recommendation = {
    _id: "recommendation",
    status: "Draft",
    concernSummary: "Stress",
    goal: "Review stress",
    planOfAction: "Complete check-in",
    suggestedInterventions: ["Stress management"],
    suggestedMaterials: [suggestion],
    resources: [],
  };
  const recs = [recommendation];
  recs.id = () => recommendation;
  const record = {
    _id: "case",
    caseStatus: "Open",
    llmRecommendations: recs,
    actionHistory: [],
    async save() {},
  };
  let validated = 0;
  const context = {
    module: { exports: {} },
    AsyncHandler: (fn) => fn,
    Case: { findById: async () => record },
    canManageRecommendations: () => true,
    populateRecommendationCase: async () => record,
    validateKnowledgeAttachments: async () => {
      validated++;
    },
  };
  vm.runInNewContext(code + "\nmodule.exports=reviseLLMRecommendation;", context);
  const selected = selectSuggestedMaterials(recommendation, [id]);
  for (const resources of [selected, []]) {
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
    await context.module.exports(
      {
        params: { id: "case", recommendationId: "recommendation" },
        user: { _id: "counselor" },
        body: { resources },
      },
      res
    );
    assert.equal(res.code, 200);
    assert.equal(recommendation.resources.length, resources.length);
    assert.equal(recommendation.suggestedMaterials.length, 1);
    assert.equal(recommendation.status, "Revised");
  }
  assert.equal(validated, 2);
});


test("all eligible cited supporting materials are retained and Reference materials cannot be selected", () => {
  const task = { ...suggestion, resourceId: "112345678901234567890123", title: "Task breakdown", resourceType: "handout" };
  const reference = { ...suggestion, resourceId: "212345678901234567890123", resourceType: "reference" };
  const materials = collectSuggestedMaterials([{ intervention: "Adjusted plan", supportingResource: suggestion, supportingResources: [suggestion, task, reference] }]);
  assert.equal(materials.length, 2);
  assert.ok(materials.some(item => item.resourceId === task.resourceId));
  assert.equal(selectSuggestedMaterials({ suggestedMaterials: materials }, [task.resourceId])[0].type, "PDF");
  assert.throws(() => selectSuggestedMaterials({ suggestedMaterials: [reference] }, [reference.resourceId]), /Reference materials/);
});
