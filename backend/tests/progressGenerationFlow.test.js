const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { buildInterventionPrompt } = require('../services/rag/promptBuilderService');
const controller = fs.readFileSync(require.resolve('../controllers/caseController'), 'utf8');
const helpers = vm.createContext({});
vm.runInContext(controller.slice(controller.indexOf('const canManageRecommendations ='), controller.indexOf('const generateLLMRecommendation =')) + '\nthis.progress=buildProgressContext;this.query=buildRagRetrievalQuery;this.original=buildRagCaseData;', helpers);

const record = {
  currentPresentation: { narrativeDescription: 'ORIGINAL_ACADEMIC_CONCERNS' },
  interventionPlans: [{ _id: 'linked-plan', approvalStatus: 'Approved', goal: 'PREVIOUS_GOAL', planOfAction: 'PREVIOUS_ACTION' }],
  progressNotes: [{ _id: 'saved-note', progressStatus: 'Worsened', progressSummary: 'CURRENT_DEADLINE_DIFFICULTIES', newPlanOfAction: 'PROPOSED_WEEKLY_PLANNING', remarks: 'DOCUMENTED_REMARKS', interventionProgress: { interventionPlan: 'linked-plan', studentResponse: 'No Noticeable Change', goalProgress: 'Slight Progress', supportingNote: 'TEMPORARY_RELIEF_ONLY' } }],
};
const chunk = { content: 'Help the student plan tasks.', score: 0.88, metadata: { title: 'Approved planning reference', resourceType: 'reference', pageNumber: 7 } };
const modelResult = { status: 'ok', updateAssessment: { decision: 'revise', outcomeConsidered: true, proposedNextStepsConsidered: true, justification: 'Use planning to address the documented remaining task difficulties.' }, goal: 'Help the student organize responsibilities and build manageable task routines.', followUpPlan: 'Review task completion, response to activities, barriers, and the need for adjustment at the next session.', recommendations: [{ intervention: 'Planning', rationale: 'Supports documented deadlines.', counselorActions: [{ action: 'Plan tasks.', referenceNumbers: [1], changeType: 'new', changeReason: 'Addresses the documented difficulty starting tasks.' }], supportingResource: null }] };

