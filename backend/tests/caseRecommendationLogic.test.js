const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CaseModel = require('../models/case');
const source = fs.readFileSync(require.resolve('../controllers/caseController'), 'utf8');
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const helpers = extract('const canManageRecommendations =', 'const generateLLMRecommendation =');
function context(extra = {}) {
  return vm.createContext({ ...extra });
}
test('admin recommendations require creator identity; assigned counselor retains access', () => {
  const ctx = context();
  vm.runInContext(helpers + '\nthis.allowed = canManageRecommendations;', ctx);
  const record = { createdBy: 'creator', assignedCounselor: 'assigned' };
  assert.equal(ctx.allowed(record, { _id: 'creator', role: 'Counselor-Admin' }), true);
  assert.equal(ctx.allowed(record, { _id: 'assigned', role: 'Counselor-Admin' }), false);
  assert.equal(ctx.allowed(record, { _id: 'assigned', role: 'Counselor-User' }), true);
  assert.equal(ctx.allowed(record, { _id: 'other', role: 'Counselor-User' }), false);
});
test('nested patches preserve existing observations and consent timestamp', () => {
  const originalConsentDate = new Date('2026-01-01');
  const foundCase = new CaseModel({ consent: { hasConsent: true, consentDate: originalConsentDate }, mentalStatus: { orientation: 'Oriented', grooming: 'Neat' } });
  const ctx = context({foundCase, req: {body: {mentalStatus: {grooming:'Updated'}, consent: {hasConsent:true}}}, Date});
  vm.runInContext(extract('    const originalConsentDate =', '    foundCase.updatedBy ='), ctx);
  assert.equal(foundCase.mentalStatus.orientation, 'Oriented');
  assert.equal(foundCase.mentalStatus.grooming, 'Updated');
  assert.equal(foundCase.consent.consentDate.getTime(), originalConsentDate.getTime());
});
test('generation passes labeled mental status and saves deduplicated selected PDFs', async () => {
  const foundCase = { _id:'case', createdBy:'admin', assignedCounselor:'admin', caseStatus:'Open', mentalStatus:{orientation:'Oriented'}, currentPresentation:{narrativeDescription:'Academic stress'}, backgroundAndPsychosocialHistory:{familyContext:'Supportive'}, llmRecommendations:[], actionHistory:[], async save(){this.saved=true;} };
  let options, data;
  const supportingResource = {resourceId:'012345678901234567890123',resourceType:'worksheet',title:'Worksheet'};
  const recommendation = {intervention:'Planning',rationale:'Relevant',counselorActions:[{action:'Review tasks'}],supportingResource};
  const ctx = context({Case:{findById:async()=>foundCase}, AsyncHandler:fn=>fn, generateInterventionRecommendations:async(d,o)=>{data=d;options=o;return {status:'ok',recommendations:[recommendation,recommendation,{...recommendation,supportingResource:{...supportingResource,resourceType:'reference',resourceId:'other'}}],retrievedReferences:[]};},populateRecommendationCase:async()=>foundCase});
  vm.runInContext(helpers + extract('const generateLLMRecommendation =','const reviseLLMRecommendation =')+'\nthis.generate=generateLLMRecommendation;',ctx);
  const res={status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await ctx.generate({params:{id:'case'},user:{_id:'admin',role:'Counselor-Admin'}},res);
  assert.equal(res.code,201);
  assert.match(options.retrievalQuery,/orientation: Oriented/);
  assert.match(options.retrievalQuery,/family Context: Supportive/);
  assert.match(data.mentalStatus,/orientation: Oriented/);
  assert.equal(foundCase.llmRecommendations[0].resources.length,1);
  assert.equal(foundCase.llmRecommendations[0].resources[0].url,'/api/knowledge-base/012345678901234567890123/pdf');
  assert.equal(foundCase.saved,true);
});
test('PDF preview permits linked counselors and denies unrelated counselors', async () => {
  const src = fs.readFileSync(require.resolve('../controllers/knowledgeBaseController'), 'utf8');
  const code = src.slice(src.indexOf('const viewKnowledgeResourcePdf ='), src.indexOf('const deleteKnowledgeResource ='));
  let linked = true, query;
  const ctx = context({ KnowledgeResource:{findById:async()=>({_id:'resource',filePath:'/tmp/sample.pdf',originalFileName:'sample.pdf'})}, Case:{exists:async q=>{query=q;return linked;}}, path:require('node:path'), fs:{access:async()=>{}}, console });
  vm.runInContext(code+'\nthis.preview=viewKnowledgeResourcePdf;',ctx);
  const response=()=>({status(code){this.code=code;return this;},json(body){this.body=body;return this;},setHeader(){},sendFile(file){this.file=file;return this;}});
  let res=response();
  await ctx.preview({params:{id:'resource'},user:{role:'Counselor-User',_id:'counselor'}},res);
  assert.equal(res.file,'/tmp/sample.pdf');
  assert.equal(query.$and[1].$or[0]['llmRecommendations.resources.url'],'/api/knowledge-base/resource/pdf');
  assert.equal(query.$and[0].$or[0].assignedCounselor,'counselor');
  linked=false;res=response();
  await ctx.preview({params:{id:'resource'},user:{role:'Counselor-User',_id:'other'}},res);
  assert.equal(res.code,403);
  assert.equal(res.file,undefined);
});
test('prompt includes mental status and referral information', () => {
  const {buildInterventionPrompt}=require('../services/rag/promptBuilderService');
  const prompt=buildInterventionPrompt({mentalStatus:'orientation: Oriented',referralInformation:'referral source: Faculty'},[{content:'Evidence',metadata:{title:'Reference'}}]);
  assert.match(prompt,/Mental Status:\norientation: Oriented/);
  assert.match(prompt,/Referral Information:\nreferral source: Faculty/);
});
test('early student-case check offers notes only for authorized active cases', async () => {
  let record = null, query;
  const ctx = context({Case:{findOne(q){query=q;return {select:async()=>record};}},AsyncHandler:fn=>fn,hasActiveTemporaryAccess:()=>false});
  vm.runInContext(helpers+extract('const getStudentActiveCase =','const createCase =')+'\nthis.check=getStudentActiveCase;',ctx);
  const req={params:{studentId:'012345678901234567890123'},user:{_id:'owner',role:'Counselor-User'}};
  const response=()=>({status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
  let res=response();await ctx.check(req,res);assert.equal(res.body.exists,false);
  assert.deepEqual(Array.from(query.caseStatus.$nin),['Closed','Terminated']);
  record={_id:'case',createdBy:'owner',assignedCounselor:'owner'};
  res=response();await ctx.check(req,res);assert.equal(res.body.canAddNotes,true);assert.equal(res.body.caseId,'case');
  req.user._id='other';res=response();await ctx.check(req,res);assert.equal(res.body.exists,true);assert.equal(res.body.canAddNotes,false);assert.equal(res.body.caseId,null);
});
