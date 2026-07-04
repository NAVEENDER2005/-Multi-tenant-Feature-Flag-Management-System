'use strict';

/**
 * SQLite database singleton using node-sqlite3-wasm (pure JS/WASM).
 *
 * Why node-sqlite3-wasm instead of better-sqlite3:
 * better-sqlite3 requires compilation with C++ / Visual Studio Build Tools,
 * which may not be present on every developer machine. node-sqlite3-wasm is
 * a pure JS/WASM build — zero native compilation required, works on Node 20+
 * including Node 24. The API is nearly identical: db.run(), db.get(), db.all().
 *
 * IMPORTANT: node-sqlite3-wasm buffers writes in WASM memory and flushes to
 * disk on db.close(). We therefore:
 *   1. Keep a single global instance open for the server's lifetime.
 *   2. Register process exit / SIGINT hooks to close() before the process ends.
 */

const path = require('path');
const { Database } = require('node-sqlite3-wasm');

const DB_PATH = path.join(__dirname, 'feature_flags.db');

const db = new Database(DB_PATH);

// Schema init — idempotent, runs on every boot
db.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL CHECK(role IN ('org_admin', 'end_user')),
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS feature_flags (
    id              TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    key             TEXT NOT NULL,
    description     TEXT,
    is_enabled      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    UNIQUE(organization_id, key)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id              TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    user_id         TEXT NOT NULL,
    action          TEXT NOT NULL CHECK(action IN ('created', 'enabled', 'disabled', 'deleted')),
    flag_key        TEXT NOT NULL,
    timestamp       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
`);

// Ensure rollout_percentage column exists (for upgrading existing database)
const info = db.all("PRAGMA table_info(feature_flags)");
const hasRollout = info.some(column => column.name === 'rollout_percentage');
if (!hasRollout) {
  db.exec("ALTER TABLE feature_flags ADD COLUMN rollout_percentage INTEGER DEFAULT 100;");
}

// Flush to disk on normal exit and SIGINT (Ctrl+C)
function shutdown() {
  try { db.close(); } catch (_) {}
  process.exit(0);
}
process.on('exit',   () => { try { db.close(); } catch (_) {} });
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

console.log(`[db] SQLite database initialized at ${DB_PATH}`);

module.exports = db;
