const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    counselor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    source: { type: String, enum: ["Default", "Custom"], default: "Custom" },
    isBlocked: { type: Boolean, default: false },
    // Incremented inside booking transactions to serialize scheduling with availability changes.
    revision: { type: Number, default: 0 },
  },
  { timestamps: true }
);
schema.index({ counselor: 1, startsAt: 1 }, { unique: true });
module.exports = mongoose.model("CounselorSlot", schema);
