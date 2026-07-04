'use strict';

const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

// GET /api/audit-logs
router.get('/', requireAuth, (req, res) => {
  try {
    const { role, organization_id } = req.user;

    if (role === 'super_admin') {
      const { organization_id: filterOrgId } = req.query;
      let logs;
      if (filterOrgId) {
        logs = db.all(
          `SELECT a.*, COALESCE(u.email, 'superadmin@example.com') as user_email, o.name as organization_name 
           FROM audit_logs a 
           LEFT JOIN users u ON a.user_id = u.id 
           LEFT JOIN organizations o ON a.organization_id = o.id
           WHERE a.organization_id = ?
           ORDER BY a.timestamp DESC`,
          [filterOrgId]
        );
      } else {
        logs = db.all(
          `SELECT a.*, COALESCE(u.email, 'superadmin@example.com') as user_email, o.name as organization_name 
           FROM audit_logs a 
           LEFT JOIN users u ON a.user_id = u.id 
           LEFT JOIN organizations o ON a.organization_id = o.id
           ORDER BY a.timestamp DESC`,
          []
        );
      }
      return res.json({ success: true, data: logs });
    }

    if (role === 'org_admin') {
      const logs = db.all(
        `SELECT a.*, COALESCE(u.email, 'superadmin@example.com') as user_email 
         FROM audit_logs a 
         LEFT JOIN users u ON a.user_id = u.id 
         WHERE a.organization_id = ? 
         ORDER BY a.timestamp DESC`,
        [organization_id]
      );
      return res.json({ success: true, data: logs });
    }

    return res.status(403).json({ success: false, error: 'Unauthorized to view audit logs' });
  } catch (err) {
    console.error('[audit-logs/get]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
