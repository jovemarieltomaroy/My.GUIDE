const express = require("express");
const router = express.Router();

const { protect, adminOnly } = require("../middleware/authValidator");

const {
  searchStudentByIdNumber,
  createMinimumStudentProfile,
  completeStudentProfile,
  updateStudent,
  getAllStudents,
  getStudentById,
  getIncompleteProfiles,
  archiveStudent,
  restoreStudent,
  updateEnrollmentStatus,
  getArchivedStudents,
} = require("../controllers/studentController");

router.get("/search/:studentIdNumber", protect, searchStudentByIdNumber);

router.post("/minimum-profile", protect, createMinimumStudentProfile);

router.get("/incomplete", protect, getIncompleteProfiles);

router.get("/archived", protect, adminOnly, getArchivedStudents);

router.get("/", protect, getAllStudents);

router.patch("/:id/complete-profile", protect, completeStudentProfile);

router.patch("/:id/enrollment-status", protect, updateEnrollmentStatus);

router.patch("/:id/archive", protect, adminOnly, archiveStudent);

router.patch("/:id/restore", protect, adminOnly, restoreStudent);

router.route("/:id").get(protect, getStudentById).patch(protect, updateStudent);

module.exports = router;
