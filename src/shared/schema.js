// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

/**
 * Single source of truth for settings: UI form, defaults and validation
 * are generated from this list.
 */

const GROUPS = [
  { id: 'backend', title: 'Бэкенд' },
  { id: 'ollama', title: 'Ollama' },
  { id: 'opencode', title: 'opencode' },
  { id: 'automation', title: 'Автоматизация' },
  { id: 'vision', title: 'Vision' },
  { id: 'logging', title: 'Логи' },
  { id: 'ui', title: 'Интерфейс' }
];

const FIELDS = [
  {
    key: 'backend', group: 'backend', label: 'Бэкенд', type: 'select', default: 'ollama',
    options: [
      { value: 'ollama', label: 'Ollama (локально)' },
      { value: 'opencode', label: 'opencode CLI' },
      { value: 'mock', label: 'mock (отладка, без модели)' }
    ],
    help: 'Кто отвечает на вопросы теста.'
  },

  {
    key: 'ollama.url', group: 'ollama', label: 'URL', type: 'string',
    default: 'http://127.0.0.1:11434',
    validate: { pattern: '^https?://' },
    help: 'Адрес локального сервера Ollama.'
  },
  {
    key: 'ollama.model', group: 'ollama', label: 'Модель', type: 'string',
    default: 'qwen2.5:7b-instruct', help: 'Имя модели из `ollama list`.'
  },
  {
    key: 'ollama.visionModel', group: 'ollama', label: 'Vision-модель', type: 'string',
    default: 'qwen2.5vl:7b', help: 'Модель для распознавания скриншота.'
  },
  {
    key: 'ollama.temperature', group: 'ollama', label: 'Температура', type: 'number',
    default: 0, min: 0, max: 2, step: 0.1, help: '0 — максимально детерминированно.'
  },
  {
    key: 'ollama.numCtx', group: 'ollama', label: 'num_ctx', type: 'number',
    default: 4096, min: 512, max: 131072, step: 512, help: 'Размер контекста.'
  },
  {
    key: 'ollama.keepAlive', group: 'ollama', label: 'keep_alive', type: 'string',
    default: '30m', help: 'Сколько держать модель в памяти.'
  },
  {
    key: 'ollama.timeoutMs', group: 'ollama', label: 'Таймаут', type: 'number',
    default: 120000, min: 5000, max: 900000, step: 1000, unit: 'мс',
    help: 'Ожидание ответа модели.'
  },

  {
    key: 'opencode.bin', group: 'opencode', label: 'Путь к opencode', type: 'string',
    default: 'opencode', help: 'Имя в PATH или полный путь к opencode.exe.'
  },
  {
    key: 'opencode.model', group: 'opencode', label: 'Модель', type: 'string',
    default: '', help: 'Формат provider/model. Пусто — модель по умолчанию из opencode.'
  },
  {
    key: 'opencode.timeoutMs', group: 'opencode', label: 'Таймаут', type: 'number',
    default: 180000, min: 10000, max: 900000, step: 1000, unit: 'мс',
    help: 'Ожидание ответа CLI.'
  },

  {
    key: 'automation.mode', group: 'automation', label: 'Режим', type: 'select',
    default: 'auto',
    options: [
      { value: 'auto', label: 'Полный автомат' },
      { value: 'confirm', label: 'Подсветить и ждать' }
    ],
    help: 'confirm — выбирает ответ и ждёт нажатия «Продолжить» вручную.'
  },
  {
    key: 'automation.delayMs', group: 'automation', label: 'Задержка перед «Продолжить»',
    type: 'number', default: 3000, min: 0, max: 120000, step: 100, unit: 'мс',
    help: 'Пауза после выбора ответа.'
  },
  {
    key: 'automation.jitterPct', group: 'automation', label: 'Разброс задержки', type: 'number',
    default: 30, min: 0, max: 100, step: 5, unit: '%', help: 'Случайное отклонение задержки.'
  },
  {
    key: 'automation.maxQuestions', group: 'automation', label: 'Лимит вопросов', type: 'number',
    default: 0, min: 0, max: 1000, step: 1, help: '0 — без лимита (до конца теста).'
  },
  {
    key: 'automation.clickNext', group: 'automation', label: 'Нажимать «Продолжить»', type: 'boolean',
    default: true, help: 'Выключить, чтобы только подсвечивать ответ.'
  },
  {
    key: 'automation.dryRun', group: 'automation', label: 'Dry run (без кликов)', type: 'boolean',
    default: false, help: 'Только логировать выбранные ответы.'
  },
  {
    key: 'automation.questionChangeTimeoutMs', group: 'automation', label: 'Ожидание нового вопроса',
    type: 'number', default: 15000, min: 1000, max: 120000, step: 500, unit: 'мс',
    help: 'Сколько ждать смены вопроса после клика.'
  },
  {
    key: 'automation.postClickWaitMs', group: 'automation', label: 'Пауза после загрузки',
    type: 'number', default: 1200, min: 0, max: 30000, step: 100, unit: 'мс',
    help: 'Дать странице дорисоваться.'
  },
  {
    key: 'automation.maxParseFailures', group: 'automation', label: 'Лимит ошибок парсинга',
    type: 'number', default: 3, min: 1, max: 20, step: 1, help: 'После — остановка.'
  },
  {
    key: 'automation.stopOnLowConfidence', group: 'automation', label: 'Стоп при низкой уверенности',
    type: 'boolean', default: false, help: 'Останавливаться, если модель не уверена.'
  },
  {
    key: 'automation.minConfidence', group: 'automation', label: 'Минимальная уверенность',
    type: 'number', default: 0.4, min: 0, max: 1, step: 0.05, help: 'Порог для предыдущей опции.'
  },
  {
    key: 'automation.startUrl', group: 'automation', label: 'Стартовый URL', type: 'string',
    default: '', help: 'Страница теста, открывается при запуске.'
  },

  {
    key: 'vision.enabled', group: 'vision', label: 'Vision-фолбэк', type: 'boolean',
    default: true, help: 'Скриншот → vision-модель, если текст вопроса не найден.'
  },
  {
    key: 'vision.maxPerRun', group: 'vision', label: 'Лимит vision-вызовов', type: 'number',
    default: 10, min: 0, max: 100, step: 1, help: '0 — без лимита.'
  },
  {
    key: 'vision.saveScreenshots', group: 'vision', label: 'Сохранять скриншоты', type: 'boolean',
    default: false, help: 'PNG в папку логов (может содержать персональные данные).'
  },

  {
    key: 'logging.dir', group: 'logging', label: 'Папка логов', type: 'string',
    default: '', help: 'Пусто — папка данных приложения.'
  },
  {
    key: 'logging.answersJsonl', group: 'logging', label: 'Журнал ответов (JSONL)', type: 'boolean',
    default: true, help: 'По строке на каждый вопрос.'
  },
  {
    key: 'logging.rotateMb', group: 'logging', label: 'Ротация', type: 'number',
    default: 10, min: 1, max: 500, step: 1, unit: 'МБ', help: 'Размер файла до ротации.'
  },
  {
    key: 'logging.level', group: 'logging', label: 'Уровень', type: 'select', default: 'info',
    options: [
      { value: 'debug', label: 'debug' },
      { value: 'info', label: 'info' },
      { value: 'warn', label: 'warn' },
      { value: 'error', label: 'error' }
    ],
    help: 'Подробность журнала.'
  },

  {
    key: 'ui.panelWidth', group: 'ui', label: 'Ширина панели', type: 'number',
    default: 400, min: 320, max: 900, step: 10, unit: 'px', help: 'Перетаскивается мышью.'
  },
  {
    key: 'ui.theme', group: 'ui', label: 'Тема', type: 'select', default: 'system',
    options: [
      { value: 'system', label: 'Как в системе' },
      { value: 'dark', label: 'Тёмная' },
      { value: 'light', label: 'Светлая' }
    ],
    help: 'Оформление панели.'
  }
];

const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
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

module.exports = { GROUPS, FIELDS, FIELD_BY_KEY, defaultsObject, clone };
