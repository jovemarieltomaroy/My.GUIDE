const express = require("express");

const router = express.Router();

const {
  getPublicPreCounselingForm,
} = require("../controllers/preCounselingController");

const { protect, counselorOnly } = require("../middleware/authValidator");

/*
 * =========================================================
 * PUBLIC ROUTES
 * =========================================================
 *
 * These routes are accessed through the secure token
 * sent to the student's email.
 *
 * The student does NOT need a My.GUIDE account.
 */

router.get("/public/:token", getPublicPreCounselingForm);

router.post("/public/:token/submit", (req, res) => res.status(410).json({ message: "Please reopen your form link to use the booking intake workflow." }));

/*
 * =========================================================
 * COUNSELOR ROUTES
 * =========================================================
 *
 * These require a logged-in My.GUIDE counselor.
 */

router.post("/send", protect, counselorOnly, (req, res) => res.status(410).json({ message: "Send private invitations from Intakes & Bookings." }));

router.get("/student/:studentId/latest", protect, counselorOnly, (req, res) => res.status(410).json({ message: "Review the specific intake in Intakes & Bookings instead of importing by student." }));

module.exports = router;
