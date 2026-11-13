// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

/**
 * Renderer-side translations. The settings schema carries localized values
 * as { ru, en } objects; everything else is resolved through this dictionary.
 */

(function () {
  const DICTIONARY = {
    ru: {
      'common.yes': 'да',
      'common.no': 'нет',

      'toolbar.back': 'Назад',
      'toolbar.forward': 'Вперёд',
      'toolbar.reload': 'Обновить',
      'toolbar.urlPlaceholder': 'Адрес страницы теста, например orioks.miet.ru/...',
      'toolbar.go': 'Перейти',
      'toolbar.openTest': 'Открыть тест',
      'toolbar.openTestTitle': 'Открыть сохранённый стартовый URL',
      'toolbar.externalTitle': 'Открыть в системном браузере',

      'placeholder.line1': 'Вставьте адрес страницы теста в строку сверху и нажмите «Перейти».',
      'placeholder.line2': 'Логин и пароль вводятся прямо в этом окне — сессия сохранится.',
      'placeholder.line3': 'Дальше: выберите модель в панели справа и нажмите «Старт».',

      'tabs.control': 'Управление',
      'tabs.settings': 'Настройки',
      'tabs.log': 'Лог',
      'tabs.answers': 'Ответы',

      'control.backend': 'Бэкенд',
      'control.model': 'Модель',
      'control.refresh': 'обновить',
      'control.refreshTitle': 'Обновить список моделей',
      'control.downloadModel': 'Скачать модель (Ollama)',
      'control.download': 'Скачать',
      'control.delay': 'Задержка, мс',
      'control.maxQuestions': 'Лимит вопросов',
      'control.visionFallback': 'Vision-фолбэк',
      'control.dryRun': 'Dry run (без кликов)',
      'control.clickNext': 'Нажимать «Продолжить»',
      'control.start': '▶ Старт',
      'control.stop': '■ Стоп',
      'control.ready': 'Готов к запуску',
      'control.testLlm': 'Проверить связь с моделью',
      'control.hotkeyPrefix': 'Горячая клавиша:',
      'control.hotkeySuffix': '— старт/стоп.',

      'settings.resetAll': 'Сбросить всё к умолчаниям',
      'settings.openLogs': 'Папка логов',
      'settings.default': 'по умолчанию: {value}',
      'settings.resetField': 'Сбросить к умолчанию',
      'settings.resetFieldDone': '«{label}» сброшено',
      'settings.resetConfirm': 'Сбросить все настройки к значениям по умолчанию?',
      'settings.resetDone': 'Настройки сброшены',
      'settings.enabled': 'включено',
      'settings.modelPlaceholder': 'начните вводить имя модели',

      'log.refresh': 'Обновить',
      'log.openFolder': 'Папка логов',
      'log.dumpHtml': 'HTML страницы',
      'log.dumpHtmlTitle': 'Сохранить HTML текущей страницы для диагностики',
      'log.clear': 'Очистить вид',

      'answers.export': 'Экспорт',
      'answers.count': 'записей: {count}',
      'answers.num': '#',
      'answers.question': 'Вопрос',
      'answers.answer': 'Ответ',
      'answers.confidence': 'Conf.',
      'answers.ms': 'мс',

      'status.ollamaChecking': 'Ollama: проверка...',
      'status.opencodeChecking': 'opencode: проверка...',
      'status.ollamaOk': 'Ollama OK · моделей: {count}',
      'status.ollamaError': 'Ollama: {error}',
      'status.opencodeFound': 'opencode найден',
      'status.opencodeError': 'opencode: {error}',
      'status.noConnection': 'нет связи',
      'status.opencodeNotFound': 'не найден',
      'status.avg': 'ср. {ms} мс',
      'status.ready': 'Готов',

      'about.link': 'О программе',
      'about.linkTitle': 'О программе, лицензия и исходный код',
      'about.openFailed': 'Не удалось открыть окно «О программе»',

      'model.noneRequired': '— не требуется —',
      'model.mockHint': 'Mock-бэкенд отвечает случайным вариантом, модель не нужна.',
      'model.defaultFromOpencode': 'по умолчанию (из opencode)',
      'model.notFoundSuffix': '{name} (не найдена)',
      'model.notFoundInOllama': 'Модель «{model}» не найдена в Ollama — скачайте её или выберите другую.',
      'model.listFromOllama': 'Список берётся из Ollama (/api/tags).',
      'model.listFromOpencode': 'Список берётся из `opencode models`.',
      'model.found': 'Моделей найдено: {count}',
      'model.failed': 'Не удалось получить список моделей',
      'model.nameRequired': 'Укажите имя модели',

      'pull.downloading': 'Скачивание {model}...',
      'pull.error': 'Ошибка: {error}',
      'pull.ready': 'Модель {model} готова',

      'llm.testing': 'Проверяю...',
      'llm.ok': 'OK: {text}',
      'llm.answerReceived': 'ответ получен',
      'llm.error': 'Ошибка: {error}',
      'llm.noResponse': 'нет ответа',
      'llm.connected': 'Связь с моделью работает',
      'llm.notResponding': 'Модель не отвечает',

      'run.started': 'Автопрогон запущен',
      'run.startFailed': 'Не удалось запустить',
      'run.notRunning': 'Автопрогон не запущен',

      'toast.initError': 'Ошибка инициализации: {message}',
      'toast.preloadError': 'Не удалось загрузить preload-скрипт.',
      'toast.answerChosen': 'Ответ на вопрос {qnum} выбран ({percent}%)',

      'browser.openTestFailed': 'Не удалось открыть тест',
      'browser.navigateFailed': 'Не удалось перейти',

      'files.htmlSaved': 'HTML сохранён: {path}',
      'files.htmlSaveFailed': 'Не удалось сохранить HTML',
      'files.saved': 'Сохранено: {path}',
      'files.saveFailed': 'Не удалось сохранить',

      'bytes.zero': '0 Б',
      'bytes.b': 'Б',
      'bytes.kb': 'КБ',
      'bytes.mb': 'МБ',
      'bytes.gb': 'ГБ'
    },

    en: {
      'common.yes': 'yes',
      'common.no': 'no',

      'toolbar.back': 'Back',
      'toolbar.forward': 'Forward',
      'toolbar.reload': 'Reload',
      'toolbar.urlPlaceholder': 'Test page address, e.g. orioks.miet.ru/...',
      'toolbar.go': 'Go',
      'toolbar.openTest': 'Open test',
      'toolbar.openTestTitle': 'Open the saved start URL',
      'toolbar.externalTitle': 'Open in the system browser',

      'placeholder.line1': 'Paste the test page address into the bar above and click “Go”.',
      'placeholder.line2': 'Log in right in this window — the session will be saved.',
      'placeholder.line3': 'Next: choose a model in the right panel and click “Start”.',

      'tabs.control': 'Control',
      'tabs.settings': 'Settings',
      'tabs.log': 'Log',
      'tabs.answers': 'Answers',

      'control.backend': 'Backend',
      'control.model': 'Model',
      'control.refresh': 'refresh',
      'control.refreshTitle': 'Refresh the model list',
      'control.downloadModel': 'Download model (Ollama)',
      'control.download': 'Download',
      'control.delay': 'Delay, ms',
      'control.maxQuestions': 'Question limit',
      'control.visionFallback': 'Vision fallback',
      'control.dryRun': 'Dry run (no clicks)',
      'control.clickNext': 'Click “Continue”',
      'control.start': '▶ Start',
      'control.stop': '■ Stop',
      'control.ready': 'Ready to start',
      'control.testLlm': 'Test model connection',
      'control.hotkeyPrefix': 'Hotkey:',
      'control.hotkeySuffix': '— start/stop.',

      'settings.resetAll': 'Reset all to defaults',
      'settings.openLogs': 'Logs folder',
      'settings.default': 'default: {value}',
      'settings.resetField': 'Reset to default',
      'settings.resetFieldDone': '“{label}” reset',
      'settings.resetConfirm': 'Reset all settings to their default values?',
      'settings.resetDone': 'Settings reset',
      'settings.enabled': 'enabled',
      'settings.modelPlaceholder': 'start typing a model name',

      'log.refresh': 'Refresh',
      'log.openFolder': 'Logs folder',
      'log.dumpHtml': 'Page HTML',
      'log.dumpHtmlTitle': 'Save the current page HTML for diagnostics',
      'log.clear': 'Clear view',

      'answers.export': 'Export',
      'answers.count': 'records: {count}',
      'answers.num': '#',
      'answers.question': 'Question',
      'answers.answer': 'Answer',
      'answers.confidence': 'Conf.',
      'answers.ms': 'ms',

      'status.ollamaChecking': 'Ollama: checking...',
      'status.opencodeChecking': 'opencode: checking...',
      'status.ollamaOk': 'Ollama OK · models: {count}',
      'status.ollamaError': 'Ollama: {error}',
      'status.opencodeFound': 'opencode found',
      'status.opencodeError': 'opencode: {error}',
      'status.noConnection': 'no connection',
      'status.opencodeNotFound': 'not found',
      'status.avg': 'avg {ms} ms',
      'status.ready': 'Ready',

      'about.link': 'About',
      'about.linkTitle': 'About the app, license and source code',
      'about.openFailed': 'Could not open the About window',

      'model.noneRequired': '— not required —',
      'model.mockHint': 'The mock backend answers with a random option; no model is needed.',
      'model.defaultFromOpencode': 'default (from opencode)',
      'model.notFoundSuffix': '{name} (not found)',
      'model.notFoundInOllama': 'Model “{model}” was not found in Ollama — download it or choose another one.',
      'model.listFromOllama': 'The list comes from Ollama (/api/tags).',
      'model.listFromOpencode': 'The list comes from `opencode models`.',
      'model.found': 'Models found: {count}',
      'model.failed': 'Could not get the model list',
      'model.nameRequired': 'Enter a model name',

      'pull.downloading': 'Downloading {model}...',
      'pull.error': 'Error: {error}',
      'pull.ready': 'Model {model} is ready',

      'llm.testing': 'Checking...',
      'llm.ok': 'OK: {text}',
      'llm.answerReceived': 'answer received',
      'llm.error': 'Error: {error}',
      'llm.noResponse': 'no response',
      'llm.connected': 'Model connection works',
      'llm.notResponding': 'The model is not responding',

      'run.started': 'Automation started',
      'run.startFailed': 'Could not start',
      'run.notRunning': 'Automation is not running',

      'toast.initError': 'Initialization error: {message}',
      'toast.preloadError': 'Could not load the preload script.',
      'toast.answerChosen': 'Answer to question {qnum} selected ({percent}%)',

      'browser.openTestFailed': 'Could not open the test',
      'browser.navigateFailed': 'Could not navigate',

      'files.htmlSaved': 'HTML saved: {path}',
      'files.htmlSaveFailed': 'Could not save HTML',
      'files.saved': 'Saved: {path}',
      'files.saveFailed': 'Could not save',

      'bytes.zero': '0 B',
      'bytes.b': 'B',
      'bytes.kb': 'KB',
      'bytes.mb': 'MB',
      'bytes.gb': 'GB'
    }
  };

  let language = 'en';

  function normalize(value) {
    return String(value || '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  }

  function setLanguage(value) {
    language = normalize(value);
  }

  function getLanguage() {
    return language;
  }

  function t(key, params) {
    let text = DICTIONARY[language][key];
    if (text === undefined) text = DICTIONARY.ru[key];
    if (text === undefined) text = key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.split(`{${name}}`).join(String(value == null ? '' : value));
      }
    }
    return text;
  }

  function pick(value) {
    if (value && typeof value === 'object') {
      return value[language] !== undefined ? value[language] : (value.ru !== undefined ? value.ru : '');
    }
    return value;
  }

  window.I18N = { t, pick, setLanguage, getLanguage, normalize };
})();
