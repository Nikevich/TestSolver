// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Minimal file logger (no third-party packages): app.log with rotation,
 * plus answers.jsonl written by the automation engine.
 */
class Logger extends EventEmitter {
  constructor({ dir, level = 'info', rotateMb = 10, answersEnabled = true }) {
    super();
    this.dir = dir;
    this.level = level;
    this.rotateMb = rotateMb;
    this.answersEnabled = answersEnabled;
    this.buffer = [];
    this.maxBuffer = 500;
  }

  configure({ dir, level, rotateMb, answersEnabled }) {
    if (dir) this.dir = dir;
    if (level) this.level = level;
    if (rotateMb) this.rotateMb = rotateMb;
    if (typeof answersEnabled === 'boolean') this.answersEnabled = answersEnabled;
  }

  get logPath() {
    return path.join(this.dir, 'app.log');
  }

  get answersPath() {
    return path.join(this.dir, 'answers.jsonl');
  }

  ensureDir() {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
    } catch (_) {
      /* ignore */
    }
  }

  shouldLog(level) {
    return (LEVELS[level] || 0) >= (LEVELS[this.level] || 0);
  }

  rotate(file) {
    try {
      if (!fs.existsSync(file)) return;
      const limit = Math.max(1, this.rotateMb) * 1024 * 1024;
      if (fs.statSync(file).size < limit) return;
      for (let i = 2; i >= 1; i -= 1) {
        const from = `${file}.${i}`;
        if (fs.existsSync(from)) fs.renameSync(from, `${file}.${i + 1}`);
      }
      fs.renameSync(file, `${file}.1`);
    } catch (_) {
      /* rotation is best effort */
    }
  }

  write(file, line) {
    this.ensureDir();
    this.rotate(file);
    try {
      fs.appendFileSync(file, `${line}\n`, 'utf8');
    } catch (_) {
      /* disk errors must not crash the app */
    }
  }

  log(level, message, meta) {
    const entry = {
      ts: new Date().toISOString(),
      level,
      message: String(message)
    };
    if (meta !== undefined) entry.meta = meta;

    const suffix = meta === undefined ? '' : ` ${safeJson(meta)}`;
    this.write(this.logPath, `${entry.ts} [${level.toUpperCase()}] ${entry.message}${suffix}`);

    this.buffer.push(entry);
    if (this.buffer.length > this.maxBuffer) this.buffer.shift();
    if (this.shouldLog(level)) this.emit('line', entry);
    return entry;
  }

  debug(message, meta) {
    return this.log('debug', message, meta);
  }

  info(message, meta) {
    return this.log('info', message, meta);
  }

  warn(message, meta) {
    return this.log('warn', message, meta);
  }

  error(message, meta) {
    return this.log('error', message, meta);
  }

  answer(record) {
    if (this.answersEnabled) this.write(this.answersPath, safeJson(record));
    this.emit('answer', record);
  }

  tail(limit = 300) {
    this.ensureDir();
    try {
      const text = fs.readFileSync(this.logPath, 'utf8');
      const lines = text.split(/\r?\n/).filter(Boolean);
      return lines.slice(-limit);
    } catch (_) {
      return this.buffer.slice(-limit).map((e) => `${e.ts} [${e.level.toUpperCase()}] ${e.message}`);
    }
  }
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
}

module.exports = { Logger };
