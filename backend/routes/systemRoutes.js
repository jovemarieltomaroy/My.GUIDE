const router = require('express').Router();
const mongoose = require('mongoose');
const { protect, superAdminOnly } = require('../middleware/authValidator');
const Configuration = require('../models/systemConfiguration');
const AuditEvent = require('../models/auditEvent');
const KnowledgeChunk = require('../models/knowledgeChunk');
router.use(protect, superAdminOnly);
router.get('/configuration', async (req, res) => {
  res.json(await Configuration.findOne({ key: 'application' }).lean());
});
router.put('/configuration', async (req, res) => {
  const name = req.body.organizationName;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120 ||
      Object.keys(req.body).some(key => key !== 'organizationName'))
    return res.status(400).json({ message: 'Provide only an organization name (1–120 characters).' });
  const event = await AuditEvent.create({ actor: req.user._id, action: 'configuration.update', outcome: 'attempted' });
  const config = await Configuration.findOneAndUpdate({ key: 'application' },
    { organizationName: name.trim() }, { upsert: true, new: true, runValidators: true });
  await AuditEvent.updateOne({ _id: event._id }, { outcome: 'succeeded' });
  res.json(config);
});
router.get('/maintenance', async (req, res) => {
  await AuditEvent.create({ actor: req.user._id, action: 'maintenance.inspect', outcome: 'succeeded' });
  const indexes = await KnowledgeChunk.collection.listSearchIndexes().toArray();
  res.json({ database: mongoose.connection.name, connected: mongoose.connection.readyState === 1,
    vectorIndexes: indexes.map(({ name, status, queryable }) => ({ name, status, queryable })),
    generationModel: process.env.OLLAMA_MODEL || 'gemma3:4b',
    embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'embeddinggemma' });
});
router.get('/audit', async (req, res) => res.json(await AuditEvent.find().sort({ createdAt: -1 }).limit(100).lean()));
module.exports = router;
