const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const CaseModel = require("../models/case");
const source = fs.readFileSync(require.resolve("../controllers/caseController"), "utf8");
const extract = (start, end) =>
  source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const helpers = extract("const canManageRecommendations =", "const generateLLMRecommendation =");
function context(extra = {}) {
  return vm.createContext({ ...require("../services/rag/recommendationOutputValidation"), ...extra });
}
test("recommendations follow assigned ownership for both counselor roles, not creator identity", () => {
  const ctx = context();
  vm.runInContext(helpers + "\nthis.allowed = canManageRecommendations;", ctx);
  const record = { createdBy: "creator", assignedCounselor: "assigned" };
  assert.equal(ctx.allowed(record, { _id: "creator", role: "Counselor-Admin" }), false);
  assert.equal(ctx.allowed(record, { _id: "assigned", role: "Counselor-Admin" }), true);
  assert.equal(ctx.allowed(record, { _id: "assigned", role: "Counselor-User" }), true);
  assert.equal(ctx.allowed(record, { _id: "other", role: "Counselor-User" }), false);
});
test("nested patches preserve existing observations and consent timestamp", () => {
  const originalConsentDate = new Date("2026-01-01");
  const foundCase = new CaseModel({
    consent: { hasConsent: true, consentDate: originalConsentDate },
    mentalStatus: { orientation: "Oriented", grooming: "Neat" },
  });
  const ctx = context({
    foundCase,
    req: { body: { mentalStatus: { grooming: "Updated" }, consent: { hasConsent: true } } },
    Date,
  });
  vm.runInContext(extract("const originalConsentDate =", "foundCase.updatedBy ="), ctx);
  assert.equal(foundCase.mentalStatus.orientation, "Oriented");
  assert.equal(foundCase.mentalStatus.grooming, "Updated");
  assert.equal(foundCase.consent.consentDate.getTime(), originalConsentDate.getTime());
});
test("generation keeps presentation details in RAG but uses only the narrative as the concern summary", async () => {
  const foundCase = {
    _id: "case",
    createdBy: "admin",
    assignedCounselor: "admin",
    caseStatus: "Open",
    mentalStatus: { orientation: "Oriented" },
    currentPresentation: { narrativeDescription: "Academic stress", intensity: "Moderate" },
    backgroundAndPsychosocialHistory: { familyContext: "Supportive" },
    llmRecommendations: [],
    actionHistory: [],
    async save() {
      this.saved = true;
    },
  };
  let options, data;
  const supportingResource = {
    resourceId: "012345678901234567890123",
    resourceType: "worksheet",
    title: "Worksheet",
  };
  const recommendation = {
    intervention: "Planning",
    rationale: "Relevant",
    counselorActions: [{ action: "Review tasks" }],
    supportingResource,
  };
  const ctx = context({
    collectSuggestedMaterials: require("../services/suggestedMaterials").collectSuggestedMaterials,
    Case: { findById: async () => foundCase },
    AsyncHandler: (fn) => fn,
    generateInterventionRecommendations: async (d, o) => {
      data = d;
      options = o;
      return {
        status: "ok",
        goal: "Help the student organize responsibilities and start manageable tasks.",
        followUpPlan: "Review task completion and barriers at the next session.",
        recommendations: [
          recommendation,
          recommendation,
          {
            ...recommendation,
            supportingResource: {
              ...supportingResource,
              resourceType: "reference",
              resourceId: "other",
            },
          },
        ],
        retrievedReferences: [],
      };
    },
    populateRecommendationCase: async () => foundCase,
  });
  vm.runInContext(
    helpers +
      extract("const generateLLMRecommendation =", "const reviseLLMRecommendation =") +
      "\nthis.generate=generateLLMRecommendation;",
    ctx
  );
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
  await ctx.generate(
    { params: { id: "case" }, user: { _id: "admin", role: "Counselor-Admin" } },
    res
  );
  assert.equal(res.code, 201);
  assert.match(options.retrievalQuery, /orientation: Oriented/);
  assert.match(options.retrievalQuery, /family Context: Supportive/);
  assert.match(options.retrievalQuery, /intensity: Moderate/);
  assert.match(data.mentalStatus, /orientation: Oriented/);
  assert.match(data.currentPresentation, /intensity: Moderate/);
  assert.equal(foundCase.llmRecommendations[0].concernSummary, "Academic stress");
  assert.equal(foundCase.llmRecommendations[0].resources.length, 0);
  assert.equal(foundCase.llmRecommendations[0].suggestedMaterials.length, 1);
  assert.equal(foundCase.llmRecommendations[0].suggestedMaterials[0].title, "Worksheet");
  assert.equal(foundCase.saved, true);
  foundCase.progressNotes = [{ _id: "progress", progressSummary: "Postpones tasks", timeSpan: "Follow-up in one week", newPlanOfAction: "Weekly planner", interventionProgress: { studentResponse: "No Noticeable Change" } }];
  await ctx.generate({ params: { id: "case" }, body: { mode: "updated", progressNoteId: "progress" }, user: { _id: "admin", role: "Counselor-Admin" } }, res);
  assert.equal(res.code, 201);
  assert.match(options.retrievalQuery, /Postpones tasks/);
  assert.equal(data.progressContext.latestProgress.studentResponse, "No Noticeable Change");
  assert.equal(foundCase.llmRecommendations[1].concernSummary, "Postpones tasks");
  assert.equal(foundCase.llmRecommendations[0].timeSpan, "");
  assert.equal(foundCase.llmRecommendations[1].timeSpan, "Follow-up in one week");
  assert.equal(foundCase.llmRecommendations[1].scheduleSource, "progress-note");
  assert.equal(foundCase.llmRecommendations[1].followUpPlan, "Review task completion and barriers at the next session.");
  assert.equal(foundCase.llmRecommendations[1].goal, "Help the student organize responsibilities and start manageable tasks.");
  assert.equal(foundCase.llmRecommendations[1].actionEvidence[0].action, "Review tasks");
  assert.match(foundCase.llmRecommendations[1].planOfAction, /Review tasks/);
  assert.equal(foundCase.llmRecommendations[1].sourceProgressNoteId, "progress");
  assert.equal(foundCase.llmRecommendations[1].recommendationType, "updated");
  assert.equal(foundCase.llmRecommendations[1].progressContextSnapshot.latestProgress.newPlanOfAction, "Weekly planner");
});
test("PDF preview permits linked counselors and denies unrelated counselors", async () => {
  const src = fs.readFileSync(require.resolve("../controllers/knowledgeBaseController"), "utf8");
  const code = src.slice(
    src.indexOf("const viewKnowledgeResourcePdf ="),
    src.indexOf("const deleteKnowledgeResource =")
  );
  let linked = true,
    query;
  const ctx = context({
    isStudentMaterial: require("../services/resourceEligibility").isStudentMaterial,
    KnowledgeResource: {
      findById: async () => ({
        _id: "resource",
        filePath: "/tmp/sample.pdf",
        originalFileName: "sample.pdf",
      }),
    },
    Case: {
      exists: async (q) => {
        query = q;
        return linked;
      },
    },
    path: require("node:path"),
    fs: { access: async () => {} },
    console,
  });
  vm.runInContext(code + "\nthis.preview=viewKnowledgeResourcePdf;", ctx);
  const response = () => ({
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    setHeader() {},
    sendFile(file) {
      this.file = file;
      return this;
    },
  });
  let res = response();
  await ctx.preview(
    { params: { id: "resource" }, user: { role: "Counselor-User", _id: "counselor" } },
    res
  );
  assert.equal(res.file, "/tmp/sample.pdf");
  assert.equal(
    query.$and[1].$or[0]["llmRecommendations.resources.url"],
    "/api/knowledge-base/resource/pdf"
  );
  assert.equal(query.$and[0].assignedCounselor, "counselor");
  linked = false;
  res = response();
  await ctx.preview(
    { params: { id: "resource" }, user: { role: "Counselor-User", _id: "other" } },
    res
  );
  assert.equal(res.code, 403);
  assert.equal(res.file, undefined);
});
test("prompt includes mental status and referral information", () => {
  const { buildInterventionPrompt } = require("../services/rag/promptBuilderService");
  const prompt = buildInterventionPrompt(
    { mentalStatus: "orientation: Oriented", referralInformation: "referral source: Faculty" },
    [{ content: "Evidence", metadata: { title: "Reference" } }]
  );
  assert.match(prompt, /Mental Status:\norientation: Oriented/);
  assert.match(prompt, /Referral Information:\nreferral source: Faculty/);
});
test("early student-case check offers notes only for authorized active cases", async () => {
  let record = null,
    query;
  const ctx = context({
    Case: {
      findOne(q) {
        query = q;
        return { select: async () => record };
      },
    },
    AsyncHandler: (fn) => fn,
    hasActiveTemporaryAccess: () => false,
  });
  vm.runInContext(
    helpers +
      extract("const getStudentActiveCase =", "const createCase =") +
      "\nthis.check=getStudentActiveCase;",
    ctx
  );
  const req = {
    params: { studentId: "012345678901234567890123" },
    user: { _id: "owner", role: "Counselor-User" },
  };
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
  let res = response();
  await ctx.check(req, res);
  assert.equal(res.body.exists, false);
  assert.deepEqual(Array.from(query.caseStatus.$nin), ["Closed", "Terminated"]);
  record = { _id: "case", createdBy: "owner", assignedCounselor: "owner" };
  res = response();
  await ctx.check(req, res);
  assert.equal(res.body.canAddNotes, true);
  assert.equal(res.body.caseId, "case");
  req.user._id = "other";
  res = response();
  await ctx.check(req, res);
  assert.equal(res.body.exists, true);
  assert.equal(res.body.canAddNotes, false);
  assert.equal(res.body.caseId, null);
});

