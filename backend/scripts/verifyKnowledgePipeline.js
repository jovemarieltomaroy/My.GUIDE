// Live verification: synthetic fixtures only; cleanup is restricted to their captured IDs.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const mongoose = require('mongoose');
const Resource = require('../models/knowledgeResource');
const Chunk = require('../models/knowledgeChunk');
const { uploadKnowledgeResource } = require('../controllers/knowledgeBaseController');
const { retrieveRelevantChunks, filterEligibleChunks } = require('../services/rag/retrievalService');
const { generateInterventionRecommendations } = require('../services/rag/interventionRecommendationService');
const { buildInterventionPrompt } = require('../services/rag/promptBuilderService');
const query = 'Academic stress worksheet assignments deadlines manageable tasks ten minute study plan slow breathing balanced alternative thoughts';
const created = [];
const marker = `RAG verification ${Date.now()}`;
const fixture = path.resolve(__dirname, '../tests/fixtures/academic-stress-worksheet.pdf');
const user = { _id: new mongoose.Types.ObjectId(), role: 'Counselor-Admin' };
let timer;
(async () => {
 try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  timer = setInterval(() => console.log('Verification is still running against configured services…'), 30000);
  for (const type of ['reference', 'worksheet', 'handout']) {
   const title = `${marker} ${type}`;
   const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
   await uploadKnowledgeResource({ user, params: {}, body: { title, resourceType: type, topic: 'Academic stress', status: 'Active' }, file: { path: fixture, originalname: 'academic-stress-worksheet.pdf', filename: 'academic-stress-worksheet.pdf', mimetype: 'application/pdf' } }, res);
   const record = await Resource.findOne({ title });
   if (record) created.push(record._id);
   assert.equal(res.code, 201, res.body?.error || res.body?.message);
   assert.equal(record.processingStatus, 'Ready');
   const passages = await Chunk.find({ 'metadata.resourceId': String(record._id) }).lean();
   assert.ok(passages.length > 0);
   assert.ok(passages.every(p => p.embedding.length === 768 && p.metadata.title === title && p.metadata.resourceType === type && p.metadata.pageNumber === 1));
   console.log(`PASS upload, extraction, chunking, EmbeddingGemma and MongoDB storage: ${type}`);
  }
  for (const resource of await Resource.find({ _id: { $in: created } }).lean()) {
   let found = false;
   for (let attempt = 0; attempt < 20; attempt++) {
    const results = await retrieveRelevantChunks(query, { limit: 30, numCandidates: 200, resourceTypes: [resource.resourceType] });
    if (results.some(p => p.metadata.resourceId === String(resource._id))) { found = true; break; }
    await new Promise(resolve => setTimeout(resolve, 2000));
   }
   assert.ok(found, `New ${resource.resourceType} fixture was not returned by Atlas vector search.`);
   console.log(`PASS Atlas vector retrieval and source type: ${resource.resourceType}`);
  }
  const caseData = { currentPresentation: 'Student feels overwhelmed by academic deadlines and struggles to start assignments.', problemAssessment: 'Academic stress and avoidance of manageable study tasks.', caseFormulation: 'Counselor-guided task planning, breathing practice and reviewing balanced thoughts may help.' };
  const generated = await generateInterventionRecommendations(caseData, { retrievalQuery: query, limit: 5, numCandidates: 100, numPredict: 2400 });
  assert.equal(generated.status, 'ok', generated.reason);
  assert.ok(generated.recommendations.length > 0);
  assert.ok(generated.retrievedReferences.every(ref => ref.title && ['reference', 'worksheet', 'handout'].includes(ref.resourceType) && ref.pageNumber >= 1));
  console.log(`PASS configured Gemma generation: ${generated.recommendations.length} grounded recommendation(s), ${generated.retrievedReferences.length} source references`);
  const reference = await Resource.findById(created[0]);
  const passages = await Chunk.find({ 'metadata.resourceId': String(reference._id) }).lean();
  for (const status of ['Under Review', 'Obsolete']) {
   await Resource.updateOne({ _id: reference._id }, { $set: { status } });
   assert.equal((await filterEligibleChunks(passages)).length, 0);
   const remaining = await retrieveRelevantChunks(query, { limit: 30, numCandidates: 200 });
   assert.ok(!remaining.some(p => p.metadata.resourceId === String(reference._id)));
   assert.ok(!buildInterventionPrompt(caseData, remaining).includes(reference.title));
   assert.equal(await Chunk.countDocuments({ 'metadata.resourceId': String(reference._id) }), passages.length);
   await fs.access(fixture);
   console.log(`PASS ${status} excluded from vector results and prompt; PDF and embeddings retained`);
  }
 } catch (error) { console.error('VERIFICATION FAILED: ' + error.message); process.exitCode = 1; }
 finally {
  clearInterval(timer);
  if (created.length) {
   await Chunk.deleteMany({ 'metadata.resourceId': { $in: created.map(String) } });
   await Resource.deleteMany({ _id: { $in: created } });
   console.log(`Removed ${created.length} synthetic verification resources and their test passages; existing resources untouched.`);
  }
  await mongoose.disconnect();
 }
})();
