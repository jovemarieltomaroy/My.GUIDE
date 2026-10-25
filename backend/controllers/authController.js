const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const generateToken = require("../utils/generateToken");

const login = async (req, res) => {
  const { email, password } = req.body;

  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({
    email: normalizedEmail,
  });

  if (!user) {
    return res.status(401).json({
      message: "Invalid credentials",
    });
  }

  if (!user.isActive) {
    return res.status(403).json({
      message: "Account is inactive. Please contact support.",
    });
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return res.status(401).json({
      message: "Invalid credentials",
    });
  }

  return sendLoginResponse(user, res);
};

const sendLoginResponse = (user, res) => {
  const token = generateToken(user._id);

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 60 * 1000,
  });

  return res.status(200).json({
    message: "Login successful",

    user: {
      _id: user._id,

      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,

      email: user.email,
      designation: user.designation,
      instituteIdNumber: user.instituteIdNumber,
      contactNumber: user.contactNumber,
      dateJoinedAsCounselor: user.dateJoinedAsCounselor,

      collegesHandled: user.collegesHandled,
      profilePicture: user.profilePicture,

      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      profileCompleted: user.profileCompleted,
    },
  });
};

const refreshToken = (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET, {
    ignoreExpiration: true,
  });
  const newToken = generateToken(decoded.id);

  res.cookie("token", newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 60 * 1000, // 30 minutes
  });

  return res.status(200).json({ message: "Session extended successfully" });
};

module.exports = { login, refreshToken, sendLoginResponse };