test("updated context follows the note relationship, excludes other plans, and grounds prompt and retrieval in progress", () => {
  const ctx = context();
  vm.runInContext(helpers + "\nthis.progress=buildProgressContext;this.query=buildRagRetrievalQuery;", ctx);
  const record = {
    interventionPlans: [
      { _id: "linked", approvalStatus: "Approved", goal: "Manage stress", planOfAction: "Calm Down Stress Practice" },
      { _id: "newest", goal: "UNRELATED PLAN" },
    ],
    progressNotes: [
      { _id: "older", noteDate: "2026-10-01", progressSummary: "Earlier temporary relief", interventionProgress: { interventionPlan: "linked" } },
      { _id: "other", noteDate: "2026-10-02", progressSummary: "UNRELATED NOTE", interventionProgress: { interventionPlan: "newest" } },
      { _id: "latest", noteDate: "2026-10-03", progressStatus: "Worsened", progressSummary: "Stress increased from 8/10 to 9/10; postpones tasks", newPlanOfAction: "Weekly study planner and task prioritization", interventionProgress: { interventionPlan: "linked", studentResponse: "No Noticeable Change", goalProgress: "Slight Progress", recommendedPlanAction: "Revise Intervention Plan", supportingNote: "Relaxation gave temporary relief" } },
    ],
  };
  const before = JSON.stringify(record);
  const data = ctx.progress(record);
  assert.equal(data.recommendationType, "updated");
  assert.equal(data.previousPlanId, "linked");
  assert.equal(data.sourceProgressNoteId, "latest");
  assert.equal(data.progressContext.earlierProgress.length, 1);
  assert.doesNotMatch(JSON.stringify(data), /UNRELATED/);
  assert.match(ctx.query(data), /Weekly study planner/);
  assert.match(ctx.query(data), /No Noticeable Change/);
  const { buildInterventionPrompt } = require("../services/rag/promptBuilderService");
  const prompt = buildInterventionPrompt(data, [{ content: "Guide the student to plan tasks.", metadata: { title: "Test reference" } }]);
  assert.match(prompt, /Calm Down Stress Practice/);
  assert.match(prompt, /No Noticeable Change/);
  assert.match(prompt, /Slight Progress/);
  assert.match(prompt, /Avoid simply\nrepeating ineffective strategies/);
  assert.equal(JSON.stringify(record), before);
});

