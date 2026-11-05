const jwt = require("jsonwebtoken");
const User = require("../models/user");
const asyncHandler = require("./asyncHandler");

const validateLoginInput = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  next();
};

const protect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select("-password");

  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }
  if (!user.isActive) {
    return res.status(403).json({ message: "User account is deactivated." });
  }
  req.user = user;
  next();
});

const { roleGuard } = require("./roleGuard");
const adminOnly = roleGuard(["Counselor-Admin"]);
const counselorOnly = roleGuard(["Counselor-Admin", "Counselor-User"]);
const accountAdminOnly = roleGuard(["Super-Admin"]);
const superAdminOnly = roleGuard(["Super-Admin"]);
module.exports = { validateLoginInput, protect, adminOnly, counselorOnly, accountAdminOnly, superAdminOnly };
