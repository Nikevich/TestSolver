// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

/**
 * Translations for strings produced by the main process: run statuses,
 * the About dialog and small model prompts that are not part of the
 * question-solving prompt builders.
 */

const COPYRIGHT = 'Copyright (C) 2026 Shkilevich Nikita';

const MESSAGES = {
  ru: {
    'runner.ready': 'Готов к запуску',
    'runner.preparing': 'Подготовка...',
    'runner.error': 'Ошибка: {message}',
    'runner.alreadyRunning': 'Автопрогон уже запущен',
    'runner.notRunning': 'Автопрогон не запущен',
    'runner.stopped': 'Остановлено пользователем',
    'runner.limitReached': 'Достигнут лимит вопросов',
    'runner.allPassed': 'Все вопросы пройдены',
    'runner.sendingQuestion': 'Отправляю вопрос {num} в {backend}{suffix}',
    'runner.tooManyErrors': 'Много ошибок подряд: {message}',
    'runner.pageUnavailable': 'Страница перестала быть доступной',
    'runner.noAnswer': 'Модель не вернула ответ',
    'runner.noTextValue': 'Модель не вернула значение для поля ввода',
    'runner.fillFailed': 'Не удалось заполнить текстовое поле{reason}',
    'runner.answerMismatch': 'Ответ модели не соответствует вариантам на странице',
    'runner.selectFailed': 'Не удалось выбрать вариант на странице',
    'runner.lowConfidence': 'Остановлено: низкая уверенность модели ({confidence})',
    'runner.answerSelected': 'Ответ выбран, жду перехода к следующему вопросу',
    'runner.pauseBeforeContinue': 'Пауза {seconds} с перед «Продолжить»',
    'runner.browserClosed': 'Окно браузера закрыто',
    'runner.nextNotFound': 'Кнопка «Продолжить» не найдена — остановка',
    'runner.questionNotChanged': 'Вопрос не сменился за отведённое время — остановка',
    'runner.stillLooking': 'Всё ещё ищу вопрос на странице...',
    'runner.finished': 'Тест завершён (страница результатов)',
    'runner.noOptions': 'На странице больше нет вариантов ответа — остановка',
    'runner.visionRecognizing': 'Распознаю вопрос по скриншоту (vision)',
    'runner.noQuestion': 'Не удалось найти ни вариантов ответа, ни поля ввода на странице',
    'runner.emptyScreenshot': 'Пустой скриншот страницы',

    'about.title': 'О программе',
    'about.licenseText': 'Текст лицензии',
    'about.commercialLicense': 'Коммерческая лицензия',
    'about.close': 'Закрыть',
    'dialog.exportAnswers': 'Экспорт ответов',
    'about.detail': [
      COPYRIGHT,
      '',
      'Лицензия: GNU Affero General Public License v3.0 (AGPL-3.0-only)',
      'или коммерческая лицензия.',
      '',
      'Программа распространяется в надежде, что она будет полезной, но',
      'БЕЗ КАКИХ-ЛИБО ГАРАНТИЙ; без подразумеваемых гарантий товарной',
      'пригодности или пригодности для конкретной цели.',
      '',
      'Имя и логотип TestSolver не покрываются лицензией на код.',
      '',
      'Приложение включает Electron (MIT) и Chromium (BSD-3-Clause и другие).',
      'Уведомления: LICENSE.electron.txt и LICENSES.chromium.html рядом',
      'с исполняемым файлом.'
    ].join('\n'),

    'llm.ping': 'Ответь одним словом: ping',
    'llm.mockReady': 'mock готов'
  },

  en: {
    'runner.ready': 'Ready to start',
    'runner.preparing': 'Preparing...',
    'runner.error': 'Error: {message}',
    'runner.alreadyRunning': 'Automation is already running',
    'runner.notRunning': 'Automation is not running',
    'runner.stopped': 'Stopped by the user',
    'runner.limitReached': 'Question limit reached',
    'runner.allPassed': 'All questions completed',
    'runner.sendingQuestion': 'Sending question {num} to {backend}{suffix}',
    'runner.tooManyErrors': 'Too many errors in a row: {message}',
    'runner.pageUnavailable': 'The page is no longer available',
    'runner.noAnswer': 'The model returned no answer',
    'runner.noTextValue': 'The model returned no value for the input field',
    'runner.fillFailed': 'Failed to fill the text field{reason}',
    'runner.answerMismatch': 'The model answer does not match the options on the page',
    'runner.selectFailed': 'Failed to select an option on the page',
    'runner.lowConfidence': 'Stopped: low model confidence ({confidence})',
    'runner.answerSelected': 'Answer selected, waiting for the next question',
    'runner.pauseBeforeContinue': 'Pausing {seconds} s before “Continue”',
    'runner.browserClosed': 'The browser window is closed',
    'runner.nextNotFound': 'Continue button not found — stopping',
    'runner.questionNotChanged': 'The question did not change in time — stopping',
    'runner.stillLooking': 'Still looking for a question on the page...',
    'runner.finished': 'Test completed (results page)',
    'runner.noOptions': 'No answer options left on the page — stopping',
    'runner.visionRecognizing': 'Recognizing the question from a screenshot (vision)',
    'runner.noQuestion': 'Could not find answer options or an input field on the page',
    'runner.emptyScreenshot': 'Empty page screenshot',

    'about.title': 'About',
    'about.licenseText': 'License text',
    'about.commercialLicense': 'Commercial license',
    'about.close': 'Close',
    'dialog.exportAnswers': 'Export answers',
    'about.detail': [
      COPYRIGHT,
      '',
      'License: GNU Affero General Public License v3.0 (AGPL-3.0-only)',
      'or a commercial license.',
      '',
      'This program is distributed in the hope that it will be useful, but',
      'WITHOUT ANY WARRANTY; without even the implied warranty of',
      'MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.',
      '',
      'The TestSolver name and logo are not covered by the code license.',
      '',
      'The application includes Electron (MIT) and Chromium (BSD-3-Clause and others).',
      'Notices: LICENSE.electron.txt and LICENSES.chromium.html next to',
      'the executable.'
    ].join('\n'),

    'llm.ping': 'Reply with one word: ping',
    'llm.mockReady': 'mock ready'
  }
};

function normalizeLanguage(value) {
  return String(value || '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

function languageOf(cfg) {
  return normalizeLanguage(cfg && cfg['ui.language']);
}

function t(language, key, params) {
  const lang = normalizeLanguage(language);
  const dict = MESSAGES[lang] || MESSAGES.en;
  let text = dict[key];
  if (text === undefined) text = MESSAGES.en[key];
  if (text === undefined) text = key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value == null ? '' : value));
    }
  }
  return text;
}

module.exports = { MESSAGES, normalizeLanguage, languageOf, t };