function pipeline(environment, result = modelResult, chunks = [chunk], reviewOverride = null) {
  let request, retrievalQuery, generationCalls = 0, evidenceCalls = 0;
  const logs = [];
  const consoleStub = { debug: (...args) => logs.push(args), warn() {}, error() {} };
  const ollama = { module: { exports: {} }, process: { env: {} }, console: consoleStub,
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      if (body.prompt.startsWith("EVIDENCE_REVIEW_ONLY")) {
        evidenceCalls++;
        const data = JSON.parse(body.prompt.split("DATA:\n")[1]);
        const override = typeof reviewOverride === "function" ? reviewOverride(evidenceCalls, data) : Array.isArray(reviewOverride) ? reviewOverride[evidenceCalls - 1] : reviewOverride;
        const review = override || { ...(data.summary ? { consistency: { aligned: true, problemFields: [] } } : {}), reviews: data.actions.map((action) => ({ actionIndex: action.actionIndex,
          citations: action.citations.map((citation) => ({ referenceNumber: citation.referenceNumber, support: "direct", quote: citation.passage })),
          changeType: action.proposedChangeType || "new", previousActionQuote: data.previousActions })) };
        return { ok: true, json: async () => ({ response: typeof review === "string" ? review : JSON.stringify(review) }) };
      }
      generationCalls++;
      request = { url, body };
      const selected = typeof result === "function" ? result(generationCalls, body) : Array.isArray(result) ? result[generationCalls - 1] : result;
      return { ok: true, json: async () => ({ response: typeof selected === "string" ? selected : JSON.stringify(selected) }) };
    } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../services/llm/ollamaService'), 'utf8'), ollama);
  const context = { module: { exports: {} }, process: { env: { NODE_ENV: environment } }, console: consoleStub,
    require(name) {
      if (name === './recommendationOutputValidation') return require('../services/rag/recommendationOutputValidation');
      if (name === './evidenceReviewService') return require('../services/rag/evidenceReviewService');
      if (name === './retrievalService') return { retrieveInterventionMaterials: async (query) => { retrievalQuery = query; return chunks; }, filterEligibleChunks: async (items) => items };
      if (name === './promptBuilderService') return { buildInterventionPrompt };
      if (name === '../llm/ollamaService') return ollama.module.exports;
      throw Error(name);
    } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../services/rag/interventionRecommendationService'), 'utf8'), context);
  return { generate: context.module.exports.generateInterventionRecommendations, logs, request: () => request, query: () => retrievalQuery, calls: () => ({ generationCalls, evidenceCalls }) };
}

test('selected saved progress reaches the actual Ollama request with grounded citations and safe development diagnostics', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record, { mode: 'updated', progressNoteId: 'saved-note' }) };
  const flow = pipeline('development');
  const result = await flow.generate(data, { retrievalQuery: helpers.query(data) });
  assert.equal(result.status, 'ok');
  const { url, body } = flow.request();
  assert.equal(url, 'http://localhost:11434/api/generate');
  assert.equal(body.model, 'gemma3:4b');
  assert.equal(body.format, 'json');
  assert.deepEqual(flow.calls(), { generationCalls: 1, evidenceCalls: 1 });
  assert.match(body.prompt, /BOTH top-level "goal" and "followUpPlan" are REQUIRED/);
  assert.equal(result.goal, modelResult.goal);
  assert.equal(result.followUpPlan, modelResult.followUpPlan);
  for (const value of ['ORIGINAL_ACADEMIC_CONCERNS', 'PREVIOUS_GOAL', 'PREVIOUS_ACTION', 'CURRENT_DEADLINE_DIFFICULTIES', 'PROPOSED_WEEKLY_PLANNING', 'DOCUMENTED_REMARKS', 'No Noticeable Change', 'Slight Progress', 'TEMPORARY_RELIEF_ONLY']) {
    assert.ok(body.prompt.includes(value), value);
    if (!["ORIGINAL_ACADEMIC_CONCERNS", "PREVIOUS_GOAL", "PREVIOUS_ACTION"].includes(value)) assert.ok(flow.query().includes(value), value);
    assert.ok(!JSON.stringify(flow.logs).includes(value), 'sensitive value logged');
  }
  assert.ok(!flow.query().includes("PREVIOUS_ACTION"));
  assert.match(body.prompt, /repeating ineffective strategies without a documented reason/);
  assert.equal(result.recommendations[0].counselorActions[0].references[0].title, chunk.metadata.title);
  assert.equal(result.recommendations[0].counselorActions[0].references[0].pageNumber, 7);
  const diagnostics = Object.assign({}, ...flow.logs.map((entry) => entry[1]));
  assert.equal(diagnostics.selectedProgressNoteId, 'saved-note');
  assert.equal(diagnostics.previousInterventionPlanId, 'linked-plan');
  assert.equal(diagnostics.updatedConcernsIncludedInRagQuery, true);
  assert.equal(diagnostics.progressInformationIncludedInPrompt, true);
  assert.equal(diagnostics.previousInterventionIncludedInPrompt, true);
  assert.equal(diagnostics.references[0].similarityScore, 0.88);
});

test('fallback retrieval retains progress and diagnostics stay off outside development', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  for (const environment of ['production', 'test', undefined]) {
    const flow = pipeline(environment);
    await flow.generate(data);
    assert.match(flow.query(), /CURRENT_DEADLINE_DIFFICULTIES/);
    assert.equal(flow.logs.length, 0);
  }
});

test('missing evidence prevents Ollama generation and nonexistent citation numbers fail validation', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  const empty = pipeline('development', modelResult, []);
  assert.equal((await empty.generate(data)).status, 'insufficient_reference_material');
  assert.equal(empty.request(), undefined);
  const badCitation = JSON.parse(JSON.stringify(modelResult));
  badCitation.recommendations[0].counselorActions[0].referenceNumbers = [2];
  assert.equal((await pipeline('test', badCitation).generate(data)).status, 'malformed_model_output');
});


test('unjustified repetition is flagged while explained continuation is permitted', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  data.progressContext.previousIntervention.planOfAction = 'Planning Plan tasks';
  const repeated = await pipeline('development', { ...modelResult, updateAssessment: undefined }).generate(data);
  assert.equal(repeated.status, 'malformed_model_output');
  assert.equal(repeated.correctiveRetryOccurred, true);
  assert.match(repeated.reason, /incomplete or invalid/);
  const justified = JSON.parse(JSON.stringify(modelResult));
  justified.updateAssessment = { decision: 'mixed', outcomeConsidered: true, proposedNextStepsConsidered: true, justification: 'Retain task planning with adjusted workload goals based on the planning reference and documented barriers.' };
  const accepted = await pipeline('development', justified).generate(data);
  assert.equal(accepted.status, 'ok');
  assert.equal(accepted.updateAssessment.decision, 'mixed');
  assert.ok(accepted.generationWarnings.some(w => w.includes('overlaps')));
});