test("initial mode and incomplete or foreign progress are handled safely", () => {
  const ctx = context();
  vm.runInContext(helpers + "\nthis.progress=buildProgressContext;", ctx);
  assert.equal(ctx.progress({}).recommendationType, "initial");
  const record = { progressNotes: [{ _id: "note", progressSummary: "Still struggling" }] };
  assert.equal(ctx.progress(record, { mode: "initial" }).progressContext, undefined);
  assert.equal(ctx.progress(record).progressContext.previousIntervention, null);
  assert.equal(ctx.progress(record).progressContext.latestProgress.studentResponse, "Not Assessed");
  assert.throws(() => ctx.progress(record, { mode: "updated", progressNoteId: "foreign" }), /belonging to this case/);
  assert.throws(() => ctx.progress({}, { mode: "updated" }), /saved progress note/);
  assert.throws(() => ctx.progress(record, { mode: "bad" }), /Invalid/);
  record.progressNotes[0].interventionProgress = { interventionPlan: "foreign-plan" };
  assert.throws(() => ctx.progress(record), /unavailable in this case/);
});

test("updated recommendation acceptance appends a reviewable plan preserving lineage and approved history", async () => {
  const CaseModel = require("../models/case");
  const mongoose = require("mongoose");
  const id = () => new mongoose.Types.ObjectId();
  const userId = id();
  const foundCase = new CaseModel({ createdBy: userId, assignedCounselor: userId,
    interventionPlans: [{ problem: "Academic stress", planOfAction: "Original", approvalStatus: "Approved" }],
    progressNotes: [{ progressSummary: "No improvement", addedBy: userId }],
  });
  const original = foundCase.interventionPlans[0];
  foundCase.llmRecommendations.push({ recommendationType: "updated", sourceProgressNoteId: foundCase.progressNotes[0]._id,
    previousPlanId: original._id, timeSpan: "Follow-up in one week", followUpPlan: "Counselor-documented schedule: Follow-up in one week", scheduleSource: "progress-note", concernSummary: "Academic stress", goal: "Start tasks", planOfAction: "Weekly planner", generatedBy: userId });
  const rec = foundCase.llmRecommendations[0];
  foundCase.save = async () => foundCase;
  const before = JSON.stringify(original);
  const ctx = context({ AsyncHandler: (fn) => fn, Case: { findById: async () => foundCase },
    selectSuggestedMaterials: () => [], validateKnowledgeAttachments: async () => {}, populateRecommendationCase: async () => foundCase });
  vm.runInContext(helpers + extract("const acceptLLMRecommendation =", "const rejectLLMRecommendation =") + "\nthis.accept=acceptLLMRecommendation;", ctx);
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await ctx.accept({ params: { id: String(foundCase._id), recommendationId: String(rec._id) }, body: {}, user: { _id: userId, role: "Counselor-User" } }, res);
  assert.equal(res.code, 200);
  assert.equal(foundCase.interventionPlans.length, 2);
  const revised = foundCase.interventionPlans[1];
  assert.equal(revised.recommendationType, "updated");
  assert.equal(String(revised.previousPlanId), String(original._id));
  assert.equal(String(revised.sourceProgressNoteId), String(foundCase.progressNotes[0]._id));
  assert.equal(revised.approvalStatus, "Pending Review");
  assert.equal(revised.timeSpan, "Follow-up in one week");
  assert.equal(revised.scheduleSource, "progress-note");
  assert.match(revised.followUpPlan, /Counselor-documented schedule/);
  assert.equal(rec.status, "Accepted");
  assert.equal(JSON.stringify(original), before);
});

