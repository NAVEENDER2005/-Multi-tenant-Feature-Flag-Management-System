'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireSameOrg = require('../middleware/requireSameOrg');

const router = express.Router();

// A simple deterministic hash function
function hashUserId(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// GET /api/flags/check/:key — end user, checks flag in their org
// MUST be before /:id routes to prevent "check" being treated as an id
router.get('/check/:key', requireAuth, requireRole('end_user'), (req, res) => {
  try {
    const { key } = req.params;
    const { organization_id } = req.user; // always from JWT

    const flag = db.get(
      'SELECT key, is_enabled, rollout_percentage FROM feature_flags WHERE organization_id = ? AND key = ?',
      [organization_id, key]
    );

    if (!flag) {
      return res.status(404).json({ success: false, error: 'Flag not found in your organization' });
    }

    const userId = req.user.sub;
    const hash = hashUserId(userId + flag.key);
    const rolloutBucket = hash % 100;
    const rolloutPercentage = flag.rollout_percentage !== undefined ? flag.rollout_percentage : 100;
    const isRolloutEnabled = rolloutBucket < rolloutPercentage;

    const enabled = (flag.is_enabled === 1) && isRolloutEnabled;

    return res.json({ success: true, data: { key: flag.key, enabled } });
  } catch (err) {
    console.error('[flags/check]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/flags — org admin: list flags for their org
router.get('/', requireAuth, requireRole('org_admin'), (req, res) => {
  try {
    const flags = db.all(
      'SELECT id, key, description, is_enabled, rollout_percentage, created_at, updated_at FROM feature_flags WHERE organization_id = ? ORDER BY created_at DESC',
      [req.user.organization_id]
    );
    return res.json({
      success: true,
      data: flags.map(f => ({ ...f, is_enabled: f.is_enabled === 1 })),
    });
  } catch (err) {
    console.error('[flags/list]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/flags — org admin: create flag (org from JWT, never body)
router.post('/', requireAuth, requireRole('org_admin'), (req, res) => {
  try {
    const { key, description, is_enabled, rollout_percentage } = req.body;
    const { organization_id } = req.user; // from JWT — never trust client input

    if (!key || typeof key !== 'string' || !key.trim()) {
      return res.status(400).json({ success: false, error: 'key is required' });
    }
    const trimmedKey = key.trim();

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedKey)) {
      return res.status(400).json({
        success: false,
        error: 'key must contain only letters, numbers, underscores, or dashes',
      });
    }

    const existing = db.get(
      'SELECT id FROM feature_flags WHERE organization_id = ? AND key = ?',
      [organization_id, trimmedKey]
    );
    if (existing) {
      return res.status(409).json({ success: false, error: `Flag key "${trimmedKey}" already exists in your organization` });
    }

    const rollout = rollout_percentage !== undefined ? parseInt(rollout_percentage, 10) : 100;
    const finalRollout = isNaN(rollout) ? 100 : Math.max(0, Math.min(100, rollout));

    const id = uuidv4();
    db.run(
      'INSERT INTO feature_flags (id, organization_id, key, description, is_enabled, rollout_percentage) VALUES (?, ?, ?, ?, ?, ?)',
      [id, organization_id, trimmedKey, description || null, is_enabled ? 1 : 0, finalRollout]
    );

    // Write Audit Log
    db.run(
      'INSERT INTO audit_logs (id, organization_id, user_id, action, flag_key) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), organization_id, req.user.sub, 'created', trimmedKey]
    );

    const flag = db.get('SELECT * FROM feature_flags WHERE id = ?', [id]);
    return res.status(201).json({ success: true, data: { ...flag, is_enabled: flag.is_enabled === 1 } });
  } catch (err) {
    console.error('[flags/create]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PATCH /api/flags/:id — org admin: update flag
router.patch('/:id', requireAuth, requireRole('org_admin'), requireSameOrg, (req, res) => {
  try {
    const { id } = req.params;
    const { is_enabled, description, rollout_percentage } = req.body;

    const original = db.get('SELECT * FROM feature_flags WHERE id = ?', [id]);
    if (!original) {
      return res.status(404).json({ success: false, error: 'Flag not found' });
    }

    const updates = [];
    const values = [];

    if (is_enabled !== undefined) { updates.push('is_enabled = ?'); values.push(is_enabled ? 1 : 0); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (rollout_percentage !== undefined) {
      const rollout = parseInt(rollout_percentage, 10);
      const finalRollout = isNaN(rollout) ? 100 : Math.max(0, Math.min(100, rollout));
      updates.push('rollout_percentage = ?');
      values.push(finalRollout);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Provide at least one of: is_enabled, description, rollout_percentage' });
    }

    updates.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
    values.push(id);

    db.run(`UPDATE feature_flags SET ${updates.join(', ')} WHERE id = ?`, values);

    // Audit log if status changes
    if (is_enabled !== undefined && (is_enabled ? 1 : 0) !== original.is_enabled) {
      db.run(
        'INSERT INTO audit_logs (id, organization_id, user_id, action, flag_key) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), req.user.organization_id, req.user.sub, is_enabled ? 'enabled' : 'disabled', original.key]
      );
    }

    const flag = db.get('SELECT * FROM feature_flags WHERE id = ?', [id]);
    return res.json({ success: true, data: { ...flag, is_enabled: flag.is_enabled === 1 } });
  } catch (err) {
    console.error('[flags/update]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/flags/:id — org admin: delete flag
router.delete('/:id', requireAuth, requireRole('org_admin'), requireSameOrg, (req, res) => {
  try {
    const flag = db.get('SELECT key FROM feature_flags WHERE id = ?', [req.params.id]);
    if (flag) {
      db.run(
        'INSERT INTO audit_logs (id, organization_id, user_id, action, flag_key) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), req.user.organization_id, req.user.sub, 'deleted', flag.key]
      );
    }

    db.run('DELETE FROM feature_flags WHERE id = ?', [req.params.id]);
    return res.json({ success: true, data: { id: req.params.id, deleted: true } });
  } catch (err) {
    console.error('[flags/delete]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
