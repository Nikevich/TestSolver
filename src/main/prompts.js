// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    answers: { type: 'array', items: { type: 'integer' }, minItems: 1 },
    confidence: { type: 'number' },
    reason: { type: 'string' }
  },
  required: ['answers', 'confidence'],
  additionalProperties: false
};

const VISION_SCHEMA = {
  type: 'object',
  properties: {
    question: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } }
  },
  required: ['question', 'options'],
  additionalProperties: false
};

const TEXT_ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    value: { type: 'string' },
    confidence: { type: 'number' },
    reason: { type: 'string' }
  },
  required: ['value', 'confidence'],
  additionalProperties: false
};

const SYSTEM_PROMPT = [
  'Ты — эксперт по прохождению тестов. Тебе дают вопрос и варианты ответа с нумерацией с нуля.',
  'Определи правильный вариант (или варианты, если вопрос множественный).',
  'Отвечай ТОЛЬКО валидным JSON без markdown и пояснений вне JSON.',
  'Схема: {"answers": [номер_варианта], "confidence": 0..1, "reason": "кратко"}.',
  'answers содержит индексы правильных вариантов из списка. Для одиночного выбора — ровно один индекс.'
].join(' ');

function buildUserPrompt(question, options, type, extraHint) {
  const lines = [];
  lines.push('Вопрос:');
  lines.push(question && question.trim() ? question.trim() : '(текст вопроса не распознан, ориентируйся на варианты)');
  lines.push('');
  lines.push('Варианты ответа:');
  options.forEach((opt, i) => {
    lines.push(`${i}) ${String(opt.text || '').replace(/\s+/g, ' ').trim()}`);
  });
  lines.push('');
  lines.push(type === 'multi'
    ? 'Тип вопроса: множественный выбор. Верни все правильные индексы в answers.'
    : 'Тип вопроса: одиночный выбор. Верни ровно один индекс в answers.');
  if (extraHint) {
    lines.push('');
    lines.push(extraHint);
  }
  lines.push('');
  lines.push('Верни только JSON по схеме.');
  return lines.join('\n');
}

function buildMessages(question, options, type, extraHint) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(question, options, type, extraHint) }
  ];
}

const VISION_PROMPT = [
  'На скриншоте страница электронного теста.',
  'Извлеки текст вопроса и все варианты ответа в том порядке, в котором они расположены.',
  'Не решай вопрос, только распознай текст.',
  'Верни JSON: {"question": "...", "options": ["вариант 1", "вариант 2"]}.'
].join(' ');

/* ------------------------- text answers ------------------------- */

const TEXT_SYSTEM_PROMPT = [
  'Ты — эксперт по прохождению тестов. Ответ вводится в текстовое поле, вариантов выбора нет.',
  'Определи, что именно нужно напечатать, и верни это строкой.',
  'Отвечай ТОЛЬКО валидным JSON без markdown и пояснений вне JSON.',
  'Схема: {"value": "то, что нужно ввести", "confidence": 0..1, "reason": "кратко"}.'
].join(' ');

/** Finds the numbered list inside a question ("1. ...", "2) ..."). */
function parseItems(text) {
  const items = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const match = raw.trim().match(/^(\d{1,2})\s*[.)]\s+(.{2,})$/);
    if (match) items.push({ n: Number(match[1]), text: match[2].replace(/\s+/g, ' ').trim() });
  }
  return items;
}

function buildTextPrompt(q, extraHint) {
  const items = Array.isArray(q.items) ? q.items : [];
  const lines = [];
  lines.push('Вопрос:');
  lines.push(q.question && String(q.question).trim() ? String(q.question).trim() : '(текст вопроса не распознан)');

  if (items.length > 1) {
    lines.push('');
    lines.push('Пункты, которые нужно упорядочить (номера — как на странице):');
    items.forEach((item) => lines.push(`${item.n}) ${item.text}`));
  }

  if (q.expectedFormat) {
    lines.push('');
    lines.push(`Требование к формату из задания: ${q.expectedFormat}`);
  }
  if (q.inputHint) {
    lines.push('');
    lines.push(`Подпись поля ввода: ${q.inputHint}`);
  }

  lines.push('');
  if (items.length > 1) {
    lines.push(
      `Верни в value правильный порядок номеров — ровно ${items.length} цифр, каждая от 1 до ${items.length}, без пробелов, запятых и других разделителей.`
    );
    lines.push('Пример формата: 15432.');
  } else {
    lines.push('Верни в value ровно то, что нужно ввести в поле (число, слово или короткую фразу, без кавычек и пояснений).');
  }
  if (extraHint) {
    lines.push('');
    lines.push(extraHint);
  }
  lines.push('');
  lines.push('Верни только JSON по схеме.');
  return lines.join('\n');
}

function buildTextMessages(q, extraHint) {
  return [
    { role: 'system', content: TEXT_SYSTEM_PROMPT },
    { role: 'user', content: buildTextPrompt(q, extraHint) }
  ];
}

function isPermutation(digits, count) {
  if (!digits || digits.length !== count) return false;
  const seen = new Set();
  for (const ch of digits) {
    const n = Number(ch);
    if (!Number.isInteger(n) || n < 1 || n > count || seen.has(n)) return false;
    seen.add(n);
  }
  return seen.size === count;
}

