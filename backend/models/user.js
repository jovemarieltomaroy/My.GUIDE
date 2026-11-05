const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      default: "",
    },
    middleName: {
      type: String,
      default: "",
    },
    lastName: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    designation: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["Super-Admin", "Counselor-Admin", "Counselor-User"],
      default: "Counselor-User",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    password: {
      type: String,
      required: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
    profilePicture: {
      type: String,
      default: null,
    },
    instituteIdNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    availability: {
      status: { type: String, enum: ["Available", "On Leave", "Absent", "Unavailable"], default: "Available" },
      from: Date,
      until: Date,
      reason: { type: String, default: "" },
    },
    schedulingRevision: { type: Number, default: 0 },
    collegesHandled: {
      type: [String],
      default: [],
    },
    contactNumber: {
      type: String,
      default: "",
    },
    dateJoinedAsCounselor: {
      type: Date,
      default: "",
    },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 }, { unique: true, partialFilterExpression: { role: "Super-Admin" }, name: "one_super_admin" });

module.exports = mongoose.model("User", userSchema);