test('malformed model output and empty actions are errors, never original-plan fallbacks', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  assert.equal((await pipeline('development', 'not-an-object').generate(data)).status, 'malformed_model_output');
  const invalid = JSON.parse(JSON.stringify(modelResult));
  invalid.recommendations[0].counselorActions[0].action = '   ';
  assert.equal((await pipeline('development', invalid).generate(data)).status, 'malformed_model_output');
});


test('multiple cited student resources survive while reference evidence and uncited resources are excluded', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  const resource = (id, type, title) => ({ ...chunk, metadata: { ...chunk.metadata, resourceId: id, resourceType: type, title } });
  const chunks = [resource('012345678901234567890123', 'worksheet', 'Stress worksheet'), resource('112345678901234567890123', 'handout', 'Task breakdown'), resource('212345678901234567890123', 'reference', 'Evidence only'), resource('312345678901234567890123', 'handout', 'Uncited handout')];
  const response = JSON.parse(JSON.stringify(modelResult));
  response.recommendations[0].supportingResource = { referenceNumber: 1 };
  response.recommendations[0].counselorActions[0] = { action: 'Break tasks into smaller steps.', changeType: 'adjusted', changeReason: 'Addresses persistent deadline difficulties.', referenceNumbers: [1, 2, 3] };
  const result = await pipeline('test', response, chunks).generate(data);
  const { collectSuggestedMaterials } = require('../services/suggestedMaterials');
  const suggestions = collectSuggestedMaterials(result.recommendations);
  assert.equal(suggestions.length, 2);
  assert.ok(suggestions.some(item => item.title === 'Task breakdown'));
  assert.ok(!suggestions.some(item => ['Evidence only', 'Uncited handout'].includes(item.title)));
  const action = result.recommendations[0].counselorActions[0];
  assert.equal(action.references.length, 3);
  assert.equal(action.changeType, 'adjusted');
  assert.match(action.changeReason, /deadline/);
});

test('goals are dedicated outcomes and malformed or title-only goals never fall back to generic goals', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  const result = await pipeline('test').generate(data);
  assert.equal(result.goal, modelResult.goal);
  assert.equal(result.followUpPlan, modelResult.followUpPlan);
  for (const goal of [undefined, '', 'Planning and Prioritization', 'Support the student through appropriate interventions including Planning']) {
    const invalid = { ...modelResult, goal, recommendations: [{ ...modelResult.recommendations[0], intervention: 'Planning and Prioritization' }] };
    assert.equal((await pipeline('test', invalid).generate(data)).status, 'malformed_model_output');
  }
  assert.equal((await pipeline('test', { ...modelResult, followUpPlan: 'Review progress in one week.' }).generate(data)).status, 'malformed_model_output');
  assert.equal((await pipeline('test', { ...modelResult, followUpPlan: 'Review progress on 12/21/2026.' }).generate(data)).status, 'malformed_model_output');
  const noSchedule = await pipeline('test').generate(data);
  assert.equal(noSchedule.followUpPlan, modelResult.followUpPlan);
  assert.ok(!('timeSpan' in noSchedule));
});

test('topical anxiety information cannot support cognitive restructuring without technique evidence', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  const response = JSON.parse(JSON.stringify(modelResult));
  response.recommendations[0].counselorActions[0].action = 'Help the student challenge unhelpful beliefs.';
  const background = { ...chunk, content: 'Anxiety may involve worry, tension, and a faster heart rate.' };
  const review = { consistency: { aligned: true, problemFields: [] }, reviews: [{ actionIndex: 0, changeType: 'new', citations: [{ referenceNumber: 1, support: 'background', quote: background.content }] }] };
  const result = await pipeline('test', response, [background], review).generate(data);
  assert.equal(result.status, 'insufficient_reference_material');
  assert.equal(result.recommendations.length, 0);
  assert.match(result.reason, /No adequately supported activities/);
});