/**
 * Normalizes a text answer. When the question contains a numbered list, the
 * value must be a permutation of 1..N (digits only), otherwise null.
 */
function normalizeTextAnswer(raw, { items = [] } = {}) {
  if (!raw || typeof raw !== 'object') return null;

  let value = raw.value;
  if (value === undefined || value === null) {
    if (Array.isArray(raw.answers)) value = raw.answers.join('');
    else if (raw.answer !== undefined) value = raw.answer;
  }
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') value = String(value);

  value = String(value)
    .replace(/```/g, '')
    .replace(/^["'«»\s]+|["'«»\s]+$/g, '')
    .trim();
  if (!value) return null;

  const count = Array.isArray(items) ? items.length : 0;
  if (count > 1) {
    const digits = value.replace(/\D/g, '');
    if (!isPermutation(digits, count)) return null;
    value = digits;
  }

  if (value.length > 200) value = value.slice(0, 200);

  let confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.5;
  if (confidence > 1) confidence = confidence > 100 ? confidence / 100 : 1;
  if (confidence < 0) confidence = 0;

  return {
    value,
    confidence,
    reason: typeof raw.reason === 'string' ? raw.reason.slice(0, 1000) : ''
  };
}


function parseJson(text) {
  if (text == null) return null;
  if (typeof text === 'object') return text;
  let source = String(text).trim();
  source = source.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();

  try {
    return JSON.parse(source);
  } catch (_) {
    /* fall through */
  }

  const first = source.indexOf('{');
  const last = source.lastIndexOf('}');
  if (first >= 0 && last > first) {
    const slice = source.slice(first, last + 1);
    try {
      return JSON.parse(slice);
    } catch (_) {
      return null;
    }
  }
  return null;
}

function normalizeAnswer(raw, optionsLength) {
  if (!raw || typeof raw !== 'object') return null;
  let answers = raw.answers;
  if (typeof answers === 'number') answers = [answers];
  if (typeof answers === 'string') answers = answers.split(/[,;\s]+/).filter(Boolean).map(Number);
  if (!Array.isArray(answers)) return null;

  answers = Array.from(
    new Set(
      answers
        .map((v) => Number(String(v).replace(/[^\d-]/g, '')))
        .filter((v) => Number.isInteger(v) && v >= 0 && v < optionsLength)
    )
  );
  if (!answers.length) return null;

  let confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.5;
  if (confidence > 1) confidence = confidence > 100 ? confidence / 100 : 1;
  if (confidence < 0) confidence = 0;

  return {
    answers,
    confidence,
    reason: typeof raw.reason === 'string' ? raw.reason.slice(0, 1000) : ''
  };
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Dice coefficient over word bigrams, 0..1. Good enough to match OCR text to DOM options. */
function similarity(a, b) {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.startsWith(nb) || nb.startsWith(na)) return 0.95;

  const bigrams = (s) => {
    const out = new Map();
    const words = s.split(' ');
    for (let i = 0; i < words.length - 1; i += 1) {
      const key = `${words[i]} ${words[i + 1]}`;
      out.set(key, (out.get(key) || 0) + 1);
    }
    if (!out.size && words.length === 1) out.set(words[0], 1);
    return out;
  };

  const ma = bigrams(na);
  const mb = bigrams(nb);
  let overlap = 0;
  for (const [key, count] of ma) overlap += Math.min(count, mb.get(key) || 0);
  const total = [...ma.values()].reduce((s, v) => s + v, 0) + [...mb.values()].reduce((s, v) => s + v, 0);
  return total ? (2 * overlap) / total : 0;
}

/**
 * Maps recognized options (e.g. from a screenshot) back to DOM option indexes.
 * Returns an array of DOM indexes or null when the match is not reliable.
 */
function matchOptions(recognized, domOptions) {
  if (!Array.isArray(recognized) || !recognized.length || !Array.isArray(domOptions) || !domOptions.length) {
    return null;
  }
  if (recognized.length === domOptions.length) {
    const exact = recognized.every((text, i) => similarity(text, domOptions[i].text) >= 0.6);
    if (exact) return recognized.map((_, i) => i);
  }

  const used = new Set();
  const mapped = [];
  for (const text of recognized) {
    let bestIndex = -1;
    let bestScore = 0;
    domOptions.forEach((opt, i) => {
      if (used.has(i)) return;
      const score = similarity(text, opt.text);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    });
    if (bestIndex >= 0 && bestScore >= 0.62) {
      used.add(bestIndex);
      mapped.push({ domIndex: bestIndex, score: bestScore });
    }
  }

  if (mapped.length !== recognized.length) return null;
  return mapped;
}

module.exports = {
  ANSWER_SCHEMA,
  VISION_SCHEMA,
  TEXT_ANSWER_SCHEMA,
  SYSTEM_PROMPT,
  VISION_PROMPT,
  TEXT_SYSTEM_PROMPT,
  buildMessages,
  buildUserPrompt,
  buildTextMessages,
  buildTextPrompt,
  parseItems,
  parseJson,
  normalizeAnswer,
  normalizeTextAnswer,
  isPermutation,
  normalizeText,
  similarity,
  matchOptions
};
