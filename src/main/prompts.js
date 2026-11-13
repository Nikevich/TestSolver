// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

const { normalizeLanguage } = require('../shared/i18n');

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

/**
 * Prompts sent to the model. They follow the interface language so the model
 * answers in the same language as the test when needed, while JSON keys stay
 * stable.
 */
const PROMPTS = {
  ru: {
    system: [
      'Ты — эксперт по прохождению тестов. Тебе дают вопрос и варианты ответа с нумерацией с нуля.',
      'Определи правильный вариант (или варианты, если вопрос множественный).',
      'Отвечай ТОЛЬКО валидным JSON без markdown и пояснений вне JSON.',
      'Схема: {"answers": [номер_варианта], "confidence": 0..1, "reason": "кратко"}.',
      'answers содержит индексы правильных вариантов из списка. Для одиночного выбора — ровно один индекс.'
    ].join(' '),
    vision: [
      'На скриншоте страница электронного теста.',
      'Извлеки текст вопроса и все варианты ответа в том порядке, в котором они расположены.',
      'Не решай вопрос, только распознай текст.',
      'Верни JSON: {"question": "...", "options": ["вариант 1", "вариант 2"]}.'
    ].join(' '),
    textSystem: [
      'Ты — эксперт по прохождению тестов. Ответ вводится в текстовое поле, вариантов выбора нет.',
      'Определи, что именно нужно напечатать, и верни это строкой.',
      'Отвечай ТОЛЬКО валидным JSON без markdown и пояснений вне JSON.',
      'Схема: {"value": "то, что нужно ввести", "confidence": 0..1, "reason": "кратко"}.'
    ].join(' '),
    question: 'Вопрос:',
    questionUnknown: '(текст вопроса не распознан, ориентируйся на варианты)',
    questionUnknownShort: '(текст вопроса не распознан)',
    options: 'Варианты ответа:',
    typeMulti: 'Тип вопроса: множественный выбор. Верни все правильные индексы в answers.',
    typeSingle: 'Тип вопроса: одиночный выбор. Верни ровно один индекс в answers.',
    returnJson: 'Верни только JSON по схеме.',
    itemsOrder: 'Пункты, которые нужно упорядочить (номера — как на странице):',
    expectedFormat: 'Требование к формату из задания: {value}',
    inputHint: 'Подпись поля ввода: {value}',
    permutation:
      'Верни в value правильный порядок номеров — ровно {count} цифр, каждая от 1 до {count}, без пробелов, запятых и других разделителей.',
    permutationExample: 'Пример формата: 15432.',
    textValue:
      'Верни в value ровно то, что нужно ввести в поле (число, слово или короткую фразу, без кавычек и пояснений).',
    retryPermutation:
      'Предыдущий ответ не подошёл. Верни перестановку чисел 1..{count} без пробелов в поле value.',
    retryText: 'Предыдущий ответ не подошёл. Верни только значение для поля ввода в value, без пояснений.',
    retryJson: 'Предыдущий ответ не соответствовал схеме. Верни ТОЛЬКО JSON с индексами из списка.',
    cliSystem: 'Ты — эксперт по тестам. Ответь на вопрос и верни ТОЛЬКО JSON.',
    cliFormat:
      'Формат: {"answers":[индексы правильных вариантов с нуля],"confidence":0..1,"reason":"кратко"}',
    cliOptions: 'Варианты:',
    cliMulti: 'Вопрос множественного выбора: верни все правильные индексы.',
    cliSingle: 'Одиночный выбор: ровно один индекс.',
    cliNoMarkdown: 'Без markdown, без пояснений вне JSON.'
  },

  en: {
    system: [
      'You are an expert at taking tests. You are given a question and answer options numbered from zero.',
      'Determine the correct option (or options if the question is multiple-choice).',
      'Reply with ONLY valid JSON, no markdown and no explanations outside JSON.',
      'Schema: {"answers": [option_index], "confidence": 0..1, "reason": "brief"}.',
      'answers contains the indexes of the correct options from the list. For single choice return exactly one index.'
    ].join(' '),
    vision: [
      'The screenshot shows an electronic test page.',
      'Extract the question text and all answer options in the order they appear.',
      'Do not solve the question, only recognize the text.',
      'Return JSON: {"question": "...", "options": ["option 1", "option 2"]}.'
    ].join(' '),
    textSystem: [
      'You are an expert at taking tests. The answer goes into a text field; there are no options to choose.',
      'Determine exactly what needs to be typed and return it as a string.',
      'Reply with ONLY valid JSON, no markdown and no explanations outside JSON.',
      'Schema: {"value": "what to enter", "confidence": 0..1, "reason": "brief"}.'
    ].join(' '),
    question: 'Question:',
    questionUnknown: '(question text not recognized, rely on the options)',
    questionUnknownShort: '(question text not recognized)',
    options: 'Answer options:',
    typeMulti: 'Question type: multiple choice. Return all correct indexes in answers.',
    typeSingle: 'Question type: single choice. Return exactly one index in answers.',
    returnJson: 'Return only JSON matching the schema.',
    itemsOrder: 'Items to order (numbers as on the page):',
    expectedFormat: 'Format requirement from the task: {value}',
    inputHint: 'Input field label: {value}',
    permutation:
      'Return in value the correct order of the numbers — exactly {count} digits, each from 1 to {count}, without spaces, commas or other separators.',
    permutationExample: 'Example format: 15432.',
    textValue:
      'Return in value exactly what needs to be entered into the field (a number, a word or a short phrase, without quotes or explanations).',
    retryPermutation:
      'The previous answer did not fit. Return a permutation of the numbers 1..{count} without spaces in the value field.',
    retryText: 'The previous answer did not fit. Return only the value for the input field in value, without explanations.',
    retryJson: 'The previous answer did not match the schema. Return ONLY JSON with indexes from the list.',
    cliSystem: 'You are a test expert. Answer the question and return ONLY JSON.',
    cliFormat:
      'Format: {"answers":[zero-based indexes of the correct options],"confidence":0..1,"reason":"brief"}',
    cliOptions: 'Options:',
    cliMulti: 'Multiple-choice question: return all correct indexes.',
    cliSingle: 'Single choice: exactly one index.',
    cliNoMarkdown: 'No markdown, no explanations outside JSON.'
  }
};

