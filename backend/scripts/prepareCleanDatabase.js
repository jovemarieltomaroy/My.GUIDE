/* Manual opt-in tool. Never imported by server startup. Does not load .env. */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('node:fs/promises');
const { MongoClient } = require('mongodb');
const models = ['user', 'student', 'case', 'preCounselingForm', 'counselingIntake', 'counselorSlot', 'knowledgeResource', 'knowledgeChunk', 'auditEvent', 'systemConfiguration']
  .map(name => require(`../models/${name}`));
const User = require('../models/user');
const Configuration = require('../models/systemConfiguration');
const KnowledgeChunk = require('../models/knowledgeChunk');
const manifestPath = process.env.VECTOR_INDEX_MANIFEST || './vector-index-manifest.json';
function validateTarget(uri, confirmation) {
  const parsed = new URL(uri);
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
      parsed.pathname !== '/myguide_clean' || confirmation !== 'myguide_clean')
    throw new Error('Use a local URI explicitly naming /myguide_clean and CONFIRM_CLEAN_DATABASE=myguide_clean.');
}
function validateManifest(indexes) {
  const name = process.env.VECTOR_INDEX_NAME || 'knowledge_vector_index';
  const index = indexes.find(item => item.name === name && item.type === 'vectorSearch');
  if (!index || !index.definition?.fields?.some(field => field.type === 'vector' && field.path === 'embedding' && field.numDimensions === 768))
    throw new Error(`Manifest must include ${name}, a vectorSearch index on embedding with 768 dimensions for EmbeddingGemma.`);
  return indexes;
}
async function exportIndexes() {
  if (!process.env.SOURCE_MONGO_URI) throw new Error('SOURCE_MONGO_URI is required.');
  const client = new MongoClient(process.env.SOURCE_MONGO_URI);
  try {
    await client.connect();
    const indexes = await client.db().collection(KnowledgeChunk.collection.name).listSearchIndexes().toArray();
    const definitions = indexes.map(index => ({ name: index.name, type: index.type, definition: index.latestDefinition }));
    validateManifest(definitions);
    await fs.writeFile(manifestPath, JSON.stringify(definitions, null, 2), { flag: 'wx', mode: 0o600 });
    console.log('Exported source search definitions without modifying the source database.');
  } finally { await client.close(); }
}
async function initialize() {
  validateTarget(process.env.CLEAN_MONGO_URI, process.env.CONFIRM_CLEAN_DATABASE);
  const indexes = validateManifest(JSON.parse(await fs.readFile(manifestPath, 'utf8')));
  const email = (process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || '';
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 16 || Buffer.byteLength(password) > 72)
    throw new Error('Supply SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD (at least 16 characters, at most 72 UTF-8 bytes).');
  await mongoose.connect(process.env.CLEAN_MONGO_URI, { autoCreate: false, autoIndex: false });
  try {
    if (mongoose.connection.name !== 'myguide_clean') throw new Error('Unexpected database.');
    const collections = await mongoose.connection.db.listCollections().toArray();
    const allowed = new Set(models.map(model => model.collection.name));
    // Validate all existing documents BEFORE creating any indexes or records.
    for (const collection of collections) {
      if (!allowed.has(collection.name)) throw new Error(`Unexpected collection: ${collection.name}`);
      if ([User.collection.name, Configuration.collection.name].includes(collection.name)) continue;
      if (await mongoose.connection.db.collection(collection.name).countDocuments({}))
        throw new Error(`Target is populated: ${collection.name}. Refusing initialization.`);
    }
    const users = await User.find().select('email role isActive').lean();
    if (users.length && (users.length !== 1 || users[0].role !== 'Super-Admin' || users[0].email !== email || !users[0].isActive))
      throw new Error('Target users do not match the single initial Super Admin.');
    const configs = await Configuration.find().lean();
    if (configs.some(config => config.key !== 'application')) throw new Error('Unexpected system configuration.');
    for (const model of models) {
      if (!collections.some(collection => collection.name === model.collection.name)) await model.createCollection();
      await model.createIndexes(); // additive only; never syncIndexes/dropIndexes
    }
    const existing = await KnowledgeChunk.collection.listSearchIndexes().toArray();
    for (const index of indexes) {
      const current = existing.find(item => item.name === index.name);
      if (current && JSON.stringify(current.latestDefinition) !== JSON.stringify(index.definition))
        throw new Error(`Existing search index differs: ${index.name}. Review manually.`);
      if (!current) await KnowledgeChunk.collection.createSearchIndex(index);
    }
    await Configuration.updateOne({ key: 'application' }, { $setOnInsert: { organizationName: 'My.GUIDE' } }, { upsert: true });
    if (!users.length) await User.create({ email, password: await bcrypt.hash(password, 10), role: 'Super-Admin',
      firstName: 'System', lastName: 'Administrator', profileCompleted: true, mustChangePassword: false });
    console.log('Initialized myguide_clean. One Super Admin; no clinical or knowledge records. Search indexing is asynchronous; verify queryable before use.');
  } finally { await mongoose.disconnect(); }
}
if (require.main === module) {
  const action = process.argv[2];
  (action === 'export-indexes' ? exportIndexes() : action === 'initialize' ? initialize() :
    Promise.reject(new Error('Usage: node scripts/prepareCleanDatabase.js export-indexes|initialize')))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { validateTarget, validateManifest };
