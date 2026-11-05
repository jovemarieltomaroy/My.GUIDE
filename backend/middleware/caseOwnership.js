const Case = require("../models/case");
const wrap = require("express-async-handler");
// Clinical access follows permanent assignment, never college or creator.
module.exports = wrap(async (req, res, next) => {
  const match = req.path.match(/^\/([a-f\d]{24})(?:\/|$)/i);
  if (!match) return next();
  if (
    req.user.role === "Counselor-Admin" &&
    /^\/[a-f\d]{24}\/(assign-counselor|transfer)$/.test(req.path)
  )
    return next();
  const record = await Case.findById(match[1]).select("assignedCounselor temporaryCounselor");
  if (!record) return res.status(404).json({ message: "Case not found." });
  const owned = String(record.assignedCounselor) === String(req.user._id);
  if (!owned)
    return res.status(403).json({
      message: "Only the assigned counselor can access this case. Case transfers are permanent.",
    });
  next();
});
