'use strict';
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

// Builds dist/TestSolver-<version>-source.zip — the "Corresponding Source"
// required by AGPL-3.0 §1/§6 for every distributed build.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const distDir = path.join(root, 'dist');
const stageDir = path.join(distDir, `TestSolver-${pkg.version}-source`);
const zipPath = path.join(distDir, `TestSolver-${pkg.version}-source.zip`);

const entries = [
  'src',
  'scripts',
  'assets',
  'docs',
  'package.json',
  'package-lock.json',
  'electron-builder.yml',
  'LICENSE',
  'COMMERCIAL.md',
  'THIRD-PARTY-NOTICES.md',
  'TRADEMARKS.md',
  'CONTRIBUTING.md',
  'CLA.md',
  'README.md',
  'README.ru.md',
  'README.cn.md'
];

function fail(message) {
  console.error(`source-archive: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(root, 'LICENSE'))) {
  fail('LICENSE not found — refusing to build an archive without the license text');
}

for (const entry of entries) {
  if (!fs.existsSync(path.join(root, entry))) {
    fail(`missing entry: ${entry}`);
  }
}

fs.rmSync(stageDir, { recursive: true, force: true });
fs.rmSync(zipPath, { force: true });
fs.mkdirSync(stageDir, { recursive: true });

for (const entry of entries) {
  const from = path.join(root, entry);
  const to = path.join(stageDir, entry);
  fs.cpSync(from, to, { recursive: true });
}

if (process.platform === 'win32') {
  const script = [
    'Add-Type -AssemblyName System.IO.Compression.FileSystem',
    `[System.IO.Compression.ZipFile]::CreateFromDirectory(${JSON.stringify(stageDir)}, ${JSON.stringify(zipPath)})`
  ].join('; ');
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    stdio: 'inherit'
  });
} else {
  execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: stageDir, stdio: 'inherit' });
}

fs.rmSync(stageDir, { recursive: true, force: true });

const size = (fs.statSync(zipPath).size / 1024).toFixed(1);
console.log(`source-archive: ${path.relative(root, zipPath)} (${size} KiB)`);
console.log('source-archive: attach this archive to the release together with the installer');
