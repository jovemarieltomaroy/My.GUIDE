const express = require("express");
const router = express.Router();

const { protect, adminOnly } = require("../middleware/authValidator");

const asyncHandler = require("../middleware/asyncHandler");

const uploadProfilePicture = require("../middleware/uploadProfilePicture");

const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  completeUserProfile,
  updateUserRole,
  deactivateUser,
  reactivateUser,
  changeOwnPassword,
  adminResetUserPassword,
  getCurrentUser,
  getActiveCounselors,
} = require("../controllers/userController");

router.route("/me").get(protect, asyncHandler(getCurrentUser));

router.patch("/me/change-password", protect, asyncHandler(changeOwnPassword));

router.patch(
  "/me/complete-profile",
  protect,
  uploadProfilePicture.single("profilePicture"),
  asyncHandler(completeUserProfile)
);

router
  .route("/")
  .get(protect, adminOnly, asyncHandler(getAllUsers))
  .post(protect, adminOnly, asyncHandler(createUser));

router.patch("/:id/role", protect, adminOnly, asyncHandler(updateUserRole));

router.patch("/:id/reactivate", protect, adminOnly, asyncHandler(reactivateUser));

router.patch("/:id/deactivate", protect, adminOnly, asyncHandler(deactivateUser));

router.put("/:id/reset-password", protect, adminOnly, asyncHandler(adminResetUserPassword));
router.get("/counselors/active", protect, asyncHandler(getActiveCounselors));

router
  .route("/:id")
  .get(protect, adminOnly, asyncHandler(getUserById))
  .put(protect, adminOnly, asyncHandler(updateUser));

module.exports = router;
