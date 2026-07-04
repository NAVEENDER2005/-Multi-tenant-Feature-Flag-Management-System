'use strict';

/**
 * Seed script — idempotent, creates baseline data.
 *
 * Creates:
 *   Organization: Acme Corp
 *   Org Admin:    admin@acme.com  / admin123
 *   End User:     user@acme.com   / user123
 *   Flags:        dark-mode (enabled), new-dashboard, smart-suggestions (both disabled)
 *
 * Usage:
 *   node server/seed.js    (from project root)
 *   npm run seed           (via root package.json)
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db'); // DB init + schema happens here

const SALT_ROUNDS = 10;

async function seed() {
  console.log('\n🌱 Running seed…\n');

  // Organization
  let org = db.get("SELECT * FROM organizations WHERE name = 'Acme Corp'", []);
  if (!org) {
    const id = uuidv4();
    db.run('INSERT INTO organizations (id, name) VALUES (?, ?)', [id, 'Acme Corp']);
    org = db.get('SELECT * FROM organizations WHERE id = ?', [id]);
    console.log(`✅ Created org: Acme Corp (${org.id})`);
  } else {
    console.log(`⏭️  Org exists: Acme Corp`);
  }

  // Org Admin
  const adminEmail = 'admin@acme.com';
  if (!db.get('SELECT id FROM users WHERE email = ?', [adminEmail])) {
    const hash = await bcrypt.hash('admin123', SALT_ROUNDS);
    db.run(
      'INSERT INTO users (id, email, password_hash, role, organization_id) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), adminEmail, hash, 'org_admin', org.id]
    );
    console.log(`✅ Created org_admin: ${adminEmail} / admin123`);
  } else {
    console.log(`⏭️  User exists: ${adminEmail}`);
  }

  // End User
  const userEmail = 'user@acme.com';
  if (!db.get('SELECT id FROM users WHERE email = ?', [userEmail])) {
    const hash = await bcrypt.hash('user123', SALT_ROUNDS);
    db.run(
      'INSERT INTO users (id, email, password_hash, role, organization_id) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), userEmail, hash, 'end_user', org.id]
    );
    console.log(`✅ Created end_user: ${userEmail} / user123`);
  } else {
    console.log(`⏭️  User exists: ${userEmail}`);
  }

  // Feature Flags
  const flags = [
    { key: 'dark-mode',      description: 'Enable dark mode UI',                  is_enabled: 1 },
    { key: 'new-dashboard',  description: 'Redesigned analytics dashboard (beta)', is_enabled: 0 },
    { key: 'smart-suggestions', description: 'Smart-powered feature recommendations',    is_enabled: 0 },
  ];

  for (const f of flags) {
    if (!db.get('SELECT id FROM feature_flags WHERE organization_id = ? AND key = ?', [org.id, f.key])) {
      db.run(
        'INSERT INTO feature_flags (id, organization_id, key, description, is_enabled) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), org.id, f.key, f.description, f.is_enabled]
      );
      console.log(`✅ Created flag: ${f.key} (enabled=${f.is_enabled === 1})`);
    } else {
      console.log(`⏭️  Flag exists: ${f.key}`);
    }
  }

  console.log('\n🎉 Seed complete!\n');
  console.log('─────────────────────────────────────────────────');
  console.log('Test credentials:');
  console.log(`  Super Admin  →  ${process.env.SUPER_ADMIN_EMAIL} / ${process.env.SUPER_ADMIN_PASSWORD}`);
  console.log('  Org Admin    →  admin@acme.com  / admin123');
  console.log('  End User     →  user@acme.com   / user123');
  console.log('─────────────────────────────────────────────────\n');

  db.close();
  process.exit(0);
}

seed().catch(err => { console.error('❌ Seed failed:', err); db.close(); process.exit(1); });