function langOf(language) {
  return normalizeLanguage(language);
}

function textOf(language, key, params) {
  const dict = PROMPTS[langOf(language)];
  let text = dict[key];
  if (text === undefined) text = PROMPTS.en[key];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value == null ? '' : value));
    }
  }
  return text;
}

function getSystemPrompt(language) {
  return textOf(language, 'system');
}

function getVisionPrompt(language) {
  return textOf(language, 'vision');
}

function getTextSystemPrompt(language) {
  return textOf(language, 'textSystem');
}

/** Builds the user message for a choice question in the selected language. */
function buildUserPrompt(question, options, type, extraHint, language) {
  const L = (key, params) => textOf(language, key, params);
  const lines = [];
  lines.push(L('question'));
  lines.push(question && question.trim() ? question.trim() : L('questionUnknown'));
  lines.push('');
  lines.push(L('options'));
  options.forEach((opt, i) => {
    lines.push(`${i}) ${String(opt.text || '').replace(/\s+/g, ' ').trim()}`);
  });
  lines.push('');
  lines.push(type === 'multi' ? L('typeMulti') : L('typeSingle'));
  if (extraHint) {
    lines.push('');
    lines.push(extraHint);
  }
  lines.push('');
  lines.push(L('returnJson'));
  return lines.join('\n');
}

function buildMessages(question, options, type, extraHint, language) {
  return [
    { role: 'system', content: getSystemPrompt(language) },
    { role: 'user', content: buildUserPrompt(question, options, type, extraHint, language) }
  ];
}

/* ------------------------- text answers ------------------------- */

/** Finds the numbered list inside a question ("1. ...", "2) ..."). */
function parseItems(text) {
  const items = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const match = raw.trim().match(/^(\d{1,2})\s*[.)]\s+(.{2,})$/);
    if (match) items.push({ n: Number(match[1]), text: match[2].replace(/\s+/g, ' ').trim() });
  }
  return items;
}

function buildTextPrompt(q, extraHint, language) {
  const L = (key, params) => textOf(language, key, params);
  const items = Array.isArray(q.items) ? q.items : [];
  const lines = [];
  lines.push(L('question'));
  lines.push(q.question && String(q.question).trim() ? String(q.question).trim() : L('questionUnknownShort'));

  if (items.length > 1) {
    lines.push('');
    lines.push(L('itemsOrder'));
    items.forEach((item) => lines.push(`${item.n}) ${item.text}`));
  }

  if (q.expectedFormat) {
    lines.push('');
    lines.push(L('expectedFormat', { value: q.expectedFormat }));
  }
  if (q.inputHint) {
    lines.push('');
    lines.push(L('inputHint', { value: q.inputHint }));
  }

  lines.push('');
  if (items.length > 1) {
    lines.push(L('permutation', { count: items.length }));
    lines.push(L('permutationExample'));
  } else {
    lines.push(L('textValue'));
  }
  if (extraHint) {
    lines.push('');
    lines.push(extraHint);
  }
  lines.push('');
  lines.push(L('returnJson'));
  return lines.join('\n');
}

function buildTextMessages(q, extraHint, language) {
  return [
    { role: 'system', content: getTextSystemPrompt(language) },
    { role: 'user', content: buildTextPrompt(q, extraHint, language) }
  ];
}

/** Retry hints in the selected language. */
function buildRetryHint(q, language) {
  if (q.type === 'text') {
    const count = Array.isArray(q.items) ? q.items.length : 0;
    if (count > 1) return textOf(language, 'retryPermutation', { count });
    return textOf(language, 'retryText');
  }
  return textOf(language, 'retryJson');
}

/** opencode CLI has no system/user split, so the whole prompt is one string. */
function buildCliPrompt(question, options, type, language) {
  const L = (key) => textOf(language, key);
  const lines = [];
  lines.push(L('cliSystem'));
  lines.push(L('cliFormat'));
  lines.push('');
  lines.push(L('question'));
  lines.push(question && question.trim() ? question.trim() : L('questionUnknownShort'));
  lines.push('');
  lines.push(L('cliOptions'));
  options.forEach((opt, i) => lines.push(`${i}) ${String(opt.text || '').replace(/\s+/g, ' ').trim()}`));
  lines.push('');
  lines.push(type === 'multi' ? L('cliMulti') : L('cliSingle'));
  lines.push(L('cliNoMarkdown'));
  return lines.join('\n');
}

const SYSTEM_PROMPT = getSystemPrompt('en');
const VISION_PROMPT = getVisionPrompt('en');
const TEXT_SYSTEM_PROMPT = getTextSystemPrompt('en');

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
  PROMPTS,
  SYSTEM_PROMPT,
  VISION_PROMPT,
  TEXT_SYSTEM_PROMPT,
  getSystemPrompt,
  getVisionPrompt,
  getTextSystemPrompt,
  buildMessages,
  buildUserPrompt,
  buildTextMessages,
  buildTextPrompt,
  buildRetryHint,
  buildCliPrompt,
  parseItems,
  parseJson,
  normalizeAnswer,
  normalizeTextAnswer,
  isPermutation,
  normalizeText,
  similarity,
  matchOptions
};