test('only directly supported citations and their eligible PDFs survive; invented quotes fail deterministically', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  const response = JSON.parse(JSON.stringify(modelResult));
  response.recommendations[0].counselorActions[0].referenceNumbers = [1, 2];
  response.recommendations[0].supportingResource = { referenceNumber: 1 };
  const chunks = [
    { ...chunk, content: 'Tasks can feel overwhelming.', metadata: { ...chunk.metadata, title: 'Background', resourceId: '012345678901234567890123', resourceType: 'worksheet' } },
    { ...chunk, content: 'Help the student plan tasks.', metadata: { ...chunk.metadata, title: 'Planning handout', resourceId: '112345678901234567890123', resourceType: 'handout' } },
  ];
  const review = { consistency: { aligned: true, problemFields: [] }, reviews: [{ actionIndex: 0, changeType: 'new', citations: [
    { referenceNumber: 1, support: 'background', quote: chunks[0].content },
    { referenceNumber: 2, support: 'direct', quote: chunks[1].content },
  ] }] };
  const result = await pipeline('test', response, chunks, review).generate(data);
  const action = result.recommendations[0].counselorActions[0];
  assert.deepEqual(Array.from(action.references, ref => ref.referenceNumber), [2]);
  assert.equal(action.evidenceStatus, 'direct-support');
  assert.equal(action.evidenceNeedsReview, true);
  assert.deepEqual(require('../services/suggestedMaterials').collectSuggestedMaterials(result.recommendations).map(item => item.title), ['Planning handout']);
  review.reviews[0].citations[1].quote = 'Invented source quotation that is not in the passage.';
  assert.equal((await pipeline('test', response, chunks, review).generate(data)).status, 'insufficient_reference_material');
});

test('history classifications require actual prior activity rather than a shared concern', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  data.progressContext.previousIntervention.planOfAction = 'Practice weekly task planning with the student.';
  const response = JSON.parse(JSON.stringify(modelResult));
  response.updateAssessment = { decision: 'mixed', outcomeConsidered: true, proposedNextStepsConsidered: true, justification: 'Retain useful planning components with adjustments responding to current implementation barriers.' };
  response.recommendations[0].counselorActions[0] = { action: 'Plan tasks with smaller daily steps.', referenceNumbers: [1], changeType: 'adjusted', changeReason: 'Modify the existing weekly planning activity to address continued task initiation barriers.' };
  const review = { consistency: { aligned: true, problemFields: [] }, reviews: [{ actionIndex: 0, changeType: 'adjusted', previousActionQuote: data.progressContext.previousIntervention.planOfAction,
    citations: [{ referenceNumber: 1, support: 'direct', quote: chunk.content }] }] };
  const adjusted = await pipeline('test', response, [chunk], review).generate(data);
  assert.equal(adjusted.recommendations[0].counselorActions[0].changeType, 'adjusted');
  review.reviews[0].previousActionQuote = 'An undocumented previous exercise.';
  const uncertain = await pipeline('test', response, [chunk], review).generate(data);
  assert.equal(uncertain.recommendations[0].counselorActions[0].changeType, undefined);
  assert.equal(uncertain.recommendations[0].counselorActions[0].classificationNeedsReview, true);
  review.reviews[0].changeType = 'new';
  const introduced = await pipeline('test', response, [chunk], review).generate(data);
  assert.equal(introduced.recommendations[0].counselorActions[0].changeType, undefined);
  assert.equal(introduced.recommendations[0].counselorActions[0].classificationNeedsReview, true);
  assert.equal(introduced.recommendations[0].counselorActions[0].changeReason, '');
  response.recommendations[0].counselorActions[0].action = data.progressContext.previousIntervention.planOfAction;
  review.reviews[0].previousActionQuote = data.progressContext.previousIntervention.planOfAction;
  const continued = await pipeline('test', response, [chunk], review).generate(data);
  assert.equal(continued.recommendations[0].counselorActions[0].changeType, undefined);
  assert.equal(continued.recommendations[0].counselorActions[0].classificationNeedsReview, true);
});

test('incomplete or malformed semantic review never silently approves evidence', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  assert.equal((await pipeline('test', modelResult, [chunk], '{').generate(data)).status, 'malformed_model_output');
  assert.equal((await pipeline('test', modelResult, [chunk], { reviews: [] }).generate(data)).status, 'malformed_model_output');
});


