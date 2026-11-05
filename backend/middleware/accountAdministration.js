const User = require('../models/user');
const AuditEvent = require('../models/auditEvent');
module.exports = async (req, res, next) => {
  try {
    // Only account-management routes have targets; /me is always self-service.
    const target = req.path.match(/^\/([a-f\d]{24})(?:\/|$)/i)?.[1];
    if (target && (await User.findById(target).select('role'))?.role === 'Super-Admin') {
      await AuditEvent.create({ actor: req.user._id, action: 'account.protected', target, outcome: 'denied' });
      return res.status(403).json({ message: 'Super Admin cannot be managed through counselor account management.' });
    }
    if (!['GET', 'HEAD'].includes(req.method) && !req.path.startsWith('/me')) {
      // Persist an attempt before mutation, and its result after the response.
      const event = await AuditEvent.create({ actor: req.user._id,
        action: `account.${req.method.toLowerCase()}`, target: target || 'new', outcome: 'attempted' });
      res.on('finish', () => AuditEvent.updateOne({ _id: event._id }, {
        outcome: res.statusCode < 400 ? 'succeeded' : 'denied_or_failed',
      }).catch(() => console.error('Audit outcome persistence failed')));
    }
    next();
  } catch (error) { next(error); }
};
