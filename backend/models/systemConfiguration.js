const mongoose = require('mongoose');
module.exports = mongoose.model('SystemConfiguration', new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  organizationName: { type: String, default: 'My.GUIDE', maxlength: 120 },
}, { timestamps: true }));
