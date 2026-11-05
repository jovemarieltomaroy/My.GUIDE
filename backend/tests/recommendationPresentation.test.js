const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../../frontend/src/pages/LLMRecommendationsPage.jsx'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function displayFollowUp(')) + '\nthis.display=displayFollowUp;', context);

test('legacy redundant follow-up copies are hidden without mutating historical recommendations', () => {
  const record = { timeSpan: 'Follow-up in 1 week', followUpPlan: 'Counselor-documented schedule: Follow-up in 1 week', progressContextSnapshot: { latestProgress: { timeSpan: 'Follow-up in 1 week' } } };
  const before = JSON.stringify(record);
  assert.match(context.display(record), /No follow-up evaluation plan was saved/);
  assert.equal(JSON.stringify(record), before);
  assert.match(context.display({ timeSpan: 'One week', followUpPlan: 'One week' }), /No follow-up evaluation plan was saved/);
});

test('evaluation activities and unscheduled follow-up suggestions remain visible', () => {
  const evaluation = 'Evaluate progress, response to new activities, and implementation barriers.';
  assert.equal(context.display({ timeSpan: 'One week', followUpPlan: evaluation }), evaluation);
  assert.equal(context.display({ followUpPlan: evaluation }), evaluation);
  assert.match(context.display({}), /No follow-up evaluation plan was saved/);
});

test('evidence labels distinguish unassessed, automated direct support, and actual warnings', () => {
  const status = vm.runInContext('evidenceSupportPresentation', context);
  const historical = { references: [{ referenceNumber: 1 }] };
  const before = JSON.stringify(historical);
  assert.match(status(historical).label, /No automated passage-support assessment recorded/);
  assert.equal(status(historical).warning, false);
  assert.match(status(historical).detail, /not a finding/);
  assert.equal(JSON.stringify(historical), before);
  assert.match(status({ evidenceStatus: 'direct-support' }).label, /Automated support check: direct/);
  assert.equal(status({ evidenceStatus: 'direct-support' }).warning, false);
  assert.match(status({ evidenceStatus: 'direct-support' }).detail, /not clinical verification/);
  assert.match(status({ evidenceStatus: 'direct-support', evidenceNeedsReview: true }).label, /partial/);
  assert.equal(status({ evidenceStatus: 'direct-support', evidenceNeedsReview: true }).warning, true);
  assert.equal(status({ evidenceStatus: 'background' }).warning, true);
  assert.equal(status({ evidenceStatus: 'insufficient' }).warning, true);
});

test('new generation from an old runtime cannot silently show success', () => {
  const issue = vm.runInContext('generationOutputIssue', context);
  const valid = { outputContractVersion: 'goal-followup-v3', goal: 'Help the student organize responsibilities and build manageable routines.', followUpPlan: 'Evaluate progress, activity response, and barriers at the next session.' };
  assert.equal(issue(valid), '');
  assert.match(issue({ ...valid, outputContractVersion: undefined }), /Restart the backend/);
  assert.match(issue({ ...valid, followUpPlan: '' }), /missing a usable goal or follow-up/);
  assert.match(issue({ ...valid, goal: 'Support the student through appropriate interventions including Planning.' }), /missing a usable goal or follow-up/);
  assert.equal(context.display(valid), valid.followUpPlan);
});

test('runtime preflight checks the configured backend and blocks generation before any POST on stale output', async () => {
  const runtime = vm.createContext({ URL });
  vm.runInContext(source.slice(source.indexOf('function displayFollowUp(')) + '\nthis.check=assertCurrentRecommendationRuntime;', runtime);
  let generationCalls = 0;
  const staleFetch = async (url, options) => {
    assert.equal(url, 'http://localhost:5000/api/recommendation-runtime');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.method, undefined);
    return { ok: true, json: async () => ({}) };
  };
  const attempt = async () => {
    await runtime.check(staleFetch, 'http://localhost:5000/api', 'http://localhost:5174/llm-recommendations');
    generationCalls++;
  };
  await assert.rejects(attempt(), /Generation has not started and no draft was saved/);
  assert.equal(generationCalls, 0);
  await runtime.check(async () => ({ ok: true, json: async () => ({ recommendationOutputVersion: 'goal-followup-v3' }) }), 'http://localhost:5000/api', 'http://localhost:5174/');
  await assert.rejects(runtime.check(async () => { throw new Error('offline'); }, '/api', 'http://localhost:5000/'), /Could not verify/);
  await assert.rejects(runtime.check(async () => ({ status: 404, json: async () => { throw new SyntaxError('HTML response'); } }), '/api', 'http://localhost:5174/'), /Restart the backend/);
});

test('runtime preflight preserves relative and proxy API prefixes', async () => {
  const runtime = vm.createContext({ URL });
  vm.runInContext(source.slice(source.indexOf('function displayFollowUp(')) + '\nthis.check=assertCurrentRecommendationRuntime;', runtime);
  let address;
  await runtime.check(async (url) => { address = url; return { ok: true, json: async () => ({ recommendationOutputVersion: 'goal-followup-v3' }) }; }, '/myguide/api/', 'http://localhost:5000/llm-recommendations');
  assert.equal(address, 'http://localhost:5000/myguide/api/recommendation-runtime');
});

test('existing plans identify a separate pending updated draft without changing history', () => {
  const planSource = fs.readFileSync(require.resolve('../../frontend/src/pages/InterventionPlansPage.jsx'), 'utf8');
  const runtime = vm.createContext({});
  vm.runInContext(planSource.slice(planSource.indexOf('function pendingUpdatedRecommendation(')) + '\nthis.pending=pendingUpdatedRecommendation;', runtime);
  const plan = { _id: 'approved', approvalStatus: 'Approved', goal: 'Original saved goal', followUpPlan: '' };
  const record = { interventionPlans: [plan], progressNotes: [{ _id: 'note', progressSummary: 'Saved progress' }], llmRecommendations: [
    { _id: 'earlier', recommendationType: 'updated', previousPlanId: 'approved', status: 'Draft', createdAt: '2026-10-21' },
    { _id: 'latest', recommendationType: 'updated', previousPlanId: 'approved', status: 'Draft', createdAt: '2026-10-22' },
    { _id: 'other', recommendationType: 'updated', previousPlanId: 'unrelated', status: 'Draft', createdAt: '2026-10-23' },
    { _id: 'rejected', recommendationType: 'updated', previousPlanId: 'approved', status: 'Rejected', createdAt: '2026-10-24' },
  ] };
  const before = JSON.stringify(record);
  assert.equal(runtime.pending(record, plan)._id, 'latest');
  assert.equal(runtime.pending({ llmRecommendations: [] }, plan), null);
  assert.equal(JSON.stringify(record), before);
});