test('failed corrective retry never publishes stale dependent fields', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  for (const concern of ['academic tasks', 'interpersonal communication']) {
    const response = JSON.parse(JSON.stringify(modelResult));
    response.goal = `Help the student improve ${concern} using the proposed skills.`;
    response.followUpPlan = 'Evaluate both the retained activity and the proposed additional technique.';
    response.updateAssessment = { decision: 'revise', outcomeConsidered: true, proposedNextStepsConsidered: true, justification: 'Introduce both proposed techniques to address unresolved difficulties.' };
    response.recommendations[0].intervention = 'Retained and additional techniques';
    response.recommendations[0].rationale = 'Both techniques address the concern.';
    response.recommendations[0].counselorActions.push({ action: 'Use an additional unsupported technique.', referenceNumbers: [1], changeType: 'new', changeReason: 'Add the second technique.' });
    const before = JSON.stringify({ response, data });
    const review = { consistency: { aligned: true, problemFields: [] }, reviews: [
      { actionIndex: 0, changeType: 'new', citations: [{ referenceNumber: 1, support: 'direct', quote: chunk.content }] },
      { actionIndex: 1, changeType: 'new', citations: [{ referenceNumber: 1, support: 'insufficient', quote: '' }] },
    ] };
    const flow = pipeline('development', response, [chunk], review);
    const result = await flow.generate(data);
    assert.equal(result.status, 'needs_regeneration');
    assert.equal(result.correctiveRetryOccurred, true);
    assert.deepEqual(flow.calls(), { generationCalls: 2, evidenceCalls: 1 });
    assert.equal(result.recommendations.length, 0);
    for (const field of ['goal', 'followUpPlan', 'updateAssessment', 'suggestedMaterials']) assert.equal(result[field], undefined);
    assert.equal(require('../services/suggestedMaterials').collectSuggestedMaterials(result.recommendations).length, 0);
    assert.equal(result.retrievedReferences.length, 0);
    assert.equal(JSON.stringify({ response, data }), before);
    assert.ok(flow.logs.some(entry => entry[0].includes('consistency') && entry[1].rejected === 1));
  }
});

test('removing an entire recommendation also invalidates global goal and follow-up', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  const response = JSON.parse(JSON.stringify(modelResult));
  response.recommendations.push({ intervention: 'Unsupported activity', rationale: 'Original rationale.', counselorActions: [{ action: 'Perform another technique.', referenceNumbers: [1], changeType: 'new', changeReason: 'The original rationale for the second activity.' }] });
  const review = { consistency: { aligned: true, problemFields: [] }, reviews: [
    { actionIndex: 0, changeType: 'new', citations: [{ referenceNumber: 1, support: 'direct', quote: chunk.content }] },
    { actionIndex: 1, changeType: 'new', citations: [{ referenceNumber: 1, support: 'background', quote: chunk.content }] },
  ] };
  const result = await pipeline('test', response, [chunk], review).generate(data);
  assert.equal(result.status, 'needs_regeneration');
  assert.equal(result.recommendations.length, 0);
});

test('valid action set preserves dependent fields and a consistent history classification', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  data.progressContext.previousIntervention.planOfAction = 'Practice weekly task planning with the student.';
  const response = JSON.parse(JSON.stringify(modelResult));
  response.updateAssessment = { decision: 'continue', outcomeConsidered: true, proposedNextStepsConsidered: true, justification: 'Continue the documented helpful activity with counselor review.' };
  response.recommendations[0].counselorActions[0] = { action: data.progressContext.previousIntervention.planOfAction, referenceNumbers: [1], changeType: 'continued', changeReason: 'Retain the useful documented practice.' };
  const review = { consistency: { aligned: true, problemFields: [] }, reviews: [{ actionIndex: 0, changeType: 'continued', previousActionQuote: data.progressContext.previousIntervention.planOfAction, citations: [{ referenceNumber: 1, support: 'direct', quote: chunk.content }] }] };
  const result = await pipeline('test', response, [chunk], review).generate(data);
  assert.equal(result.status, 'ok');
  assert.equal(result.goal, response.goal);
  assert.equal(result.followUpPlan, response.followUpPlan);
  assert.equal(result.recommendations[0].intervention, response.recommendations[0].intervention);
  assert.equal(result.recommendations[0].rationale, response.recommendations[0].rationale);
  assert.equal(result.recommendations[0].counselorActions[0].changeType, 'continued');
});


