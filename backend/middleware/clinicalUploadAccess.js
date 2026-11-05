const wrap = require("express-async-handler");
const Case = require("../models/case");
module.exports = wrap(async (req, res, next) => {
  let uploadPath;
  try {
    uploadPath = decodeURIComponent(req.path);
  } catch {
    return res.status(400).json({ message: "Invalid file path." });
  }
  if (!uploadPath.startsWith("/intervention-resources/")) return next();
  const url = `/uploads${uploadPath}`;
  const record = await Case.exists({
    $and: [
      {
        $or: [
          { "interventionPlans.resources.url": url },
          { "llmRecommendations.resources.url": url },
        ],
      },
      { assignedCounselor: req.user._id },
    ],
  });
  if (!record)
    return res.status(403).json({
      message: "Only the assigned counselor can open this case attachment.",
    });
  next();
});
