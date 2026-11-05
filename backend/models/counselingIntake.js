const mongoose = require("mongoose");
const Form = require("./preCounselingForm");
const schema = new mongoose.Schema(
  {
    identity: {
      studentIdNumber: { type: String, required: true, trim: true, uppercase: true },
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      },
      college: { type: String, required: true, trim: true },
      program: { type: String, trim: true, default: "" },
      yearLevel: {
        type: String,
        required: true,
        enum: ["1", "2", "3", "4", "5", "Graduate", "Other"],
      },
      contactNumber: { type: String, trim: true, default: "" },
    },
    entryType: { type: String, enum: ["Walk-in", "Scheduled"], required: true },
    status: {
      type: String,
      enum: ["Awaiting Submission", "Pending Review", "Converted to Case", "Declined", "Cancelled"],
      default: "Pending Review",
      index: true,
    },
    appointmentStatus: {
      type: String,
      enum: ["Unassigned", "Booked", "Completed", "Cancelled", "Needs Rescheduling"],
      default: "Unassigned",
    },
    assignedCounselor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    slot: { type: mongoose.Schema.Types.ObjectId, ref: "CounselorSlot", default: null },
    reservationActive: { type: Boolean, default: false },
    preferredAt: Date,
    consent: Form.schema.obj.consent,
    backgroundAndPsychosocialHistory: Form.schema.obj.backgroundAndPsychosocialHistory,
    legacyForm: { type: mongoose.Schema.Types.ObjectId, ref: "PreCounselingForm" },
    linkedCase: { type: mongoose.Schema.Types.ObjectId, ref: "CaseRecord", default: null },
    token: { type: String, select: false },
    tokenExpiresAt: Date,
    submittedAt: Date,
    history: [
      {
        action: String,
        actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);
schema.index({ slot: 1 }, { unique: true, partialFilterExpression: { reservationActive: true } });
schema.index({ linkedCase: 1 });
schema.index(
  { legacyForm: 1 },
  { unique: true, partialFilterExpression: { legacyForm: { $type: "objectId" } } }
);
module.exports = mongoose.model("CounselingIntake", schema);
