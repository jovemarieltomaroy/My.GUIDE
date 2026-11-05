const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  challengeHash: { type: String, required: true, unique: true },
  studentIdHash: { type: String, required: true, index: true },
  ipHash: { type: String, required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  verifiedAt: { type: Date, default: null },
  confirmationHash: { type: String, default: null },
  consumedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, expires: 0 },
});

module.exports = mongoose.model("BookingIdentityChallenge", schema);
