const bcrypt = require("bcryptjs");
const User = require("../models/user");
const USER_ROLES = ["Counselor-Admin", "Counselor-User"];
const uploadToCloudinary = require("../utils/uploadToCloudinary");

const getAllUsers = async (req, res) => {
  const { search, role, isActive } = req.query;
  let query = {};

  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { middleName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { instituteIdNumber: { $regex: search, $options: "i" } },
      { collegesHandled: { $regex: search, $options: "i" } },
      { designation: { $regex: search, $options: "i" } },
    ];
  }
  if (role) {
    if (!USER_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role filter" });
    }
    query.role = role;
  }
  if (isActive !== undefined) {
    query.isActive = isActive === "true";
  }
  const users = await User.find(query).select("-password").sort({ lastName: 1, firstName: 1 });
  res.status(200).json(users);
};
const getUserById = async (req, res) => {
  const userId = req.params.id;
  const user = await User.findById(userId).select("-password");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  res.status(200).json(user);
};
const createUser = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(400).json({ message: "Email already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({
    email: normalizedEmail,
    password: hashedPassword,
    role: "Counselor-User",
    mustChangePassword: true,
    profileCompleted: false,
  });

  await newUser.save();

  res.status(201).json({
    message: "User created successfully",
    user: {
      id: newUser._id,
      firstName: newUser.firstName,
      middleName: newUser.middleName,
      lastName: newUser.lastName,
      designation: newUser.designation,
      email: newUser.email,
      role: newUser.role,
      isActive: newUser.isActive,
      mustChangePassword: newUser.mustChangePassword,
      profileCompleted: newUser.profileCompleted,
      profilePicture: newUser.profilePicture,
      instituteIdNumber: newUser.instituteIdNumber,
      collegesHandled: newUser.collegesHandled,
      contactNumber: newUser.contactNumber,
      dateJoinedAsCounselor: newUser.dateJoinedAsCounselor,
    },
  });
};
const updateUser = async (req, res) => {
  const {
    firstName,
    middleName,
    lastName,
    email,
    designation,
    isActive,
    profilePicture,
    instituteIdNumber,
    collegesHandled,
    contactNumber,
    dateJoinedAsCounselor,
  } = req.body;

  const updateData = {};

  if (firstName !== undefined) updateData.firstName = firstName;
  if (middleName !== undefined) updateData.middleName = middleName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (email !== undefined) {
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: req.params.id },
    });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }
    updateData.email = normalizedEmail;
  }
  if (designation !== undefined) updateData.designation = designation;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (profilePicture !== undefined) updateData.profilePicture = profilePicture;
  if (instituteIdNumber !== undefined) updateData.instituteIdNumber = instituteIdNumber;
  if (collegesHandled !== undefined) updateData.collegesHandled = collegesHandled;
  if (contactNumber !== undefined) updateData.contactNumber = contactNumber;
  if (dateJoinedAsCounselor !== undefined) updateData.dateJoinedAsCounselor = dateJoinedAsCounselor;

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ message: "No valid fields provided for update" });
  }

  const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  }).select("-password");

  if (!updatedUser) {
    return res.status(404).json({ message: "User not found" });
  }
  res.status(200).json({
    message: "User updated successfully",
    user: updatedUser,
  });
};
const completeUserProfile = async (req, res) => {
  const {
    firstName,
    middleName,
    lastName,
    designation,
    instituteIdNumber,
    collegesHandled,
    contactNumber,
  } = req.body;

  let parsedCollegesHandled = collegesHandled;

  if (typeof collegesHandled === "string") {
    try {
      parsedCollegesHandled = JSON.parse(collegesHandled);
    } catch (error) {
      return res.status(400).json({
        message: "Colleges handled must be a valid array.",
      });
    }
  }

  if (
    !firstName?.trim() ||
    !lastName?.trim() ||
    !designation?.trim() ||
    !instituteIdNumber?.trim() ||
    !Array.isArray(parsedCollegesHandled) ||
    parsedCollegesHandled.length === 0
  ) {
    return res.status(400).json({
      message: "Missing required fields for profile completion.",
    });
  }

  const user = await User.findById(req.user._id || req.user.id);

  if (!user) {
    return res.status(404).json({
      message: "User not found.",
    });
  }

  let profilePictureUrl = user.profilePicture || null;

  if (req.file) {
    const uploadResult = await uploadToCloudinary(req.file.buffer, {
      public_id: `user-${user._id}`,
      overwrite: true,
      invalidate: true,
    });

    profilePictureUrl = uploadResult.secure_url;
  }

  user.firstName = firstName.trim();
  user.lastName = lastName.trim();
  user.designation = designation.trim();

  user.instituteIdNumber = instituteIdNumber.trim().toUpperCase();

  user.collegesHandled = parsedCollegesHandled;

  user.middleName = middleName?.trim() || "";
  user.contactNumber = contactNumber?.trim() || "";

  user.profilePicture = profilePictureUrl;

  user.profileCompleted = true;

  const updatedUser = await user.save();

  return res.status(200).json({
    message: "Profile completed successfully.",
    user: {
      _id: updatedUser._id,
      firstName: updatedUser.firstName,
      middleName: updatedUser.middleName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      designation: updatedUser.designation,
      profilePicture: updatedUser.profilePicture,
      instituteIdNumber: updatedUser.instituteIdNumber,
      collegesHandled: updatedUser.collegesHandled,
      contactNumber: updatedUser.contactNumber,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      mustChangePassword: updatedUser.mustChangePassword,
      profileCompleted: updatedUser.profileCompleted,
    },
  });
};
const updateUserRole = async (req, res) => {
  const { role, adminPassword } = req.body;

  await verifyAdminPassword(req.user._id, adminPassword);

  if (!role) {
    return res.status(400).json({
      message: "Role is required",
    });
  }

  if (!USER_ROLES.includes(role)) {
    return res.status(400).json({
      message: "Invalid role",
    });
  }

  const loggedInUserId = req.user._id || req.user.id;

  if (String(loggedInUserId) === String(req.params.id)) {
    return res.status(400).json({
      message: "You cannot change your own account role",
    });
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  if (user.role === role) {
    return res.status(400).json({
      message: "The user already has the selected role",
    });
  }

  user.role = role;

  await user.save();

  const updatedUser = await User.findById(user._id).select("-password");

  return res.status(200).json({
    message: "User role updated successfully",
    user: updatedUser,
  });
};
const deactivateUser = async (req, res) => {
  const { adminPassword } = req.body;

  await verifyAdminPassword(req.user._id, adminPassword);

  const loggedInUserId = req.user._id || req.user.id;

  if (String(loggedInUserId) === String(req.params.id)) {
    return res.status(400).json({
      message: "You cannot deactivate your own account",
    });
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  if (!user.isActive) {
    return res.status(400).json({
      message: "User account is already inactive",
    });
  }

  user.isActive = false;

  await user.save();

  const updatedUser = await User.findById(user._id).select("-password");

  return res.status(200).json({
    message: "User deactivated successfully",
    user: updatedUser,
  });
};
const reactivateUser = async (req, res) => {
  const { adminPassword } = req.body;

  await verifyAdminPassword(req.user._id, adminPassword);

  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  if (user.isActive) {
    return res.status(400).json({
      message: "User account is already active",
    });
  }

  user.isActive = true;

  await user.save();

  const updatedUser = await User.findById(user._id).select("-password");

  return res.status(200).json({
    message: "User reactivated successfully",
    user: updatedUser,
  });
};
const changeOwnPassword = async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword, confirmNewPassword } = req.body;
  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return res.status(400).json({ message: "All password fields are required" });
  }
  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ message: "New passwords do not match" });
  }
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Current password is incorrect" });
  }

  const isSameAsCurrent = await bcrypt.compare(newPassword, user.password);
  if (isSameAsCurrent) {
    return res
      .status(400)
      .json({ message: "New password cannot be the same as the current password" });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  user.mustChangePassword = false;
  await user.save();
  res.status(200).json({ message: "Password changed successfully" });
};
const adminResetUserPassword = async (req, res) => {
  const { newPassword, confirmNewPassword, adminPassword } = req.body;

  await verifyAdminPassword(req.user._id, adminPassword);

  if (!newPassword || !confirmNewPassword) {
    return res.status(400).json({
      message: "All password fields are required",
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      message: "New password must contain at least 8 characters",
    });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({
      message: "New passwords do not match",
    });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const updatedUser = await User.findByIdAndUpdate(
    req.params.id,
    {
      password: hashedPassword,
      mustChangePassword: true,
    },
    {
      new: true,
      runValidators: true,
    }
  ).select("-password");

  if (!updatedUser) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  return res.status(200).json({
    message: "User password reset successfully",
    user: updatedUser,
  });
};
const getCurrentUser = async (req, res) => {
  const userId = req.user.id;
  const user = await User.findById(userId).select("-password");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  res.status(200).json(user);
};
const verifyAdminPassword = async (loggedInAdminId, adminPassword) => {
  if (!adminPassword || !adminPassword.trim()) {
    const error = new Error("Administrator password is required");

    error.statusCode = 400;
    throw error;
  }

  const admin = await User.findById(loggedInAdminId).select("+password");

  if (!admin) {
    const error = new Error("Administrator account not found");

    error.statusCode = 404;
    throw error;
  }

  if (admin.role !== "Counselor-Admin") {
    const error = new Error("Administrator access is required");

    error.statusCode = 403;
    throw error;
  }

  if (!admin.isActive) {
    const error = new Error("Your administrator account is inactive");

    error.statusCode = 403;
    throw error;
  }

  const passwordMatches = await bcrypt.compare(adminPassword, admin.password);

  if (!passwordMatches) {
    const error = new Error("Incorrect administrator password");

    error.statusCode = 401;
    throw error;
  }

  return admin;
};
const getActiveCounselors = async (req, res) => {
  const allowedRoles = ["Counselor-Admin", "Counselor-User"];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      message: "You are not authorized to retrieve the counselor list.",
    });
  }

  const counselors = await User.find({
    role: {
      $in: allowedRoles,
    },
    isActive: true,
  })
    .select("_id firstName middleName lastName email role designation collegesHandled")
    .sort({
      firstName: 1,
      lastName: 1,
    });

  return res.status(200).json({
    counselors,
  });
};

module.exports = {
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
  verifyAdminPassword,
  getActiveCounselors,
};
