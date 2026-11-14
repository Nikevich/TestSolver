// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

/**
 * Single source of truth for settings: UI form, defaults and validation
 * are generated from this list.
 *
 * User-visible strings are stored as { ru, en } objects so the renderer can
 * pick the active interface language.
 */

const GROUPS = [
  { id: 'ui', title: { ru: 'Интерфейс', en: 'Interface' } },
  { id: 'backend', title: { ru: 'Бэкенд', en: 'Backend' } },
  { id: 'ollama', title: 'Ollama' },
  { id: 'opencode', title: 'opencode' },
  { id: 'automation', title: { ru: 'Автоматизация', en: 'Automation' } },
  { id: 'vision', title: 'Vision' },
  { id: 'logging', title: { ru: 'Логи', en: 'Logging' } }
];

const FIELDS = [
  {
    key: 'ui.language', group: 'ui', label: { ru: 'Язык интерфейса', en: 'Interface language' }, type: 'select', default: 'en',
    options: [
      { value: 'ru', label: { ru: 'Русский', en: 'Russian' } },
      { value: 'en', label: { ru: 'Английский', en: 'English' } }
    ],
    help: {
      ru: 'Язык интерфейса, статусов автопрогона и промптов к модели.',
      en: 'Language of the interface, run statuses and model prompts.'
    }
  },
  {
    key: 'ui.panelWidth', group: 'ui', label: { ru: 'Ширина панели', en: 'Panel width' }, type: 'number',
    default: 400, min: 320, max: 900, step: 10, unit: 'px',
    help: { ru: 'Перетаскивается мышью.', en: 'Adjustable by dragging.' }
  },
  {
    key: 'ui.theme', group: 'ui', label: { ru: 'Тема', en: 'Theme' }, type: 'select', default: 'system',
    options: [
      { value: 'system', label: { ru: 'Как в системе', en: 'Same as system' } },
      { value: 'dark', label: { ru: 'Тёмная', en: 'Dark' } },
      { value: 'light', label: { ru: 'Светлая', en: 'Light' } }
    ],
    help: { ru: 'Оформление панели.', en: 'Panel appearance.' }
  },

  {
    key: 'backend', group: 'backend', label: { ru: 'Бэкенд', en: 'Backend' }, type: 'select', default: 'ollama',
    options: [
      { value: 'ollama', label: { ru: 'Ollama (локально)', en: 'Ollama (local)' } },
      { value: 'opencode', label: 'opencode CLI' },
      { value: 'mock', label: { ru: 'mock (отладка, без модели)', en: 'mock (debug, no model)' } }
    ],
    help: { ru: 'Кто отвечает на вопросы теста.', en: 'Which engine answers the test questions.' }
  },

  {
    key: 'ollama.url', group: 'ollama', label: 'URL', type: 'string',
    default: 'http://127.0.0.1:11434',
    validate: { pattern: '^https?://' },
    help: { ru: 'Адрес локального сервера Ollama.', en: 'Address of the local Ollama server.' }
  },
  {
    key: 'ollama.model', group: 'ollama', label: { ru: 'Модель', en: 'Model' }, type: 'string',
    default: 'qwen2.5:7b-instruct',
    help: { ru: 'Имя модели из `ollama list`.', en: 'Model name from `ollama list`.' }
  },
  {
    key: 'ollama.visionModel', group: 'ollama', label: { ru: 'Vision-модель', en: 'Vision model' }, type: 'string',
    default: 'qwen2.5vl:7b',
    help: { ru: 'Модель для распознавания скриншота.', en: 'Model used to recognize the screenshot.' }
  },
  {
    key: 'ollama.temperature', group: 'ollama', label: { ru: 'Температура', en: 'Temperature' }, type: 'number',
    default: 0, min: 0, max: 2, step: 0.1,
    help: { ru: '0 — максимально детерминированно.', en: '0 — as deterministic as possible.' }
  },
  {
    key: 'ollama.numCtx', group: 'ollama', label: 'num_ctx', type: 'number',
    default: 4096, min: 512, max: 131072, step: 512,
    help: { ru: 'Размер контекста.', en: 'Context size.' }
  },
  {
    key: 'ollama.keepAlive', group: 'ollama', label: 'keep_alive', type: 'string',
    default: '30m',
    help: { ru: 'Сколько держать модель в памяти.', en: 'How long to keep the model in memory.' }
  },
  {
    key: 'ollama.timeoutMs', group: 'ollama', label: { ru: 'Таймаут', en: 'Timeout' }, type: 'number',
    default: 120000, min: 5000, max: 900000, step: 1000, unit: { ru: 'мс', en: 'ms' },
    help: { ru: 'Ожидание ответа модели.', en: 'How long to wait for the model response.' }
  },

  {
    key: 'opencode.bin', group: 'opencode', label: { ru: 'Путь к opencode', en: 'opencode path' }, type: 'string',
    default: 'opencode',
    help: { ru: 'Имя в PATH или полный путь к opencode.exe.', en: 'Name in PATH or full path to opencode.exe.' }
  },
  {
    key: 'opencode.model', group: 'opencode', label: { ru: 'Модель', en: 'Model' }, type: 'string',
    default: '',
    help: {
      ru: 'Формат provider/model. Пусто — модель по умолчанию из opencode.',
      en: 'provider/model format. Empty — the default model from opencode.'
    }
  },
  {
    key: 'opencode.timeoutMs', group: 'opencode', label: { ru: 'Таймаут', en: 'Timeout' }, type: 'number',
    default: 180000, min: 10000, max: 900000, step: 1000, unit: { ru: 'мс', en: 'ms' },
    help: { ru: 'Ожидание ответа CLI.', en: 'How long to wait for the CLI response.' }
  },

  {
    key: 'automation.mode', group: 'automation', label: { ru: 'Режим', en: 'Mode' }, type: 'select',
    default: 'auto',
    options: [
      { value: 'auto', label: { ru: 'Полный автомат', en: 'Fully automatic' } },
      { value: 'confirm', label: { ru: 'Подсветить и ждать', en: 'Highlight and wait' } }
    ],
    help: {
      ru: 'confirm — выбирает ответ и ждёт нажатия «Продолжить» вручную.',
      en: 'confirm — selects an answer and waits for a manual “Continue” click.'
    }
  },
  {
    key: 'automation.delayMs', group: 'automation', label: { ru: 'Задержка перед «Продолжить»', en: 'Delay before “Continue”' },
    type: 'number', default: 3000, min: 0, max: 120000, step: 100, unit: { ru: 'мс', en: 'ms' },
    help: { ru: 'Пауза после выбора ответа.', en: 'Pause after selecting an answer.' }
  },
  {
    key: 'automation.jitterPct', group: 'automation', label: { ru: 'Разброс задержки', en: 'Delay jitter' }, type: 'number',
    default: 30, min: 0, max: 100, step: 5, unit: '%',
    help: { ru: 'Случайное отклонение задержки.', en: 'Random deviation of the delay.' }
  },
  {
    key: 'automation.maxQuestions', group: 'automation', label: { ru: 'Лимит вопросов', en: 'Question limit' }, type: 'number',
    default: 0, min: 0, max: 1000, step: 1,
    help: { ru: '0 — без лимита (до конца теста).', en: '0 — no limit (until the end of the test).' }
  },
  {
    key: 'automation.clickNext', group: 'automation', label: { ru: 'Нажимать «Продолжить»', en: 'Click “Continue”' }, type: 'boolean',
    default: true,
    help: { ru: 'Выключить, чтобы только подсвечивать ответ.', en: 'Turn off to only highlight answers.' }
  },
  {
    key: 'automation.dryRun', group: 'automation', label: { ru: 'Dry run (без кликов)', en: 'Dry run (no clicks)' }, type: 'boolean',
    default: false,
    help: { ru: 'Только логировать выбранные ответы.', en: 'Only log the selected answers.' }
  },
  {
    key: 'automation.questionChangeTimeoutMs', group: 'automation', label: { ru: 'Ожидание нового вопроса', en: 'Wait for the new question' },
    type: 'number', default: 15000, min: 1000, max: 120000, step: 500, unit: { ru: 'мс', en: 'ms' },
    help: { ru: 'Сколько ждать смены вопроса после клика.', en: 'How long to wait for the question to change after a click.' }
  },
  {
    key: 'automation.postClickWaitMs', group: 'automation', label: { ru: 'Пауза после загрузки', en: 'Pause after loading' },
    type: 'number', default: 1200, min: 0, max: 30000, step: 100, unit: { ru: 'мс', en: 'ms' },
    help: { ru: 'Дать странице дорисоваться.', en: 'Let the page finish rendering.' }
  },
  {
    key: 'automation.maxParseFailures', group: 'automation', label: { ru: 'Лимит ошибок парсинга', en: 'Parse failure limit' },
    type: 'number', default: 3, min: 1, max: 20, step: 1,
    help: { ru: 'После — остановка.', en: 'After this — stop.' }
  },
  {
    key: 'automation.stopOnLowConfidence', group: 'automation', label: { ru: 'Стоп при низкой уверенности', en: 'Stop on low confidence' },
    type: 'boolean', default: false,
    help: { ru: 'Останавливаться, если модель не уверена.', en: 'Stop if the model is not confident.' }
  },
  {
    key: 'automation.minConfidence', group: 'automation', label: { ru: 'Минимальная уверенность', en: 'Minimum confidence' },
    type: 'number', default: 0.4, min: 0, max: 1, step: 0.05,
    help: { ru: 'Порог для предыдущей опции.', en: 'Threshold for the previous option.' }
  },
  {
    key: 'automation.startUrl', group: 'automation', label: { ru: 'Стартовый URL', en: 'Start URL' }, type: 'string',
    default: '',
    help: { ru: 'Страница теста, открывается при запуске.', en: 'Test page opened at startup.' }
  },

  {
    key: 'vision.enabled', group: 'vision', label: { ru: 'Vision-фолбэк', en: 'Vision fallback' }, type: 'boolean',
    default: true,
    help: {
      ru: 'Скриншот → vision-модель, если текст вопроса не найден.',
      en: 'Screenshot → vision model when the question text is not found.'
    }
  },
  {
    key: 'vision.maxPerRun', group: 'vision', label: { ru: 'Лимит vision-вызовов', en: 'Vision call limit' }, type: 'number',
    default: 10, min: 0, max: 100, step: 1,
    help: { ru: '0 — без лимита.', en: '0 — no limit.' }
  },
  {
    key: 'vision.saveScreenshots', group: 'vision', label: { ru: 'Сохранять скриншоты', en: 'Save screenshots' }, type: 'boolean',
    default: false,
    help: {
      ru: 'PNG в папку логов (может содержать персональные данные).',
      en: 'PNG in the logs folder (may contain personal data).'
    }
  },

  {
    key: 'logging.dir', group: 'logging', label: { ru: 'Папка логов', en: 'Logs folder' }, type: 'string',
    default: '',
    help: { ru: 'Пусто — папка данных приложения.', en: 'Empty — the app data folder.' }
  },
  {
    key: 'logging.answersJsonl', group: 'logging', label: { ru: 'Журнал ответов (JSONL)', en: 'Answer journal (JSONL)' }, type: 'boolean',
    default: true,
    help: { ru: 'По строке на каждый вопрос.', en: 'One line per question.' }
  },
  {
    key: 'logging.rotateMb', group: 'logging', label: { ru: 'Ротация', en: 'Rotation' }, type: 'number',
    default: 10, min: 1, max: 500, step: 1, unit: { ru: 'МБ', en: 'MB' },
    help: { ru: 'Размер файла до ротации.', en: 'File size before rotation.' }
  },
  {
    key: 'logging.level', group: 'logging', label: { ru: 'Уровень', en: 'Level' }, type: 'select', default: 'info',
    options: [
      { value: 'debug', label: 'debug' },
      { value: 'info', label: 'info' },
      { value: 'warn', label: 'warn' },
      { value: 'error', label: 'error' }
    ],
    help: { ru: 'Подробность журнала.', en: 'Log verbosity.' }
  }
];

const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function localize(value, language) {
  if (value && typeof value === 'object') {
    return value[language] !== undefined ? value[language] : (value.ru !== undefined ? value.ru : '');
  }
  return value;
}

function defaultsObject() {
  const out = {};
  for (const field of FIELDS) {
    const parts = field.key.split('.');
    let node = out;
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (!node[parts[i]] || typeof node[parts[i]] !== 'object') node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = clone(field.default);
  }
  return out;
}

module.exports = { GROUPS, FIELDS, FIELD_BY_KEY, defaultsObject, clone, localize };
