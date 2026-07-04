'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '12h';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'email and password are required' });
    }

    // 1. Super admin env check (checked first, before any DB query)
    if (process.env.SUPER_ADMIN_EMAIL && email === process.env.SUPER_ADMIN_EMAIL) {
      if (password !== process.env.SUPER_ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }
      const token = jwt.sign(
        { sub: 'super_admin', role: 'super_admin', organization_id: null },
        process.env.JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
      );
      return res.json({
        success: true,
        data: { token, user: { id: 'super_admin', email, role: 'super_admin', organization_id: null } },
      });
    }

    // 2. DB lookup
    const user = db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const token = jwt.sign(
      { sub: user.id, role: user.role, organization_id: user.organization_id },
      process.env.JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    return res.json({
      success: true,
      data: { token, user: { id: user.id, email: user.email, role: user.role, organization_id: user.organization_id } },
    });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password, role, organization_id } = req.body;

    if (!email || !password || !role || !organization_id) {
      return res.status(400).json({ success: false, error: 'email, password, role, and organization_id are required' });
    }
    if (!['org_admin', 'end_user'].includes(role)) {
      return res.status(400).json({ success: false, error: 'role must be org_admin or end_user' });
    }

    const org = db.get('SELECT id FROM organizations WHERE id = ?', [organization_id]);
    if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

    const existing = db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ success: false, error: 'Email already in use' });

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const id = uuidv4();

    db.run(
      'INSERT INTO users (id, email, password_hash, role, organization_id) VALUES (?, ?, ?, ?, ?)',
      [id, email, password_hash, role, organization_id]
    );

    return res.status(201).json({ success: true, data: { id, email, role, organization_id } });
  } catch (err) {
    console.error('[auth/signup]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Dummy in-memory store for reset tokens: token -> email
const resetTokens = new Map();

// POST /api/auth/forgot-password
router.post('/forgot-password', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const user = db.get('SELECT * FROM users WHERE email = ?', [email]);
    const isSuperAdmin = process.env.SUPER_ADMIN_EMAIL && email === process.env.SUPER_ADMIN_EMAIL;

    if (!user && !isSuperAdmin) {
      return res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent.',
      });
    }

    const token = uuidv4();
    resetTokens.set(token, email);

    // Auto-expiry in 15 minutes
    setTimeout(() => {
      resetTokens.delete(token);
    }, 15 * 60 * 1000);

    const resetLink = `http://localhost:5174/reset-password?token=${token}`;
    console.log(`\n🔑 [DUMMY AUTH] Password reset requested for ${email}`);
    console.log(`🔗 Reset Link: ${resetLink}\n`);

    return res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent.',
      data: {
        dummyToken: token,
        dummyResetLink: resetLink
      }
    });
  } catch (err) {
    console.error('[auth/forgot-password]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: 'token and newPassword are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' });
    }

    const email = resetTokens.get(token);
    if (!email) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    }

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    db.run('UPDATE users SET password_hash = ? WHERE email = ?', [hash, email]);

    resetTokens.delete(token);
    console.log(`\n✅ [DUMMY AUTH] Password reset successfully for ${email}\n`);

    return res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error('[auth/reset-password]', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
