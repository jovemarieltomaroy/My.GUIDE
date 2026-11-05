const AuditEvent = require('../models/auditEvent');
const roleGuard = (roles) => async (req, res, next) => {
  if (roles.includes(req.user?.role)) return next();
  try {
    await AuditEvent.create({ actor: req.user?._id, action: 'authorization.denied',
      target: req.baseUrl, outcome: 'denied' });
  } catch (error) { return next(error); }
  return res.status(403).json({ message: 'Access denied for your role.' });
};
module.exports = { roleGuard };
