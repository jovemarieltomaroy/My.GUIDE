const express = require("express");
const router = express.Router();

const { protect, adminOnly, counselorOnly } = require("../middleware/authValidator");

const uploadInterventionResources = require("../middleware/uploadInterventionResources");

const {
  getStudentActiveCase,
  getAllCases,
  getCaseById,
  getMyCases,
  createCase,
  updateCase,
  updateCaseStatus,
  assignCounselor,

  addProgressNotes,
  archiveCase,
  getArchivedCases,
  restoreCase,

  approveInterventionPlan,
  reviseInterventionPlan,
  rejectInterventionPlan,
  sendApprovedInterventionPlan,
  uploadInterventionPlanResources,

  getCaseTimeline,

  createFollowUp,
  updateFollowUp,
  completeFollowUp,
  cancelFollowUp,
  sendFollowUpReminder,

  generateLLMRecommendation,
  reviseLLMRecommendation,
  acceptLLMRecommendation,
  rejectLLMRecommendation,
  uploadLLMRecommendationResources,
} = require("../controllers/caseController");

router.use(protect, require("../middleware/caseOwnership"));

router.get("/student/:studentId/active", protect, getStudentActiveCase);

router.route("/").get(protect, adminOnly, getAllCases).post(protect, createCase);

router.get("/my-cases", protect, getMyCases);

router.get("/temporary-access", protect, (req, res) => res.json([]));

router.get("/archived", protect, adminOnly, getArchivedCases);

router.patch("/:id/status", protect, updateCaseStatus);

router.patch("/:id/assign-counselor", protect, counselorOnly, assignCounselor);
router.patch("/:id/transfer", protect, counselorOnly, assignCounselor);

router.post(
  "/:id/formulation/summary",
  protect,
  require("../controllers/formulationController").generateFormulationSummary
);

router.post("/:id/temporary-access", protect, (req, res) =>
  res
    .status(410)
    .json({
      message:
        "Temporary case access is no longer supported. Transfer the case permanently instead.",
    })
);

router.patch("/:id/temporary-access/:accessId/revoke", protect, (req, res) =>
  res.status(410).json({ message: "Temporary case access is no longer supported." })
);

router.post("/:id/progress-notes", protect, addProgressNotes);

router.patch("/:id/archive", protect, adminOnly, archiveCase);

router.patch("/:id/restore", protect, adminOnly, restoreCase);

router.patch("/:id/intervention-plans/:planId/approve", protect, approveInterventionPlan);

router.patch("/:id/intervention-plans/:planId/revise", protect, reviseInterventionPlan);

router.patch("/:id/intervention-plans/:planId/reject", protect, rejectInterventionPlan);

router.post("/:id/intervention-plans/:planId/send", protect, sendApprovedInterventionPlan);

router.post(
  "/:id/intervention-plans/:planId/resources",
  protect,
  uploadInterventionResources.array("files", 10),
  uploadInterventionPlanResources
);

router.get("/:id/timeline", protect, getCaseTimeline);

router.post("/:id/follow-ups", protect, createFollowUp);

router.patch("/:id/follow-ups/:followUpId", protect, updateFollowUp);

router.patch("/:id/follow-ups/:followUpId/complete", protect, completeFollowUp);

router.patch("/:id/follow-ups/:followUpId/cancel", protect, cancelFollowUp);

router.post("/:id/follow-ups/:followUpId/send-reminder", protect, sendFollowUpReminder);

router.post("/:id/llm-recommendations/generate", protect, generateLLMRecommendation);

router.patch("/:id/llm-recommendations/:recommendationId/revise", protect, reviseLLMRecommendation);

router.patch("/:id/llm-recommendations/:recommendationId/accept", protect, acceptLLMRecommendation);

router.patch("/:id/llm-recommendations/:recommendationId/reject", protect, rejectLLMRecommendation);

router.post(
  "/:id/llm-recommendations/:recommendationId/resources",
  protect,
  uploadInterventionResources.array("files", 10),
  uploadLLMRecommendationResources
);

router.route("/:id").get(protect, getCaseById).patch(protect, updateCase);

module.exports = router;
