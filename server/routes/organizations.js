'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

// GET /api/organizations/public — no auth, for signup dropdowns
router.get('/public', (_req, res) => {
  try {
    const orgs = db.all('SELECT id, name FROM organizations ORDER BY name ASC', []);
    return res.json({ success: true, data: orgs });
  } catch (err) {
    console.error('[orgs/public]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/organizations — super admin only
router.get('/', requireAuth, requireRole('super_admin'), (_req, res) => {
  try {
    const orgs = db.all('SELECT id, name, created_at FROM organizations ORDER BY created_at DESC', []);
    return res.json({ success: true, data: orgs });
  } catch (err) {
    console.error('[orgs/list]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/organizations — super admin only
router.post('/', requireAuth, requireRole('super_admin'), (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }
    const trimmed = name.trim();

    const existing = db.get('SELECT id FROM organizations WHERE name = ?', [trimmed]);
    if (existing) return res.status(409).json({ success: false, error: 'Organization name already exists' });

    const id = uuidv4();
    db.run('INSERT INTO organizations (id, name) VALUES (?, ?)', [id, trimmed]);
    const org = db.get('SELECT id, name, created_at FROM organizations WHERE id = ?', [id]);
    return res.status(201).json({ success: true, data: org });
  } catch (err) {
    console.error('[orgs/create]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
