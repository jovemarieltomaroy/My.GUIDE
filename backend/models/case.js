const mongoose = require("mongoose");

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

const interventionPlanSchema = new mongoose.Schema(
  {
    recommendationType: { type: String, enum: ["initial", "updated"], default: "initial" },
    scheduleSource: { type: String, enum: ["progress-note"] },
    sourceProgressNoteId: { type: mongoose.Schema.Types.ObjectId },
    previousPlanId: { type: mongoose.Schema.Types.ObjectId },
    sourceRecommendationId: { type: mongoose.Schema.Types.ObjectId },
    problem: {
      type: String,
      required: true,
      trim: true,
    },
    goal: {
      type: String,
      trim: true,
    },
    planOfAction: {
      type: String,
      required: true,
      trim: true,
    },
    timeSpan: {
      type: String,
      trim: true,
    },
    resources: [
      {
        title: {
          type: String,
          trim: true,
        },
        type: {
          type: String,
          enum: ["PDF", "Link", "Document", "Form", "Image", "Other"],
          default: "Other",
        },
        url: {
          type: String,
          trim: true,
        },
        description: {
          type: String,
          trim: true,
        },
        isProvidedToStudent: {
          type: Boolean,
          default: false,
        },
        providedAt: {
          type: Date,
        },
      },
    ],
    followUpPlan: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Planned", "Ongoing", "Completed", "Cancelled"],
      default: "Planned",
    },
    remarks: {
      type: String,
      trim: true,
    },
    approvalStatus: {
      type: String,
      enum: ["Pending Review", "Approved", "Revised", "Rejected"],
      default: "Pending Review",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    isSentToStudent: {
      type: Boolean,
      default: false,
    },
    sentAt: {
      type: Date,
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    sentToEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const progressNoteSchema = new mongoose.Schema(
  {
    noteDate: {
      type: Date,
      default: Date.now,
    },
    progressStatus: {
      type: String,
      enum: ["Improved", "No Progress", "Worsened", "Needs Follow-up"],
      default: "Needs Follow-up",
    },
    progressSummary: {
      type: String,
      required: true,
      trim: true,
    },
    actionTaken: {
      type: String,
      trim: true,
    },
    newPlanOfAction: {
      type: String,
      trim: true,
    },
    timeSpan: {
      type: String,
      trim: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    attendingCounselor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    interventionProgress: {
      interventionPlan: {
        type: mongoose.Schema.Types.ObjectId,
      },
      studentResponse: {
        type: String,
        enum: [
          "Positive Response",
          "Mixed Response",
          "No Noticeable Change",
          "Negative Response",
          "Not Assessed",
        ],
        default: "Not Assessed",
      },
      goalProgress: {
        type: String,
        enum: [
          "No Progress Observed",
          "Slight Progress",
          "Moderate Progress",
          "Goal Mostly Achieved",
          "Goal Achieved",
          "Not Assessed",
        ],
        default: "Not Assessed",
      },
      recommendedPlanAction: {
        type: String,
        enum: [
          "Continue Current Plan",
          "Continue With Adjustments",
          "Revise Intervention Plan",
          "Complete Intervention Plan",
          "Refer for Additional Support",
          "Not Decided",
        ],
        default: "Not Decided",
      },
      supportingNote: {
        type: String,
        trim: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

const actionHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        "Created",
        "Assigned",
        "Reassigned",
        "Updated",
        "Follow-up",
        "Closed",
        "Reopened",
        "Archived",
        "Restored",
        "Terminated",
        "Temporary Access Granted",
        "Temporary Access Revoked",
      ],
      required: true,
    },
    fromCounselor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    toCounselor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    remarks: {
      type: String,
      trim: true,
    },
    actionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actionDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
    timestamps: true,
  }
);

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

const followUpSchema = new mongoose.Schema(
  {
    followUpDate: {
      type: Date,
      required: true,
    },
    followUpType: {
      type: String,
      enum: [
        "Counseling Session",
        "Student Check-in",
        "Intervention Review",
        "Referral Follow-up",
        "Parent/Guardian Contact",
        "Academic Monitoring",
        "Other",
      ],
      required: true,
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
    },

    // This priority belongs to the individual follow-up,
    // not to the overall case.
    priority: {
      type: String,
      enum: ["Low", "Moderate", "High", "Urgent"],
      default: "Moderate",
    },
    status: {
      type: String,
      enum: ["Pending", "Completed", "Cancelled"],
      default: "Pending",
    },
    remarks: {
      type: String,
      trim: true,
    },
    completionRemarks: {
      type: String,
      trim: true,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    completedAt: {
      type: Date,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancelledAt: {
      type: Date,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reminderSentAt: {
      type: Date,
    },
    reminderSentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reminderSentTo: {
      type: String,
      trim: true,
      lowercase: true,
    },
    reminderSendCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const llmRecommendationSchema = new mongoose.Schema(
  {
    outputContractVersion: String,
    recommendationType: { type: String, enum: ["initial", "updated"], default: "initial" },
    scheduleSource: { type: String, enum: ["progress-note"] },
    sourceProgressNoteId: { type: mongoose.Schema.Types.ObjectId },
    previousPlanId: { type: mongoose.Schema.Types.ObjectId },
    progressContextSnapshot: { type: mongoose.Schema.Types.Mixed },
    updateAssessment: { type: mongoose.Schema.Types.Mixed },
    actionEvidence: [{
      action: String,
      changeType: { type: String, enum: ["continued", "adjusted", "new"] },
      changeReason: String,
      evidenceStatus: String,
      evidenceNeedsReview: Boolean,
      classificationNeedsReview: Boolean,
      references: [{ title: String, source: String, resourceType: String, pageNumber: Number, referenceNumber: Number }],
    }],
    generationWarnings: [String],
    generationMode: {
      type: String,
      enum: ["Mock", "LLM-RAG"],
      default: "Mock",
    },
    status: {
      type: String,
      enum: ["Draft", "Revised", "Accepted", "Rejected"],
      default: "Draft",
    },
    concernSummary: {
      type: String,
      required: true,
      trim: true,
    },
    goal: {
      type: String,
      required: true,
      trim: true,
    },
    suggestedInterventions: [
      {
        type: String,
        trim: true,
      },
    ],
    planOfAction: {
      type: String,
      required: true,
      trim: true,
    },
    timeSpan: {
      type: String,
      trim: true,
    },
    followUpPlan: {
      type: String,
      trim: true,
    },
    rationale: {
      type: String,
      trim: true,
    },
    suggestedMaterials: [
      {
        resourceId: { type: String, required: true },
        title: { type: String, required: true },
        resourceType: { type: String, enum: ["worksheet", "handout"], required: true },
        url: String,
        pageNumber: Number,
        interventions: [String],
      },
    ],
    retrievedSources: [
      {
        title: {
          type: String,
          trim: true,
        },
        sourceType: {
          type: String,
          trim: true,
        },
        reference: {
          type: String,
          trim: true,
        },
      },
    ],
    counselorRemarks: {
      type: String,
      trim: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    convertedPlanId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    resources: [
      {
        title: {
          type: String,
          trim: true,
        },
        type: {
          type: String,
          enum: ["PDF", "Document", "Image", "Other"],
          default: "Other",
        },
        url: {
          type: String,
          required: true,
          trim: true,
        },
        description: {
          type: String,
          trim: true,
        },
        isProvidedToStudent: {
          type: Boolean,
          default: false,
        },
        providedAt: {
          type: Date,
          default: null,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const temporaryCounselorAccessSchema = new mongoose.Schema(
  {
    counselor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    accessUntil: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    grantedAt: {
      type: Date,
      default: Date.now,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    revocationReason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: true,
    timestamps: false,
  }
);

const caseRecordSchema = new mongoose.Schema(
  {
    intake: { type: mongoose.Schema.Types.ObjectId, ref: "CounselingIntake", default: null },
    caseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    assignedCounselor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    caseStatus: {
      type: String,
      enum: ["Open", "In Progress", "For Follow-up", "Closed", "Terminated"],
      default: "Open",
    },

    /*
     * HOW THE STUDENT ENTERED THE COUNSELING WORKFLOW
     *
     * Walk-in:
     * Student came directly to the office.
     *
     * Referred:
     * Student was referred by faculty, staff, peer,
     * or another appropriate source.
     *
     * Scheduled:
     * Student already had a scheduled counseling session.
     */
    clientEntryType: {
      type: String,
      enum: ["Walk-in", "Referred", "Scheduled"],
      required: true,
      default: "Walk-in",
    },

    consent: {
      hasConsent: {
        type: Boolean,
        default: false,
      },
      consentDate: {
        type: Date,
        default: null,
      },
      confidentialityAgreementAccepted: {
        type: Boolean,
        default: false,
      },
      dataPrivacyNoticeAccepted: {
        type: Boolean,
        default: false,
      },
    },

    referralInformation: {
      referralSource: {
        type: String,
        enum: ["Walk-in", "Faculty-Referred", "Staff-Referred", "Student-Referred", "Other"],
        default: "Walk-in",
      },
      referredBy: {
        type: String,
        trim: true,
        default: "",
      },
      referralQuestion: {
        type: String,
        trim: true,
        default: "",
      },
      dateReferred: {
        type: Date,
        default: null,
      },
    },

    currentPresentation: {
      narrativeDescription: {
        type: String,
        required: true,
        trim: true,
      },
      behavioralObservations: {
        type: String,
        trim: true,
      },
      onset: {
        type: String,
        trim: true,
      },
      duration: {
        type: String,
        trim: true,
      },
      frequency: {
        type: String,
        trim: true,
      },
      intensity: {
        type: String,
        enum: ["Mild", "Moderate", "Severe"],
        default: "Moderate",
      },
    },

    problemAssessment: {
      mainDomain: {
        type: String,
        enum: ["Academic-Educational", "Career-Vocational", "Personal-Social", "Other"],
        required: true,
      },
      primaryProblems: [
        {
          type: String,
          required: true,
          trim: true,
        },
      ],
      secondaryProblems: [
        {
          type: String,
          trim: true,
        },
      ],
    },

    /*
     * caseFormulationFactors / 4Ps intentionally removed.
     *
     * The previous:
     * - predisposing
     * - precipitating
     * - perpetuating
     * - protective
     *
     * are no longer collected in the New Case workflow.
     */

    backgroundAndPsychosocialHistory: {
      familyContext: {
        type: String,
        trim: true,
      },

      familyConstellation: [familyMemberSchema],

      familyConstellationComments: {
        type: String,
        trim: true,
      },

      academicContext: {
        type: String,
        trim: true,
      },

      peerSocialContext: {
        type: String,
        trim: true,
      },

      psychiatricCareHistory: yesNoDescriptionSchema,

      psychologicalTherapyHistory: yesNoDescriptionSchema,

      previousCounselingHistory: yesNoDescriptionSchema,

      medicalHistory: yesNoDescriptionSchema,

      familyMentalHealthHistory: yesNoDescriptionSchema,

      substanceUseHistory: yesNoDescriptionSchema,

      legalHistory: yesNoDescriptionSchema,
    },

    mentalStatus: {
      grooming: {
        type: String,
        trim: true,
      },
      attire: {
        type: String,
        trim: true,
      },
      eyeContact: {
        type: String,
        trim: true,
      },
      activityLevel: {
        type: String,
        trim: true,
      },
      speechRate: {
        type: String,
        trim: true,
      },
      speechVolume: {
        type: String,
        trim: true,
      },
      speechFluency: {
        type: String,
        trim: true,
      },
      speechArticulation: {
        type: String,
        trim: true,
      },
      physicalPresentation: {
        type: String,
        trim: true,
      },
      moodAndAffect: {
        type: String,
        trim: true,
      },
      speech: {
        type: String,
        trim: true,
      },
      thoughtProcess: {
        type: String,
        trim: true,
      },
      orientation: {
        type: String,
        trim: true,
      },
      attentionAndConcentration: {
        type: String,
        trim: true,
      },
      riskIndicators: {
        type: String,
        trim: true,
      },
    },

    counselorNotes: { type: String, trim: true, default: "", maxlength: 20000 },
    caseFormulation: {
      counselorNotesSummary: { type: String, trim: true, default: "" },
      presentingProblem: {
        type: String,
        trim: true,
      },
      formulationNarrative: {
        type: String,
        trim: true,
      },
      aiSummary: {
        type: String,
        trim: true,
      },
      counselorAssessment: {
        type: String,
        trim: true,
      },
    },

    interventionPlans: [interventionPlanSchema],

    llmRecommendations: [llmRecommendationSchema],

    progressNotes: [progressNoteSchema],

    followUps: [followUpSchema],

    /*
     * Only one temporaryCounselor definition is retained.
     * The original schema contained this field twice.
     */
    temporaryCounselor: {
      type: [temporaryCounselorAccessSchema],
      default: [],
    },

    actionHistory: [actionHistorySchema],

    dateOpened: {
      type: Date,
      default: Date.now,
    },

    dateClosed: {
      type: Date,
    },

    closingRemarks: {
      type: String,
      trim: true,
    },

    terminatedAt: {
      type: Date,
    },

    terminationReason: {
      type: String,
      trim: true,
    },

    isArchived: {
      type: Boolean,
      default: false,
    },

    archivedAt: {
      type: Date,
    },

    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

caseRecordSchema.index({ intake: 1 }, { unique: true, partialFilterExpression: { intake: { $type: "objectId" } } });
module.exports = mongoose.model("CaseRecord", caseRecordSchema);
