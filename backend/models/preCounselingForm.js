const mongoose = require("mongoose");

const familyMemberSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
    },

    age: {
      type: Number,
      min: 0,
    },

    relationship: {
      type: String,
      trim: true,
      required: true,
    },

    parentType: {
      type: String,
      enum: ["Biological", "Adoptive", "Step-parent", "Foster", "Guardian", "Not Applicable"],
      default: "Not Applicable",
    },

    isSignificantPerson: {
      type: Boolean,
      default: false,
    },

    remarks: {
      type: String,
      trim: true,
    },
  },
  {
    _id: true,
  }
);

const yesNoDescriptionSchema = new mongoose.Schema(
  {
    hasHistory: {
      type: Boolean,
      default: false,
    },

    description: {
      type: String,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

const preCounselingFormSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    tokenExpiresAt: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["Pending", "Submitted", "Expired"],
      default: "Pending",
      index: true,
    },

    consent: {
      hasConsent: {
        type: Boolean,
        default: false,
      },

      confidentialityAgreementAccepted: {
        type: Boolean,
        default: false,
      },

      dataPrivacyNoticeAccepted: {
        type: Boolean,
        default: false,
      },

      consentDate: {
        type: Date,
        default: null,
      },
    },

    backgroundAndPsychosocialHistory: {
      familyContext: {
        type: String,
        trim: true,
        default: "",
      },

      familyConstellation: {
        type: [familyMemberSchema],
        default: [],
      },

      familyConstellationComments: {
        type: String,
        trim: true,
        default: "",
      },

      academicContext: {
        type: String,
        trim: true,
        default: "",
      },

      peerSocialContext: {
        type: String,
        trim: true,
        default: "",
      },

      psychiatricCareHistory: {
        type: yesNoDescriptionSchema,
        default: () => ({
          hasHistory: false,
          description: "",
        }),
      },

      psychologicalTherapyHistory: {
        type: yesNoDescriptionSchema,
        default: () => ({
          hasHistory: false,
          description: "",
        }),
      },

      previousCounselingHistory: {
        type: yesNoDescriptionSchema,
        default: () => ({
          hasHistory: false,
          description: "",
        }),
      },

      medicalHistory: {
        type: yesNoDescriptionSchema,
        default: () => ({
          hasHistory: false,
          description: "",
        }),
      },

      familyMentalHealthHistory: {
        type: yesNoDescriptionSchema,
        default: () => ({
          hasHistory: false,
          description: "",
        }),
      },

      substanceUseHistory: {
        type: yesNoDescriptionSchema,
        default: () => ({
          hasHistory: false,
          description: "",
        }),
      },

      legalHistory: {
        type: yesNoDescriptionSchema,
        default: () => ({
          hasHistory: false,
          description: "",
        }),
      },
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    linkedCase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Case",
      default: null,
    },

    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

preCounselingFormSchema.index({
  student: 1,
  createdAt: -1,
});

module.exports = mongoose.model("PreCounselingForm", preCounselingFormSchema);
