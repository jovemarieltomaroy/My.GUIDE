// Read-only local audit; never prints narratives or full prompts/responses.
require('dotenv').config({quiet:true});
const mongoose=require('mongoose'),fs=require('node:fs'),vm=require('node:vm');
async function main(){
 await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:5000});
 const record=await require('../models/case').findOne({caseNumber:process.argv[2]||'CASE-2026-0005'}).lean();
 if(!record)throw Error('Audit case unavailable');
 const baseline = JSON.stringify({ plans: record.interventionPlans, notes: record.progressNotes, recommendations: record.llmRecommendations });
 let primaryOutput;
 const src=fs.readFileSync(require.resolve('../controllers/caseController'),'utf8'),ctx=vm.createContext({});
 vm.runInContext(src.slice(src.indexOf('const canManageRecommendations ='),src.indexOf('const generateLLMRecommendation ='))+'\nthis.build=buildRagCaseData;this.progress=buildProgressContext;this.query=buildRagRetrievalQuery;',ctx);
 const data={...ctx.build(record),...ctx.progress(record,{mode:'updated'})};
 const eligible=require('../services/resourceEligibility').isResourceEligible;
 console.log(JSON.stringify({eligibleResources:(await require('../models/knowledgeResource').find({}).lean()).filter(eligible).map(r=>({title:r.title,type:r.resourceType}))}));
 const old=(record.llmRecommendations||[]).filter(r=>r.recommendationType==='updated').at(-1);
 console.log(JSON.stringify({storedUpdatedDraft:!!old,storedHasProgressSnapshot:!!old?.progressContextSnapshot,storedSuggestedTitles:old?.suggestedInterventions,storedReferenceTitles:old?.retrievedSources?.map(r=>r.title),storedSuggestedPdfTitles:old?.suggestedMaterials?.map(r=>r.title),documentedScheduleAvailable:!!data.progressContext?.latestProgress?.timeSpan}));
 const ollama=require('../services/llm/ollamaService'),original=ollama.generateResponse;
 ollama.generateResponse=async(...args)=>{const raw=await original(...args);try{const p=JSON.parse(raw.replace(/^```json\s*/i,'').replace(/```\s*$/,'').trim());if(!args[0].startsWith("EVIDENCE_REVIEW_ONLY"))primaryOutput=p;console.log(JSON.stringify({rawValidJson:true,responseKind:args[0].startsWith("EVIDENCE_REVIEW_ONLY")?"evidence-review":args[0].includes("CORRECTIVE_RETRY_ONLY")?"correction":"generation",goalPopulated:typeof p.goal==="string"&&!!p.goal.trim(),followUpEvaluationPopulated:typeof p.followUpPlan==="string"&&!!p.followUpPlan.trim(),rawStatus:p.status,rawInterventionTitles:p.recommendations?.map(r=>r.intervention),rawHasUpdateAssessment:!!p.updateAssessment,rawCitations:p.recommendations?.map(r=>({supportingReference:r.supportingResource?.referenceNumber,actionReferenceNumbers:r.counselorActions?.map(a=>a.referenceNumbers)}))}));}catch{console.log(JSON.stringify({rawValidJson:false}));}return raw;};
 const originalFetch=global.fetch;global.fetch=(url,options={})=>originalFetch(url,{...options,signal:AbortSignal.timeout(180000)});
 const result=await require('../services/rag/interventionRecommendationService').generateInterventionRecommendations(data,{retrievalQuery:ctx.query(data),numPredict:3000});
 const after = await require('../models/case').findById(record._id).lean();
 const historyUnchanged = baseline === JSON.stringify({ plans: after.interventionPlans, notes: after.progressNotes, recommendations: after.llmRecommendations });
 console.log(JSON.stringify({historyUnchanged,goalFromDedicatedModelField:!!result.goal&&result.goal===primaryOutput?.goal?.trim(),followUpFromDedicatedModelField:!!result.followUpPlan&&result.followUpPlan===primaryOutput?.followUpPlan?.trim(),finalStatus:result.status,correctiveRetryOccurred:result.correctiveRetryOccurred,finalInterventionTitles:result.recommendations?.map(r=>r.intervention),warningCount:result.generationWarnings?.length||0,suggestedPdfTitles:require("../services/suggestedMaterials").collectSuggestedMaterials(result.recommendations).map(r=>r.title),validatedActionEvidence:result.recommendations?.flatMap(r=>r.counselorActions.map(a=>({changeType:a.changeType,referenceTitles:a.references.map(ref=>ref.title)}))),referenceTitlesAndScores:result.retrievedReferences?.map(r=>({title:r.title,score:r.score})),saved:false}));
}
main().catch(e=>{console.error(JSON.stringify({auditFailed:true,errorType:e.name}));process.exitCode=1;}).finally(()=>mongoose.disconnect());
