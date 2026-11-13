// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

const ollama = require('./llm/ollama');
const opencode = require('./llm/opencode');
const { matchOptions, parseItems, normalizeTextAnswer, buildRetryHint } = require('./prompts');
const { languageOf } = require('../shared/i18n');

function mockChoiceAnswer(q, language) {
  const options = q.options || [];
  const index = Math.floor(Math.random() * Math.max(1, options.length));
  return {
    answers: [index],
    confidence: 0.99,
    reason: language === 'ru' ? 'mock: ответ выбран случайно' : 'mock: answer chosen at random',
    backend: 'mock',
    model: 'mock'
  };
}

/** Mock keeps the pipeline testable without a model: ascending order for lists. */
function mockTextAnswer(q, language) {
  const items = q.items || [];
  const value = items.length > 1
    ? items.map((_, i) => String(i + 1)).join('')
    : '42';
  const reason = language === 'ru' ? 'mock: значение по умолчанию' : 'mock: default value';
  return {
    value: normalizeTextAnswer({ value, confidence: 0.99, reason }, { items }).value,
    confidence: 0.99,
    reason,
    backend: 'mock',
    model: 'mock'
  };
}

async function ask(cfg, q, extraHint, opts = {}) {
  const language = languageOf(cfg);
  if (cfg.backend === 'mock') {
    return q.type === 'text' ? mockTextAnswer(q, language) : mockChoiceAnswer(q, language);
  }

  if (cfg.backend === 'opencode') {
    return q.type === 'text'
      ? opencode.solveText(cfg, q, extraHint, opts)
      : opencode.solve(cfg, q.question, q.options, q.type, extraHint, opts);
  }

  return q.type === 'text'
    ? ollama.solveText(cfg, q, extraHint, opts)
    : ollama.solve(cfg, q.question, q.options, q.type, extraHint, opts);
}

function retryHint(q, language) {
  return buildRetryHint(q, language);
}

/** One question -> answer. Retries once when the model returns garbage. */
async function solveQuiz(cfg, q, { signal } = {}) {
  try {
    return await ask(cfg, q, undefined, { signal });
  } catch (err) {
    if (signal && signal.aborted) throw err;
    return ask(cfg, q, retryHint(q, languageOf(cfg)), { signal });
  }
}

/**
 * Fallback: screenshot -> vision model extracts question/options -> text model answers.
 * Vision always goes through Ollama (local vision models), even when the text
 * backend is opencode.
 */
async function solveWithVision(cfg, q, capture, { signal } = {}) {
  const png = await capture();
  if (!png) throw new Error('Не удалось сделать скриншот страницы');

  const recognized = await ollama.visionExtract(cfg, png);

  if (q.type === 'text') {
    const items = parseItems(recognized.question);
    const fallbackItems = Array.isArray(recognized.options)
      ? recognized.options.map((text, i) => ({ n: i + 1, text: String(text) }))
      : [];
    const visionQuestion = {
      ...q,
      question: recognized.question || q.question,
      items: items.length ? items : (fallbackItems.length ? fallbackItems : q.items)
    };
    const textAnswer = await ask(cfg, visionQuestion, undefined, { signal });
    return {
      ...textAnswer,
      confidence: Math.min(Number(textAnswer.confidence) || 0.5, 0.9),
      reason: `vision: ${textAnswer.reason || ''}`.trim(),
      vision: true,
      recognized
    };
  }

  const textOptions = recognized.options.map((text, i) => ({ i, text }));
  const mapping = matchOptions(recognized.options, q.options);

  const answer = await ask(cfg, { ...q, question: recognized.question, options: textOptions, type: 'single' }, undefined, { signal });
  if (!mapping) {
    // Order-based fallback: same screenshot, same order as in DOM.
    if (recognized.options.length === q.options.length) {
      return {
        ...answer,
        confidence: Math.min(answer.confidence, 0.6) * 0.9,
        reason: `vision (по порядку): ${answer.reason || ''}`.trim(),
        vision: true,
        recognized
      };
    }
    throw new Error('Vision не смог сопоставить варианты со страницей');
  }

  const answers = answer.answers
    .map((idx) => (mapping[idx] ? mapping[idx].domIndex : -1))
    .filter((idx) => idx >= 0);

  if (!answers.length) throw new Error('Vision вернул варианты, которых нет на странице');

  return {
    ...answer,
    answers,
    confidence: Math.min(answer.confidence, 0.9),
    reason: `vision: ${answer.reason || ''}`.trim(),
    vision: true,
    recognized
  };
}

module.exports = { solveQuiz, solveWithVision, ask };
