// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

const fs = require('fs');
const path = require('path');
const { FIELDS, FIELD_BY_KEY, defaultsObject, clone } = require('../shared/schema');

function getPath(obj, key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), obj);
}

function setPath(obj, key, value) {
  const parts = key.split('.');
  let node = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!node[parts[i]] || typeof node[parts[i]] !== 'object') node[parts[i]] = {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
  return obj;
}

function coerce(field, value) {
  if (value === undefined || value === null) return clone(field.default);

  switch (field.type) {
    case 'number': {
      const num = Number(String(value).replace(',', '.'));
      if (!Number.isFinite(num)) return clone(field.default);
      let out = num;
      if (typeof field.min === 'number') out = Math.max(field.min, out);
      if (typeof field.max === 'number') out = Math.min(field.max, out);
      return out;
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      const text = String(value).trim().toLowerCase();
      return text === '1' || text === 'true' || text === 'yes' || text === 'on';
    }
    case 'select': {
      const allowed = (field.options || []).map((o) => o.value);
      return allowed.includes(value) ? value : clone(field.default);
    }
    default: {
      const text = String(value);
      if (field.validate && field.validate.pattern) {
        try {
          if (!new RegExp(field.validate.pattern).test(text)) return clone(field.default);
        } catch (_) {
          /* ignore bad pattern */
        }
      }
      return field.type === 'string' ? text.trim() : text;
    }
  }
}

class ConfigStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = defaultsObject();
    this.unknown = {};
    this.loadError = null;
    this.load();
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      this.merge(raw);
    } catch (err) {
      if (err.code !== 'ENOENT') this.loadError = err.message;
    }
    return this;
  }

  merge(raw) {
    if (!raw || typeof raw !== 'object') return;
    for (const field of FIELDS) {
      const value = getPath(raw, field.key);
      if (value !== undefined) setPath(this.data, field.key, coerce(field, value));
    }
    for (const key of Object.keys(raw)) {
      if (!key.startsWith('_') && !(key in this.data)) this.unknown[key] = raw[key];
    }
  }

  all() {
    return clone(this.data);
  }

  /** Dotted-key view (ollama.url, automation.delayMs, ...) used by the LLM adapters. */
  flat() {
    const out = {};
    for (const field of FIELDS) out[field.key] = this.get(field.key);
    return out;
  }

  get(key) {
    const value = getPath(this.data, key);
    return value === undefined ? undefined : clone(value);
  }

  set(key, value) {
    const field = FIELD_BY_KEY[key];
    if (!field) throw new Error(`Неизвестная настройка: ${key}`);
    setPath(this.data, key, coerce(field, value));
    return this.get(key);
  }

  setMany(values) {
    for (const [key, value] of Object.entries(values || {})) this.set(key, value);
  }

  reset(key) {
    const field = FIELD_BY_KEY[key];
    if (!field) throw new Error(`Неизвестная настройка: ${key}`);
    setPath(this.data, key, clone(field.default));
    return this.get(key);
  }

  resetAll() {
    this.data = defaultsObject();
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const payload = { ...this.data, _version: 1, ...this.unknown };
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    try {
      if (fs.existsSync(this.filePath)) fs.copyFileSync(this.filePath, `${this.filePath}.bak`);
    } catch (_) {
      /* backup is best effort */
    }
    fs.renameSync(tmp, this.filePath);
    return this;
  }

  /** Applies --set key=value / --backend x / --reset key from the command line (not persisted). */
  applyArgv(argv) {
    const applied = {};
    for (let i = 0; i < argv.length; i += 1) {
      const arg = argv[i];
      if (arg === '--set' && argv[i + 1]) {
        const pair = argv[i + 1];
        const eq = pair.indexOf('=');
        if (eq > 0) {
          const key = pair.slice(0, eq);
          applied[key] = this.set(key, pair.slice(eq + 1));
        }
        i += 1;
      } else if (arg === '--reset' && argv[i + 1]) {
        applied[argv[i + 1]] = this.reset(argv[i + 1]);
        i += 1;
      } else if (arg === '--backend' && argv[i + 1]) {
        applied.backend = this.set('backend', argv[i + 1]);
        i += 1;
      } else if (arg === '--model' && argv[i + 1]) {
        const key = this.get('backend') === 'opencode' ? 'opencode.model' : 'ollama.model';
        applied[key] = this.set(key, argv[i + 1]);
        i += 1;
      } else if (arg === '--delay' && argv[i + 1]) {
        applied['automation.delayMs'] = this.set('automation.delayMs', argv[i + 1]);
        i += 1;
      }
    }
    return applied;
  }
}

module.exports = { ConfigStore, coerce, getPath, setPath };
