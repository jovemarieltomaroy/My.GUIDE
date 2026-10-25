const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Case = require("../models/case");
const source = fs.readFileSync(require.resolve("../controllers/caseController"), "utf8");
const code = source.slice(
  source.indexOf("const updateCase ="),
  source.indexOf("const updateCaseStatus =")
);
const guard = source.slice(
  source.indexOf("const canManageRecommendations ="),
  source.indexOf("const collectTextValues =")
);
function setup({ caseStatus = "Open", isArchived = false } = {}) {
  const record = new Case({
    assignedCounselor: "012345678901234567890123",
    createdBy: "112345678901234567890123",
    caseStatus,
    isArchived,
    caseFormulation: { presentingProblem: "Existing concern", aiSummary: "Historical summary" },
    mentalStatus: { grooming: "Neat" },
  });
  let saves = 0;
  record.save = async () => {
    saves++;
  };
  const chain = {
    populate() {
      return this;
    },
    then(resolve) {
      return Promise.resolve(record).then(resolve);
    },
  };
  const context = {
    module: { exports: {} },
    AsyncHandler: (fn) => fn,
    Case: { findById: () => chain },
  };
  vm.runInNewContext(guard + code + "\nmodule.exports=updateCase;", context);
  return {
    update: context.module.exports,
    record,
    get saves() {
      return saves;
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
const user = { _id: "012345678901234567890123", role: "Counselor-User" };
test("assigned counselor saves formulation without overwriting existing summary or unrelated case data", async () => {
  const ctx = setup();
  const res = response();
  await ctx.update(
    {
      params: { id: "case" },
      user,
      body: {
        caseFormulation: {
          formulationNarrative: "Reviewed context",
          counselorAssessment: "Counselor assessment",
        },
      },
    },
    res
  );
  assert.equal(res.code, 200);
  assert.equal(ctx.saves, 1);
  assert.equal(ctx.record.caseFormulation.presentingProblem, "Existing concern");
  assert.equal(ctx.record.caseFormulation.formulationNarrative, "Reviewed context");
  assert.equal(ctx.record.caseFormulation.aiSummary, "Historical summary");
  assert.equal(ctx.record.mentalStatus.grooming, "Neat");
  assert.equal(ctx.record.actionHistory[0].remarks, "Counselor case formulation updated.");
});
test("formulation rejects unauthorized counselors and inactive cases without saving", async () => {
  for (const mode of ["unauthorized", "Closed", "Terminated", "archived"]) {
    const ctx = setup({
      caseStatus: ["Closed", "Terminated"].includes(mode) ? mode : "Open",
      isArchived: mode === "archived",
    });
    const res = response();
    await ctx.update(
      {
        params: { id: "case" },
        user: mode === "unauthorized" ? { ...user, _id: "212345678901234567890123" } : user,
        body: { caseFormulation: { counselorAssessment: "Changed" } },
      },
      res
    );
    assert.equal(res.code, ["Closed", "Terminated"].includes(mode) ? 400 : 403);
    assert.equal(ctx.saves, 0);
  }
});
test("formulation rejects malformed fields before writing", async () => {
  for (const value of [null, [], { counselorAssessment: {} }, { unexpected: "field" }]) {
    const ctx = setup();
    const res = response();
    await ctx.update({ params: { id: "case" }, user, body: { caseFormulation: value } }, res);
    assert.equal(res.code, 400);
    assert.equal(ctx.saves, 0);
  }
});