test("generation save boundary requires model goal and follow-up, preserves history, and serializes support status", async () => {
  const { RECOMMENDATION_OUTPUT_VERSION } = require('../services/rag/recommendationOutputValidation');
  for (const mode of ['valid', 'corrected-valid', 'missing-followup', 'generic-goal', 'schedule-only', 'needs-regeneration', 'malformed-model']) {
    let saves = 0;
    const isValid = ['valid', 'corrected-valid'].includes(mode);
    const foundCase = { _id: 'case', createdBy: 'owner', assignedCounselor: 'owner', caseStatus: 'Open',
      currentPresentation: { narrativeDescription: 'Difficulty completing responsibilities' },
      interventionPlans: [{ _id: 'approved', approvalStatus: 'Approved', goal: 'Original goal', planOfAction: 'Original activity' }],
      progressNotes: [{ _id: 'note', progressSummary: 'Some difficulties remain', timeSpan: 'Follow-up in one week', interventionProgress: { interventionPlan: 'approved', studentResponse: 'Mixed Response' } }],
      llmRecommendations: [{ _id: 'historical', goal: 'Historical goal', followUpPlan: '' }], actionHistory: [], async save() { saves++; } };
    const before = JSON.stringify({ plans: foundCase.interventionPlans, notes: foundCase.progressNotes, historical: foundCase.llmRecommendations[0] });
    const result = { status: mode === 'needs-regeneration' ? 'needs_regeneration' : mode === 'malformed-model' ? 'malformed_model_output' : 'ok', correctiveRetryOccurred: mode === 'corrected-valid', reason: 'Some activities lacked support. Regenerate the recommendation. No draft was saved.', goal: mode === 'generic-goal' ? 'Support the student through appropriate interventions related to the documented concerns, including Planning.' : 'Help the student organize responsibilities and build manageable task routines.',
      followUpPlan: mode === 'missing-followup' ? undefined : mode === 'schedule-only' ? 'Counselor-documented schedule: Follow-up in one week' : 'Evaluate progress toward the goal, response to activities, and implementation barriers.',
      recommendations: [{ intervention: 'Planning', rationale: 'Addresses remaining difficulties.', counselorActions: [{ action: 'Guide task planning.', changeType: 'new', evidenceStatus: 'direct-support', evidenceNeedsReview: false, references: [{ title: 'Planning guide', referenceNumber: 1, pageNumber: 2 }] }] }], retrievedReferences: [] };
    const ctx = context({ AsyncHandler: fn => fn, Case: { findById: async () => foundCase },
      collectSuggestedMaterials: () => [], generateInterventionRecommendations: async () => result, populateRecommendationCase: async () => foundCase });
    vm.runInContext(helpers + extract('const generateLLMRecommendation =', 'const reviseLLMRecommendation =') + '\nthis.generate=generateLLMRecommendation;', ctx);
    const res = { status(code) { this.code=code; return this; }, json(body) { this.body=body; return this; } };
    await ctx.generate({ params: { id: 'case' }, body: { mode: 'updated', progressNoteId: 'note' }, user: { _id: 'owner', role: 'Counselor-User' } }, res);
    assert.equal(JSON.stringify({ plans: foundCase.interventionPlans, notes: foundCase.progressNotes, historical: foundCase.llmRecommendations[0] }), before);
    assert.equal(saves, isValid ? 1 : 0);
    assert.equal(foundCase.llmRecommendations.length, isValid ? 2 : 1);
    if (!isValid) {
      assert.equal(res.code, ['needs-regeneration', 'malformed-model'].includes(mode) ? 422 : 502);
      if (['needs-regeneration', 'malformed-model'].includes(mode)) { assert.equal(res.body.status, mode === 'needs-regeneration' ? 'needs_regeneration' : 'malformed_model_output'); assert.match(res.body.message, /No draft was saved/); }
      else assert.match(res.body.message, /No recommendation was saved/);
      continue;
    }
    assert.equal(res.code, 201);
    const draft = foundCase.llmRecommendations[1];
    assert.equal(draft.goal, result.goal);
    assert.equal(draft.followUpPlan, result.followUpPlan);
    assert.equal(draft.timeSpan, 'Follow-up in one week');
    assert.equal(draft.outputContractVersion, RECOMMENDATION_OUTPUT_VERSION);
    assert.equal(res.body.outputContractVersion, RECOMMENDATION_OUTPUT_VERSION);
    const persistedShape = new CaseModel({ llmRecommendations: [draft] }).toObject().llmRecommendations[0];
    assert.equal(persistedShape.goal, result.goal);
    assert.equal(persistedShape.followUpPlan, result.followUpPlan);
    assert.equal(persistedShape.actionEvidence[0].evidenceStatus, 'direct-support');
    assert.equal(persistedShape.outputContractVersion, RECOMMENDATION_OUTPUT_VERSION);
  }
});
