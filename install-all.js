#!/usr/bin/env node
/**
 * install-all.js — Installs all dependencies for server and 3 frontend apps.
 * Pure Node / child_process — no cmd.exe dependency.
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const NODE = process.execPath;

function run(desc, cmd, cwd) {
  console.log(`\n📦 ${desc}…`);
  const result = spawnSync(cmd[0], cmd.slice(1), { cwd, stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    console.error(`❌ Failed: ${desc}`);
    process.exit(result.status);
  }
  console.log(`✅ Done: ${desc}`);
}

// Server
run(
  'Installing server dependencies',
  [NODE, path.join(process.env.npm_execpath || 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js'), 'install'],
  path.join(ROOT, 'server')
);

// Frontends — install with --ignore-scripts then manually run esbuild install
for (const app of ['super-admin', 'admin', 'user']) {
  const appDir = path.join(ROOT, 'frontend', app);
  const npmCli = path.join(process.env.npm_execpath || 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js');

  run(
    `Installing ${app} dependencies (--ignore-scripts)`,
    [NODE, npmCli, 'install', '--ignore-scripts'],
    appDir
  );

  const esbuildInstall = path.join(appDir, 'node_modules', 'esbuild', 'install.js');
  if (fs.existsSync(esbuildInstall)) {
    run(
      `Building esbuild native binary for ${app}`,
      [NODE, esbuildInstall],
      appDir
    );
  }
}

console.log('\n🎉 All dependencies installed!\n');
console.log('Next steps:');
console.log('  npm run seed   — Create sample data');
console.log('  npm run dev    — Start all 4 processes\n');