function partialFixture() {
  const response = JSON.parse(JSON.stringify(modelResult));
  response.recommendations[0].intervention = 'Planning and additional technique';
  response.recommendations[0].rationale = 'Use both activities.';
  response.recommendations[0].counselorActions.push({ action: 'Use an unsupported additional technique.', referenceNumbers: [1] });
  return response;
}
function recoveryReview(call, data) {
  return { consistency: { aligned: true, problemFields: [] }, reviews: data.actions.map((action, index) => ({
    actionIndex: action.actionIndex, changeType: 'new', previousActionQuote: '',
    citations: action.citations.map(citation => ({ referenceNumber: citation.referenceNumber,
      support: call === 1 && index === 1 ? 'background' : 'direct', quote: citation.passage })),
  })) };
}

test('one complete corrective retry reconciles every field using supported actions only', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  const initial = partialFixture();
  const corrected = JSON.parse(JSON.stringify(modelResult));
  corrected.goal = 'Help the student establish manageable routines for completing responsibilities.';
  corrected.followUpPlan = 'Evaluate task completion, response to planning, barriers, and adjustments needed.';
  corrected.recommendations[0].rationale = 'Planning addresses the documented implementation barriers.';
  const before = JSON.stringify({ initial, corrected, data });
  const flow = pipeline('development', [initial, corrected], [chunk], recoveryReview);
  const result = await flow.generate(data);
  assert.equal(result.status, 'ok');
  assert.equal(result.consistencyStatus, 'corrected_and_validated');
  assert.equal(result.correctiveRetryOccurred, true);
  assert.deepEqual(flow.calls(), { generationCalls: 2, evidenceCalls: 2 });
  assert.equal(result.goal, corrected.goal);
  assert.equal(result.followUpPlan, corrected.followUpPlan);
  assert.equal(result.recommendations[0].intervention, 'Planning');
  assert.equal(result.recommendations[0].rationale, corrected.recommendations[0].rationale);
  assert.equal(result.recommendations[0].counselorActions.length, 1);
  assert.equal(result.recommendations[0].counselorActions[0].action, 'Plan tasks.');
  assert.deepEqual(Array.from(result.recommendations[0].counselorActions[0].references, item => item.referenceNumber), [1]);
  assert.ok(!JSON.stringify(result).includes('unsupported additional technique'));
  assert.equal(JSON.stringify({ initial, corrected, data }), before);
  const request = flow.request().body.prompt;
  assert.match(request, /CORRECTIVE_RETRY_ONLY/);
  for (const value of ['CURRENT_DEADLINE_DIFFICULTIES', 'PREVIOUS_ACTION', 'No Noticeable Change', 'PROPOSED_WEEKLY_PLANNING', chunk.content]) assert.ok(request.includes(value));
  const recovery = flow.logs.find(entry => entry[0].includes('recovery'))[1];
  assert.equal(recovery.initialGeneratedActions, 2);
  assert.equal(recovery.initialPassingActions, 1);
  assert.equal(recovery.initialRejectedActions, 1);
  assert.equal(recovery.correctiveRetryOccurred, true);
  assert.equal(recovery.finalOutcome, 'ok');
  assert.ok(recovery.failureCategories.includes('background_only'));
  assert.ok(!JSON.stringify(flow.logs).includes('CURRENT_DEADLINE_DIFFICULTIES'));
});

test('unsupported duplicate entries reconcile deterministically without another generation', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  const response = JSON.parse(JSON.stringify(modelResult));
  response.recommendations[0].counselorActions.push({ ...response.recommendations[0].counselorActions[0] });
  const flow = pipeline('test', response, [chunk], recoveryReview);
  const result = await flow.generate(data);
  assert.equal(result.status, 'ok');
  assert.equal(result.consistencyStatus, 'duplicate_reconciled');
  assert.equal(result.correctiveRetryOccurred, false);
  assert.equal(result.recommendations[0].counselorActions.length, 1);
  assert.equal(result.goal, response.goal);
  assert.equal(result.followUpPlan, response.followUpPlan);
  assert.deepEqual(flow.calls(), { generationCalls: 1, evidenceCalls: 1 });
});

test('no supported actions stops without corrective generation', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  const review = { consistency: { aligned: true, problemFields: [] }, reviews: [{ actionIndex: 0, changeType: 'new', citations: [{ referenceNumber: 1, support: 'insufficient', quote: '' }] }] };
  const flow = pipeline('development', modelResult, [chunk], review);
  const result = await flow.generate(data);
  assert.equal(result.status, 'insufficient_reference_material');
  assert.equal(result.correctiveRetryOccurred, false);
  assert.equal(result.recommendations.length, 0);
  assert.deepEqual(flow.calls(), { generationCalls: 1, evidenceCalls: 1 });
});

