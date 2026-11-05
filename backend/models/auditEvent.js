const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  target: String,
  outcome: { type: String, required: true },
}, { timestamps: true });
schema.index({ createdAt: -1 });
module.exports = mongoose.model('AuditEvent', schema);
