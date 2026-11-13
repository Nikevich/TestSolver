// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { ANSWER_SCHEMA, buildTextPrompt, buildCliPrompt, parseJson, normalizeAnswer, normalizeTextAnswer } = require('../prompts');
const { languageOf, t } = require('../../shared/i18n');

function execFileP(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout: 10000, ...options }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = stderr;
        reject(err);
        return;
      }
      resolve(String(stdout || ''));
    });
  });
}

/**
 * npm installs CLI tools as .cmd/.ps1 shims on Windows. They cannot be spawned
 * directly without a shell, so we read the shim and find the real executable.
 */
function expandShim(shimPath) {
  try {
    const text = fs.readFileSync(shimPath, 'utf8');
    const dir = path.dirname(shimPath);

    const absolute = text.match(/([A-Za-z]:\\[^"'\r\n]*?\.exe)/i);
    if (absolute && fs.existsSync(absolute[1])) return absolute[1];

    const dp0 = text.match(/%?~?dp0%?[\\/]([^"'\r\n]+?\.exe)/i);
    if (dp0) {
      const candidate = path.join(dir, dp0[1]);
      if (fs.existsSync(candidate)) return candidate;
    }

    const basedir = text.match(/\$basedir[\\/]([^"'\r\n]+?\.exe)/i);
    if (basedir) {
      const candidate = path.join(dir, basedir[1]);
      if (fs.existsSync(candidate)) return candidate;
    }

    const rel = text.match(/node_modules[\\/][^"'\r\n]*?\.exe/i);
    if (rel) {
      const candidate = path.join(dir, rel[0]);
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}

async function resolveBinary(configured) {
  const bin = String(configured || 'opencode').trim();

  if (/[\\/]/.test(bin)) {
    if (!fs.existsSync(bin)) throw new Error(`Файл не найден: ${bin}`);
    if (/\.exe$/i.test(bin)) return { path: bin };
    const real = expandShim(bin);
    return real ? { path: real } : { path: bin, viaShell: true };
  }

  let output = '';
  try {
    output = await execFileP('where.exe', [bin]);
  } catch (_) {
    throw new Error(
      `opencode не найден в PATH. Установите его или укажите полный путь в настройках (opencode.bin).`
    );
  }

  const lines = output
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const exe = lines.find((line) => /\.exe$/i.test(line));
  if (exe) return { path: exe };

  const shim = lines.find((line) => /\.(cmd|bat)$/i.test(line)) || lines.find((line) => /\.ps1$/i.test(line));
  if (shim) {
    const real = expandShim(shim);
    if (real) return { path: real };
    return { path: shim, viaShell: true };
  }

  if (lines.length) return { path: lines[0] };
  throw new Error('Не удалось определить путь к opencode');
}

function stripAnsi(text) {
  return String(text || '').replace(/\u001B\[[0-9;]*[A-Za-z]/g, '');
}

function parseOutput(stdout) {
  const clean = stripAnsi(stdout).trim();
  if (!clean) return { text: '', events: [] };

  try {
    const single = JSON.parse(clean);
    if (single && typeof single === 'object' && single.type) return { text: extractText([single]), events: [single] };
    if (single && typeof single === 'object') return { text: clean, events: [single] };
  } catch (_) {
    /* not a single JSON object */
  }

  const events = [];
  for (const line of clean.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) events.push(...parsed);
      else events.push(parsed);
    } catch (_) {
      /* skip non-JSON lines */
    }
  }

  const text = extractText(events);
  return { text: text || (events.length ? '' : clean), events };
}

function extractText(events) {
  const chunks = [];
  for (const event of events) {
    if (!event || typeof event !== 'object') continue;
    if (event.type === 'text' && event.part && typeof event.part.text === 'string') {
      chunks.push(event.part.text);
    } else if (event.type === 'message' && event.part && typeof event.part.text === 'string') {
      chunks.push(event.part.text);
    } else if (typeof event.text === 'string' && event.type !== 'step_start') {
      chunks.push(event.text);
    }
  }
  return chunks.join('\n').trim();
}

function runCli(binary, args, { timeoutMs = 180000, signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = binary.viaShell
      ? require('child_process').spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', binary.path, ...args], {
          windowsHide: true,
          cwd: os.tmpdir(),
          stdio: ['ignore', 'pipe', 'pipe']
        })
      : require('child_process').spawn(binary.path, args, {
          windowsHide: true,
          cwd: os.tmpdir(),
          stdio: ['ignore', 'pipe', 'pipe']
        });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const kill = () => {
      try {
        child.kill();
      } catch (_) {
        /* ignore */
      }
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      kill();
      const err = new Error('Остановлено пользователем');
      err.aborted = true;
      reject(err);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      kill();
      reject(new Error(`opencode не ответил за ${Math.round(timeoutMs / 1000)} с`));
    }, timeoutMs);

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Не удалось запустить opencode: ${err.message}`));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      if (code !== 0) {
        reject(new Error(`opencode завершился с кодом ${code}: ${stripAnsi(stderr).slice(0, 500)}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function listModels(cfg) {
  const binary = await resolveBinary(cfg['opencode.bin']);
  const { stdout } = await runCli(binary, ['models'], { timeoutMs: 30000 });
  return stripAnsi(stdout)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^[=\-]{3,}$/.test(line) && !/^\s*(models?|available)\s*$/i.test(line))
    .filter((line) => /^[\w.\-]+\/[\w.\-:]+$/.test(line))
    .map((line) => ({ name: line }));
}

async function solve(cfg, question, options, type, extraHint, { signal } = {}) {
  const binary = await resolveBinary(cfg['opencode.bin']);
  const prompt = buildCliPrompt(question, options, type, languageOf(cfg)) + (extraHint ? `\n\n${extraHint}` : '');
  const args = ['run'];
  const model = String(cfg['opencode.model'] || '').trim();
  if (model) args.push('-m', model);
  args.push('--format', 'json', prompt);

  const { stdout } = await runCli(binary, args, {
    timeoutMs: Number(cfg['opencode.timeoutMs']) || 180000,
    signal
  });
  const parsed = parseOutput(stdout);
  const { parseJson, normalizeAnswer } = require('../prompts');
  let answer = normalizeAnswer(parseJson(parsed.text), options.length);

  if (!answer && parsed.events.length) {
    const joined = parsed.events
      .map((e) => (e && typeof e === 'object' ? JSON.stringify(e) : ''))
      .join('\n');
    answer = normalizeAnswer(parseJson(joined), options.length);
  }

  if (!answer) {
    const err = new Error('opencode вернул невалидный ответ');
    err.raw = parsed.text || stdout;
    throw err;
  }

  return {
    ...answer,
    backend: 'opencode',
    model: model || 'default',
    raw: parsed.text
  };
}

async function solveText(cfg, q, extraHint, { signal } = {}) {
  const binary = await resolveBinary(cfg['opencode.bin']);
  const prompt = buildTextPrompt(q, extraHint, languageOf(cfg));
  const args = ['run'];
  const model = String(cfg['opencode.model'] || '').trim();
  if (model) args.push('-m', model);
  args.push('--format', 'json', prompt);

  const { stdout } = await runCli(binary, args, {
    timeoutMs: Number(cfg['opencode.timeoutMs']) || 180000,
    signal
  });
  const parsed = parseOutput(stdout);
  let answer = normalizeTextAnswer(parseJson(parsed.text), { items: q.items || [] });

  if (!answer && parsed.events.length) {
    const joined = parsed.events
      .map((e) => (e && typeof e === 'object' ? JSON.stringify(e) : ''))
      .join('\n');
    answer = normalizeTextAnswer(parseJson(joined), { items: q.items || [] });
  }

  if (!answer) {
    const err = new Error('opencode вернул невалидный ответ для текстового поля');
    err.raw = parsed.text || stdout;
    throw err;
  }

  return {
    ...answer,
    backend: 'opencode',
    model: model || 'default',
    raw: parsed.text
  };
}

async function health(cfg) {
  try {
    const binary = await resolveBinary(cfg['opencode.bin']);
    return { ok: true, path: binary.path };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function test(cfg) {
  const binary = await resolveBinary(cfg['opencode.bin']);
  const { stdout } = await runCli(binary, ['run', '--format', 'json', t(languageOf(cfg), 'llm.ping')], {
    timeoutMs: 120000
  });
  const parsed = parseOutput(stdout);
  if (!parsed.text) throw new Error('opencode не вернул текст');
  return { ok: true, text: parsed.text.slice(0, 200) };
}

module.exports = { solve, solveText, health, listModels, test, resolveBinary, parseOutput };
