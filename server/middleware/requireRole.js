'use strict';

/**
 * Factory — returns middleware that gates access to listed roles.
 * Usage: requireRole('super_admin') or requireRole('org_admin', 'end_user')
 * Must follow requireAuth in the middleware chain.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role(s): ${roles.join(', ')}`,
      });
    }
    next();
  };
}

module.exports = requireRole;
