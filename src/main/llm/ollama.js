// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

const { spawn } = require('child_process');
const {
  ANSWER_SCHEMA,
  VISION_SCHEMA,
  TEXT_ANSWER_SCHEMA,
  VISION_PROMPT,
  buildMessages,
  buildTextMessages,
  parseJson,
  normalizeAnswer,
  normalizeTextAnswer
} = require('../prompts');

function joinUrl(base, path) {
  return `${String(base || 'http://127.0.0.1:11434').replace(/\/+$/, '')}${path}`;
}

async function request(base, path, { method = 'GET', body, timeoutMs = 120000, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetch(joinUrl(base, path), {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Ollama ${response.status}: ${text.slice(0, 400)}`);
    }
    return text ? JSON.parse(text) : null;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`Ollama не ответил за ${Math.round(timeoutMs / 1000)} с`);
    throw err;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

async function health(cfg, { timeoutMs = 2500 } = {}) {
  try {
    const data = await request(cfg['ollama.url'], '/api/tags', { timeoutMs });
    const models = Array.isArray(data && data.models) ? data.models.map((m) => m.name) : [];
    return { ok: true, models };
  } catch (err) {
    return { ok: false, error: err.message, models: [] };
  }
}

async function listModels(cfg) {
  const data = await request(cfg['ollama.url'], '/api/tags', { timeoutMs: 5000 });
  return (data && data.models ? data.models : []).map((m) => ({
    name: m.name,
    size: m.size,
    modified: m.modified_at
  }));
}

async function chat(cfg, { messages, format, model, signal }) {
  const data = await request(cfg['ollama.url'], '/api/chat', {
    method: 'POST',
    timeoutMs: Number(cfg['ollama.timeoutMs']) || 120000,
    signal,
    body: {
      model: model || cfg['ollama.model'],
      messages,
      stream: false,
      format,
      keep_alive: cfg['ollama.keepAlive'] || '30m',
      options: {
        temperature: Number(cfg['ollama.temperature']) || 0,
        num_ctx: Number(cfg['ollama.numCtx']) || 4096
      }
    }
  });
  const content = data && data.message && data.message.content;
  return { content: content || '', raw: data };
}

async function solve(cfg, question, options, type, extraHint, { signal } = {}) {
  const { content } = await chat(cfg, {
    messages: buildMessages(question, options, type, extraHint),
    format: ANSWER_SCHEMA,
    signal
  });
  const parsed = parseJson(content);
  const answer = normalizeAnswer(parsed, options.length);
  if (!answer) {
    const err = new Error('Модель вернула невалидный ответ');
    err.raw = content;
    throw err;
  }
  return { ...answer, model: cfg['ollama.model'], backend: 'ollama', raw: content };
}

async function solveText(cfg, q, extraHint, { signal } = {}) {
  const { content } = await chat(cfg, {
    messages: buildTextMessages(q, extraHint),
    format: TEXT_ANSWER_SCHEMA,
    signal
  });
  const answer = normalizeTextAnswer(parseJson(content), { items: q.items || [] });
  if (!answer) {
    const err = new Error('Модель вернула невалидный ответ для текстового поля');
    err.raw = content;
    throw err;
  }
  return { ...answer, backend: 'ollama', model: cfg['ollama.model'], raw: content };
}

async function visionExtract(cfg, pngBase64) {
  const { content } = await chat(cfg, {
    model: cfg['ollama.visionModel'],
    format: VISION_SCHEMA,
    messages: [
      { role: 'system', content: VISION_PROMPT },
      { role: 'user', content: VISION_PROMPT, images: [pngBase64] }
    ]
  });
  const parsed = parseJson(content);
  if (!parsed || !Array.isArray(parsed.options) || !parsed.options.length) {
    throw new Error('Vision-модель не распознала варианты');
  }
  return {
    question: typeof parsed.question === 'string' ? parsed.question : '',
    options: parsed.options.map((text) => String(text))
  };
}

async function pull(cfg, model, onProgress, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60 * 60 * 1000);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetch(joinUrl(cfg['ollama.url'], '/api/pull'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, stream: true }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Ollama ${response.status}: ${(await response.text()).slice(0, 300)}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed);
          if (onProgress) onProgress(event);
        } catch (_) {
          /* ignore malformed chunk */
        }
      }
    }
    return true;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/** Starts `ollama serve` in the background when the daemon is not running yet. */
function startServer(bin = 'ollama') {
  try {
    const child = spawn(bin, ['serve'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { health, listModels, chat, solve, solveText, visionExtract, pull, startServer, request };
