const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
function setup(record, fail = false) {
  let calls = 0,
    prompt;
  const context = {
    module: { exports: {} },
    require: (name) =>
      name === "../models/case"
        ? { findById: async () => record }
        : {
            generateResponse: async (input) => {
              calls++;
              prompt = input;
              if (fail) throw Error("offline");
              return JSON.stringify({
                presentingProblem: "Academic stress",
                formulationNarrative: "Recorded observations show attentive engagement.",
                counselorAssessment: "Academic concerns warrant counselor review.",
                ...(record.counselorNotes?.trim()
                  ? { counselorNotesSummary: "Documented counselor note summary." }
                  : {}),
              });
            },
          },
  };
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../controllers/formulationController"), "utf8"),
    context
  );
  return {
    ...context.module.exports,
    get calls() {
      return calls;
    },
    get prompt() {
      return prompt;
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
const base = {
  assignedCounselor: "counselor",
  createdBy: "admin",
  caseStatus: "Open",
  problemAssessment: {
    primaryProblems: ["Academic stress"],
    secondaryProblems: ["Time management"],
  },
  mentalStatus: { attentionAndConcentration: "Attentive" },
  currentPresentation: {
    narrativeDescription: "Academic stress",
    onset: "Two months",
    intensity: "Moderate",
  },
};
test("drafts use saved problem assessment, mental status and presentation inputs and never saves automatically", async () => {
  const ctx = setup({
    ...base,
    student: { firstName: "PRIVATE_NAME" },
    backgroundAndPsychosocialHistory: { familyContext: "PRIVATE_HISTORY" },
    save() {
      throw Error("Must not save");
    },
  });
  const res = response();
  await ctx.generateFormulationSummary(
    { params: { id: "case" }, user: { _id: "counselor", role: "Counselor-User" } },
    res
  );
  assert.equal(res.body.draft.presentingProblem, "Academic stress");
  assert.match(ctx.prompt, /Attentive/);
  assert.match(ctx.prompt, /Time management/);
  assert.match(ctx.prompt, /summarize ONLY PROBLEM ASSESSMENT/);
  assert.match(ctx.prompt, /summarize ONLY MENTAL STATUS/);
  assert.match(ctx.prompt, /Academic stress/);
  assert.match(ctx.prompt, /Two months/);
  assert.ok(!ctx.prompt.includes("PRIVATE_NAME"));
  assert.ok(!ctx.prompt.includes("PRIVATE_HISTORY"));
});
test("summary enforces permissions, active case and meaningful inputs before calling AI", async () => {
  for (const mode of ["unauthorized", "Closed", "Terminated", "archived", "empty"]) {
    const ctx = setup({
      ...base,
      caseStatus: ["Closed", "Terminated"].includes(mode) ? mode : "Open",
      isArchived: mode === "archived",
      problemAssessment: mode === "empty" ? {} : base.problemAssessment,
      mentalStatus: mode === "empty" ? {} : base.mentalStatus,
      currentPresentation: mode === "empty" ? { intensity: "Moderate" } : base.currentPresentation,
    });
    const res = response();
    await ctx.generateFormulationSummary(
      {
        params: { id: "case" },
        user: { _id: mode === "unauthorized" ? "other" : "counselor", role: "Counselor-User" },
      },
      res
    );
    assert.equal(ctx.calls, 0);
    assert.equal(res.code, mode === "unauthorized" ? 403 : 400);
  }
});
test("summary returns a clear AI failure without changing a saved narrative", async () => {
  const record = {
    ...base,
    assignedCounselor: "admin",
    caseFormulation: { formulationNarrative: "Reviewed narrative" },
  };
  const ctx = setup(record, true);
  const res = response();
  await ctx.generateFormulationSummary(
    { params: { id: "case" }, user: { _id: "admin", role: "Counselor-Admin" } },
    res
  );
  assert.equal(res.code, 502);
  assert.equal(record.caseFormulation.formulationNarrative, "Reviewed narrative");
});

test("missing source sections produce empty drafts rather than invented content", async () => {
  const ctx = setup({ ...base, problemAssessment: {}, mentalStatus: {} });
  const res = response();
  await ctx.generateFormulationSummary(
    { params: { id: "case" }, user: { _id: "counselor", role: "Counselor-User" } },
    res
  );
  assert.equal(res.body.draft.presentingProblem, "");
  assert.equal(res.body.draft.formulationNarrative, "");
});
test("structured draft rejects malformed model responses", () => {
  const ctx = setup(base);
  assert.throws(() => ctx.parseFormulationDraft("Not JSON"));
  assert.throws(() => ctx.parseFormulationDraft('{"presentingProblem":42}'));
});

test("summary returns a separate optional notes draft without saving it", async () => {
  const record = {
    ...base,
    counselorNotes: "Counselor observed hesitation and wants individual practice.",
  };
  const ctx = setup(record);
  const res = response();
  await ctx.generateFormulationSummary(
    { params: { id: "case" }, user: { _id: "counselor", role: "Counselor-User" } },
    res
  );
  assert.equal(res.body.draft.counselorNotesSummary, "Documented counselor note summary.");
  assert.match(ctx.prompt, /individual practice/);
  assert.equal(record.caseFormulation, undefined);
});
