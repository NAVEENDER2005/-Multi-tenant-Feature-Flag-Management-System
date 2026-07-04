#!/usr/bin/env node
/**
 * start-dev.js — Starts all 4 processes concurrently using Node's child_process.
 * Pure Node, no external dependencies, no cmd.exe dependency.
 *
 * Processes:
 *   [API]   node server/index.js            → http://localhost:4000
 *   [SA]    vite (from super-admin dir)     → http://localhost:5173
 *   [ADMIN] vite (from admin dir)           → http://localhost:5174
 *   [USER]  vite (from user dir)            → http://localhost:5175
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');

const ROOT = __dirname;

const COLORS = {
  reset:   '\x1b[0m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
};

const VITE = 'node_modules/vite/bin/vite.js';

const processes = [
  {
    name:  'API  ',
    color: COLORS.magenta,
    cmd:   process.execPath,
    args:  [path.join(ROOT, 'server', 'index.js')],
    cwd:   ROOT,
  },
  {
    name:  'SA   ',
    color: COLORS.cyan,
    cmd:   process.execPath,
    args:  [VITE],
    cwd:   path.join(ROOT, 'frontend', 'super-admin'),
  },
  {
    name:  'ADMIN',
    color: COLORS.green,
    cmd:   process.execPath,
    args:  [VITE],
    cwd:   path.join(ROOT, 'frontend', 'admin'),
  },
  {
    name:  'USER ',
    color: COLORS.yellow,
    cmd:   process.execPath,
    args:  [VITE],
    cwd:   path.join(ROOT, 'frontend', 'user'),
  },
];

const children = [];

function log(name, color, line) {
  process.stdout.write(`${color}[${name}]${COLORS.reset} ${line}\n`);
}

for (const p of processes) {
  const child = spawn(p.cmd, p.args, {
    cwd:   p.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env:   { ...process.env },
  });

  children.push(child);

  child.stdout.on('data', data => {
    data.toString().split('\n').filter(Boolean).forEach(line => log(p.name, p.color, line));
  });
  child.stderr.on('data', data => {
    data.toString().split('\n').filter(Boolean).forEach(line => log(p.name, COLORS.red, line));
  });
  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      log(p.name, COLORS.red, `Process exited with code ${code} — killing all processes`);
      for (const c of children) { try { c.kill(); } catch (_) {} }
      process.exit(code);
    }
  });

  log(p.name, p.color, 'Starting…');
}

console.log('\n🚀 FlagFlow Dev Environment\n');
console.log('   API Server:  http://localhost:4000');
console.log('   Super Admin: http://localhost:5173');
console.log('   Org Admin:   http://localhost:5174');
console.log('   End User:    http://localhost:5175\n');
console.log('   Press Ctrl+C to stop all processes\n');

process.on('SIGINT', () => {
  console.log('\nShutting down all processes…');
  for (const c of children) { try { c.kill('SIGTERM'); } catch (_) {} }
  process.exit(0);
});
