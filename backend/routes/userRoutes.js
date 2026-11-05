const express = require("express");
const router = express.Router();

const { protect, accountAdminOnly } = require("../middleware/authValidator");

const asyncHandler = require("../middleware/asyncHandler");

router.use(protect);
router.use(require("../middleware/accountAdministration"));

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
  .get(protect, accountAdminOnly, asyncHandler(getAllUsers))
  .post(protect, accountAdminOnly, asyncHandler(createUser));

router.patch("/:id/role", protect, accountAdminOnly, asyncHandler(updateUserRole));

router.patch("/:id/reactivate", protect, accountAdminOnly, asyncHandler(reactivateUser));

router.patch("/:id/deactivate", protect, accountAdminOnly, asyncHandler(deactivateUser));

router.put("/:id/reset-password", protect, accountAdminOnly, asyncHandler(adminResetUserPassword));
router.get("/counselors/active", protect, asyncHandler(getActiveCounselors));

router
  .route("/:id")
  .get(protect, accountAdminOnly, asyncHandler(getUserById))
  .put(protect, accountAdminOnly, asyncHandler(updateUser));

module.exports = router;
