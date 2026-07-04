'use strict';

const db = require('../db');

/**
 * Verifies that the feature flag addressed by :id belongs to the requesting
 * user's organization. organization_id is ALWAYS taken from req.user (JWT),
 * never from the request body or URL params.
 *
 * This is the core multi-tenancy security boundary — see README for rationale.
 * Returns 404 (not 403) when flag exists in another org to avoid existence leakage.
 */
function requireSameOrg(req, res, next) {
  const { id } = req.params;
  if (!id) return next();

  const flag = db.get('SELECT organization_id FROM feature_flags WHERE id = ?', [id]);

  if (!flag) {
    return res.status(404).json({ success: false, error: 'Feature flag not found' });
  }

  if (flag.organization_id !== req.user.organization_id) {
    return res.status(404).json({ success: false, error: 'Feature flag not found' });
  }

  next();
}

module.exports = requireSameOrg;