test('corrective retry cannot resurrect rejected activities, duplicate actions, or invent citations', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  for (const mode of ['resurrect', 'duplicate', 'citation', 'malformed']) {
    const corrected = JSON.parse(JSON.stringify(modelResult));
    if (mode === 'resurrect') corrected.recommendations[0].counselorActions[0].action = 'Use an unsupported additional technique.';
    if (mode === 'duplicate') corrected.recommendations[0].counselorActions.push({ ...corrected.recommendations[0].counselorActions[0] });
    if (mode === 'citation') corrected.recommendations[0].counselorActions[0].referenceNumbers = [99];
    const flow = pipeline('test', [partialFixture(), mode === 'malformed' ? '{' : corrected], [chunk], recoveryReview);
    const result = await flow.generate(data);
    assert.equal(result.correctiveRetryOccurred, true);
    assert.notEqual(result.status, 'ok');
    assert.equal(result.recommendations.length, 0);
    assert.equal(flow.calls().generationCalls, 2);
    assert.equal(flow.calls().evidenceCalls, 1);
  }
});

test('corrected summary consistency and citations are reviewed again without a third generation', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  for (const mode of ['inconsistent', 'unsupported', 'unverified-consistency']) {
    const review = (call, input) => {
      const result = recoveryReview(call, input);
      if (call === 2) {
        if (mode === 'inconsistent') result.consistency = { aligned: false, problemFields: ['followUpPlan', 'intervention'] };
        if (mode === 'unsupported') result.reviews[0].citations[0].quote = 'Invented supporting quote, absent from passage.';
        if (mode === 'unverified-consistency') delete result.consistency;
      }
      return result;
    };
    const flow = pipeline('test', [partialFixture(), modelResult], [chunk], review);
    const result = await flow.generate(data);
    assert.notEqual(result.status, 'ok');
    assert.equal(result.recommendations.length, 0);
    assert.deepEqual(flow.calls(), { generationCalls: 2, evidenceCalls: 2 });
  }
});

test('corrective output suggests only PDFs and evidence cited by the final supported actions', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  const chunks = [
    { ...chunk, metadata: { ...chunk.metadata, resourceId: '012345678901234567890123', resourceType: 'handout', title: 'Supported planning handout' } },
    { ...chunk, content: 'Background information only.', metadata: { ...chunk.metadata, resourceId: '112345678901234567890123', resourceType: 'worksheet', title: 'Rejected activity worksheet' } },
  ];
  const initial = partialFixture();
  initial.recommendations[0].counselorActions[1].referenceNumbers = [2];
  initial.recommendations[0].supportingResource = { referenceNumber: 2 };
  const flow = pipeline('test', [initial, modelResult], chunks, recoveryReview);
  const result = await flow.generate(data);
  assert.equal(result.status, 'ok');
  assert.deepEqual(require('../services/suggestedMaterials').collectSuggestedMaterials(result.recommendations).map(item => item.title), ['Supported planning handout']);
  assert.deepEqual(Array.from(result.retrievedReferences, item => item.title), ['Supported planning handout']);
  assert.ok(!JSON.stringify(result).includes('Rejected activity worksheet'));
});


test('supported citations with an inconsistent summary get one complete correction rather than an unchecked save', async () => {
  const data = { ...helpers.original(record), ...helpers.progress(record) };
  const review = (call, input) => {
    const result = recoveryReview(call, input);
    if (call === 1) result.consistency = { aligned: false, problemFields: ['followUpPlan'] };
    return result;
  };
  const corrected = { ...modelResult, followUpPlan: 'Evaluate completion of planned tasks, observed barriers, and changes needed.' };
  const flow = pipeline('development', [modelResult, corrected], [chunk], review);
  const result = await flow.generate(data);
  assert.equal(result.status, 'ok');
  assert.equal(result.correctiveRetryOccurred, true);
  assert.equal(result.followUpPlan, corrected.followUpPlan);
  assert.deepEqual(flow.calls(), { generationCalls: 2, evidenceCalls: 2 });
  const metadata = flow.logs.find(entry => entry[0].includes('recovery'))[1];
  assert.equal(metadata.initialPassingActions, 1);
  assert.equal(metadata.initialRejectedActions, 0);
  assert.ok(metadata.failureCategories.includes('consistency_check_failed'));
});
