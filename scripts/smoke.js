// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

/**
 * Headless smoke test: runs inside Electron (no visible window) and checks
 * DOM extraction, clicking, config defaults and the full automation loop
 * with the mock backend against fixtures/test-page.html.
 *
 *   npm run smoke
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

app.disableHardwareAcceleration();
app.setPath('userData', path.join(os.tmpdir(), `testsolver-smoke-${Date.now()}`));

const results = [];

function check(name, condition, extra) {
  results.push({ name, ok: Boolean(condition), extra });
  const mark = condition ? 'PASS' : 'FAIL';
  const suffix = extra === undefined ? '' : ` :: ${JSON.stringify(extra).slice(0, 300)}`;
  console.log(`${mark} ${name}${suffix}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, timeoutMs, interval = 250) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await sleep(interval);
  }
  return null;
}

async function main() {
  await app.whenReady();

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false }
  });

  const fixture = path.join(__dirname, '..', 'fixtures', 'test-page.html');
  await win.loadFile(fixture);
  const wc = win.webContents;

  const { EXTRACT_JS, clickOptionScript, clickNextScript, fillTextScript } = require('../src/main/dom');

  // --- config defaults -------------------------------------------------
  const { ConfigStore } = require('../src/main/config');
  const cfgPath = path.join(os.tmpdir(), `testsolver-smoke-config-${Date.now()}.json`);
  const store = new ConfigStore(cfgPath);
  const defaults = store.all();
  check('config: backend default is ollama', defaults.backend === 'ollama', defaults.backend);
  check('config: delay default is 3000', defaults['automation'] && defaults['automation'].delayMs === 3000, defaults['automation']);
  check('config: maxQuestions default is 0', defaults['automation'] && defaults['automation'].maxQuestions === 0);
  check(
    'config: interface language default is en',
    defaults['ui'] && defaults['ui'].language === 'en',
    defaults['ui']
  );

  store.set('automation.delayMs', 999999);
  check('config: number is clamped to max', store.get('automation.delayMs') === 120000, store.get('automation.delayMs'));
  store.set('ollama.temperature', -5);
  check('config: number is clamped to min', store.get('ollama.temperature') === 0, store.get('ollama.temperature'));
  store.set('backend', 'nonsense');
  check('config: invalid select falls back to default', store.get('backend') === 'ollama', store.get('backend'));
  store.set('automation.dryRun', 'true');
  check('config: boolean coercion', store.get('automation.dryRun') === true);
  store.save();
  check('config: saved file exists', fs.existsSync(cfgPath));
  store.set('automation.delayMs', 3000);
  store.save();

  // --- DOM extraction --------------------------------------------------
  const first = await waitFor(async () => wc.executeJavaScript(EXTRACT_JS, true), 10000);
  check('dom: question found', first && first.ok === true, first && first.reason);
  check('dom: qnum is 1', first && first.qnum === 1, first && first.qnum);
  check('dom: total is 6', first && first.total === 6, first && first.total);
  check('dom: 5 options', first && first.options.length === 5, first && first.options && first.options.length);
  check('dom: single choice', first && first.type === 'single', first && first.type);
  check(
    'dom: question text extracted',
    first && /аудит информационной безопасности/i.test(first.question),
    first && first.question.slice(0, 80)
  );
  check(
    'dom: option text extracted',
    first && /независимое исследование/i.test(first.options[0].text),
    first && first.options[0].text.slice(0, 80)
  );
  check('dom: next button found', first && first.hasNextButton === true, first && first.buttonText);

  // --- clicking --------------------------------------------------------
  const clicked = await wc.executeJavaScript(clickOptionScript(2), true);
  check('dom: option click selects radio', clicked && clicked.ok === true, clicked);
  const checked = await wc.executeJavaScript(
    'document.querySelectorAll("input[name=answer]")[2].checked',
    true
  );
  check('dom: radio is checked after click', checked === true);

  const beforeSig = first.pageSig;
  const nextClicked = await wc.executeJavaScript(clickNextScript(), true);
  check('dom: next button click', nextClicked && nextClicked.ok === true, nextClicked);

  const second = await waitFor(async () => {
    const current = await wc.executeJavaScript(EXTRACT_JS, true);
    if (current && current.ok && current.pageSig !== beforeSig) return current;
    return null;
  }, 10000);
  check('dom: next question loaded', second && second.qnum === 2, second && second.qnum);

  // --- text / sequence question ---------------------------------------
  await wc.executeJavaScript("location.href = 'test-page.html?q=2';", true);
  await new Promise((resolve) => wc.once('did-finish-load', resolve));
  await sleep(300);

  const textQ = await waitFor(async () => {
    const current = await wc.executeJavaScript(EXTRACT_JS, true);
    return current && current.ok && current.type === 'text' ? current : null;
  }, 10000);
  check('dom: text question detected', textQ && textQ.kind === 'text', textQ && { kind: textQ.kind, type: textQ.type });
  check('dom: text question number is 3', textQ && textQ.qnum === 3, textQ && textQ.qnum);
  check('dom: text input found', textQ && textQ.hasInput === true && textQ.options.length === 0);
  check('dom: 5 numbered items parsed', textQ && textQ.items.length === 5, textQ && textQ.items.length);
  check(
    'dom: question text has no hints or answers',
    textQ && /последовательность этапов/i.test(textQ.question) && !/без пробелов/i.test(textQ.question),
    textQ && textQ.question.slice(0, 120)
  );
  check(
    'dom: answer format hint extracted',
    textQ && /без\s+пробелов/i.test(textQ.expectedFormat),
    textQ && textQ.expectedFormat
  );

  const filled = await wc.executeJavaScript(fillTextScript('15432'), true);
  check('dom: text answer typed into input', filled && filled.ok === true && filled.value === '15432', filled);

  await wc.executeJavaScript(fillTextScript('11234'), true);
  await wc.executeJavaScript(clickNextScript(), true);
  const stillText = await waitFor(async () => {
    const current = await wc.executeJavaScript(EXTRACT_JS, true);
    return current && current.ok && current.type === 'text' ? current : null;
  }, 3000);
  check('dom: invalid sequence is rejected by the page', stillText && stillText.qnum === 3, stillText && stillText.qnum);

  await wc.executeJavaScript(fillTextScript('15432'), true);
  await wc.executeJavaScript(clickNextScript(), true);
  const afterText = await waitFor(async () => {
    const current = await wc.executeJavaScript(EXTRACT_JS, true);
    return current && current.ok && current.type === 'single' && current.qnum === 4 ? current : null;
  }, 10000);
  check('dom: valid sequence advances to question 4', afterText && afterText.qnum === 4, afterText && afterText.qnum);

  // --- automation loop with mock backend -------------------------------
  await wc.executeJavaScript("location.href = 'test-page.html';", true);
  await new Promise((resolve) => wc.once('did-finish-load', resolve));
  await sleep(500);

  const { Runner } = require('../src/main/automation');
  const { Logger } = require('../src/main/logger');

  const automationCfgPath = path.join(os.tmpdir(), `testsolver-smoke-auto-${Date.now()}.json`);
  const autoStore = new ConfigStore(automationCfgPath);
  autoStore.setMany({
    backend: 'mock',
    'automation.delayMs': 0,
    'automation.jitterPct': 0,
    'automation.maxQuestions': 0,
    'automation.postClickWaitMs': 200,
    'automation.questionChangeTimeoutMs': 8000,
    'automation.maxParseFailures': 3,
    'automation.clickNext': true,
    'automation.dryRun': false,
    'automation.mode': 'auto',
    'vision.enabled': false
  });

  const logger = new Logger({
    dir: path.join(os.tmpdir(), `testsolver-smoke-logs-${Date.now()}`),
    level: 'debug',
    rotateMb: 10,
    answersEnabled: true
  });

  const runner = new Runner({
    getWebContents: () => wc,
    getConfig: () => autoStore.flat(),
    logger
  });

  console.log('  [cfg]', JSON.stringify(autoStore.all()['automation']));

  let answered = 0;
  runner.on('answer', () => {
    answered += 1;
  });
  runner.on('status', (status) => {
    console.log(`  [status] running=${status.running} answered=${status.answered} q=${status.qnum} msg=${status.message}`);
  });

  const finished = new Promise((resolve) => {
    runner.on('finished', (status) => resolve(status));
  });

  const started = runner.start();
  check('auto: start accepted', started.ok === true, started.error);

  const status = await Promise.race([finished, sleep(90000).then(() => null)]);
  check('auto: finished without timeout', status !== null, status && status.message);
  check('auto: answered all 6 questions', answered === 6, answered);
  check(
    'auto: reached the result page',
    status && /completed|заверш/i.test(status.message),
    status && status.message
  );

  // --- prompt helpers --------------------------------------------------
  const {
    matchOptions,
    normalizeAnswer,
    normalizeTextAnswer,
    parseItems,
    parseJson
  } = require('../src/main/prompts');

  const domOptions = [
    { i: 0, text: 'независимое исследование состояния информационной системы' },
    { i: 1, text: 'оценка состояния информационной системы' },
    { i: 2, text: 'все перечисленные варианты верны' }
  ];
  const mapped = matchOptions(
    ['независимое исследование состояния информационной системы', 'все перечисленные варианты верны'],
    domOptions
  );
  check('prompts: vision mapping works', Array.isArray(mapped) && mapped.length === 2, mapped);

  const parsed = parseJson('```json\n{"answers":[1],"confidence":0.82,"reason":"ok"}\n```');
  check('prompts: json in fences is parsed', parsed && parsed.answers[0] === 1, parsed);

  const normalized = normalizeAnswer({ answers: ['2', 99, -1], confidence: 87 }, 4);
  check(
    'prompts: invalid indexes are dropped',
    normalized && normalized.answers.length === 1 && normalized.answers[0] === 2,
    normalized
  );

  const parsedItems = parseItems('1. Подготовка\n2) Сбор информации\n3. Отчёт');
  check(
    'prompts: numbered items parsed',
    parsedItems.length === 3 && parsedItems[1].n === 2,
    parsedItems
  );

  const textItems = (textQ && textQ.items) || [];
  const goodText = normalizeTextAnswer({ value: '15432', confidence: 0.9 }, { items: textItems });
  check('prompts: valid permutation accepted', goodText && goodText.value === '15432', goodText);
  check(
    'prompts: separators stripped from permutation',
    normalizeTextAnswer({ value: '1-5-4-3-2' }, { items: textItems }).value === '15432'
  );
  check(
    'prompts: duplicate digits rejected',
    normalizeTextAnswer({ value: '11234', confidence: 0.9 }, { items: textItems }) === null
  );
  const plainText = normalizeTextAnswer({ value: '  «42»  ', confidence: 0.7 }, { items: [] });
  check('prompts: short text answer is trimmed', plainText && plainText.value === '42', plainText);

  // --- renderer wiring (nested config must reach the UI fields) --------
  {
    const { GROUPS, FIELDS, defaultsObject } = require('../src/shared/schema');
    const stubConfig = defaultsObject();
    const stubData = {
      config: stubConfig,
      schema: { groups: GROUPS, fields: FIELDS },
      models: { ok: true, models: [{ name: 'qwen2.5:7b-instruct' }] },
      health: { ollama: { ok: true, models: ['qwen2.5:7b-instruct'] }, opencode: { ok: true } },
      status: { running: false, message: 'Ready to start', answered: 0, total: 0, avgMs: 0 },
      info: {
        version: 'test',
        configPath: cfgPath,
        logDir: os.tmpdir(),
        copyright: 'Copyright (C) 2026 Shkilevich Nikita',
        licenseName: 'AGPL-3.0-only OR LicenseRef-Commercial',
        licenseUrl: 'https://www.gnu.org/licenses/agpl-3.0.txt',
        commercialEmail: 'nik.shkilevich3@gmail.com',
        sourceUrl: ''
      }
    };

    const stubPreload = path.join(os.tmpdir(), `testsolver-smoke-preload-${Date.now()}.js`);
    fs.writeFileSync(
      stubPreload,
      `'use strict';
const { contextBridge } = require('electron');
const DATA = ${JSON.stringify(stubData)};
const noop = () => () => {};
const setPath = (obj, key, value) => {
  const parts = key.split('.');
  let node = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!node[parts[i]] || typeof node[parts[i]] !== 'object') node[parts[i]] = {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
};
contextBridge.exposeInMainWorld('api', {
  config: {
    get: async () => DATA.config, schema: async () => DATA.schema,
    set: async (key, value) => { setPath(DATA.config, key, value); return DATA.config; },
    setMany: async () => DATA.config, reset: async () => DATA.config,
    resetAll: async () => DATA.config, path: async () => DATA.info.configPath, onChanged: noop
  },
  llm: { health: async () => DATA.health, models: async () => DATA.models, pull: async () => ({ ok: true }), test: async () => ({ ok: true }), onPullProgress: noop },
  automation: { start: async () => ({ ok: true }), stop: async () => ({ ok: true }), status: async () => DATA.status, onEvent: noop },
  browser: { navigate: async () => ({ ok: true }), back: async () => {}, forward: async () => {}, reload: async () => {}, openExternal: async () => {}, openTest: async () => ({ ok: true }), dumpHtml: async () => ({ ok: true, path: '' }), onState: noop },
  logs: { tail: async () => [], openFolder: async () => {}, onLine: noop },
  answers: { list: async () => [], export: async () => ({ ok: true }), onNew: noop },
  layout: { setPanelWidth: async () => 400, onPanelWidth: noop },
  app: { info: async () => DATA.info, about: async () => ({ ok: true }), ready: async () => true, onThemeChanged: noop }
});
`,
      'utf8'
    );

    const ui = new BrowserWindow({
      show: false,
      width: 1500,
      height: 900,
      webPreferences: { preload: stubPreload, contextIsolation: true, sandbox: true, nodeIntegration: false }
    });

    await ui.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
    const uiState = await waitFor(
      () =>
        ui.webContents
          .executeJavaScript(
            `(() => {
              const delay = document.getElementById('delay');
              if (!delay || !delay.value) return null;
              return {
                delay: delay.value,
                maxQuestions: document.getElementById('max-questions').value,
                vision: document.getElementById('vision').checked,
                clickNext: document.getElementById('click-next').checked,
                model: document.getElementById('model').value,
                settingsFields: document.querySelectorAll('#settings-form [data-key]').length,
                settingsDelay: document.querySelector('#settings-form [data-key="automation.delayMs"]').value
              };
            })()`,
            true
          )
          .catch(() => null),
      10000
    );

    check('ui: control pane filled from nested config', uiState && uiState.delay === '3000', uiState);
    check('ui: maxQuestions rendered', uiState && uiState.maxQuestions === '0');
    check('ui: checkboxes reflect config', uiState && uiState.vision === true && uiState.clickNext === true);
    check('ui: model select shows default model', uiState && uiState.model === 'qwen2.5:7b-instruct');
    check('ui: settings form built from schema', uiState && uiState.settingsFields >= 25, uiState && uiState.settingsFields);
    check('ui: settings input filled', uiState && uiState.settingsDelay === '3000', uiState && uiState.settingsDelay);

    const aboutState = await ui.webContents
      .executeJavaScript(
        `(() => {
          const link = document.getElementById('about-link');
          let threw = false;
          try {
            link.click();
          } catch (err) {
            threw = String((err && err.message) || err);
          }
          return {
            exists: Boolean(link),
            label: link ? link.textContent.trim() : '',
            hasApi: Boolean(window.api && window.api.app && typeof window.api.app.about === 'function'),
            threw
          };
        })()`,
        true
      )
      .catch(() => null);

    check('ui: about link present', aboutState && aboutState.exists === true, aboutState);
    check('ui: about link labelled', aboutState && aboutState.label === 'About', aboutState);
    check(
      'ui: about link is wired to the main process',
      aboutState && aboutState.hasApi === true && aboutState.threw === false,
      aboutState
    );

    // --- interface language switching ---------------------------------
    const switchLanguage = (code) =>
      ui.webContents
        .executeJavaScript(
          `(async () => {
            const select = document.querySelector('#settings-form [data-key="ui.language"]');
            if (!select) return { missing: true };
            select.value = ${JSON.stringify(code)};
            select.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 400));
            return {
              lang: document.documentElement.lang,
              controlTab: document.querySelector('[data-tab="control"]').textContent.trim(),
              start: document.getElementById('btn-start').textContent.trim(),
              settingsTab: document.querySelector('[data-tab="settings"]').textContent.trim(),
              about: document.getElementById('about-link').textContent.trim(),
              backendOption: document.querySelector('#backend option').textContent.trim(),
              status: document.getElementById('status-message').textContent.trim(),
              statusLength: document.getElementById('status-message').textContent.trim().length
            };
          })()`,
          true
        )
        .catch(() => null);

    const ruState = await switchLanguage('ru');
    check(
      'ui: switching to ru translates the interface',
      ruState &&
        ruState.lang === 'ru' &&
        ruState.controlTab === 'Управление' &&
        ruState.settingsTab === 'Настройки' &&
        ruState.about === 'О программе' &&
        ruState.backendOption === 'Ollama (локально)',
      ruState
    );

    const enState = await switchLanguage('en');
    check(
      'ui: switching back to en restores English',
      enState &&
        enState.lang === 'en' &&
        enState.controlTab === 'Control' &&
        enState.settingsTab === 'Settings' &&
        enState.about === 'About' &&
        enState.backendOption === 'Ollama (local)',
      enState
    );

    ui.destroy();
    fs.rmSync(stubPreload, { force: true });
  }

  // --- opencode output parser -----------------------------------------
  const opencode = require('../src/main/llm/opencode');
  const events = [
    '{"type":"step_start","timestamp":1,"part":{"type":"step-start"}}',
    '{"type":"text","timestamp":2,"part":{"type":"text","text":"42"}}'
  ].join('\n');
  const parsedOutput = opencode.parseOutput(events);
  check('opencode: ndjson events parsed', parsedOutput.text === '42', parsedOutput.text);

  // --- preload channel map --------------------------------------------
  {
    const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload', 'preload.js'), 'utf8');
    const defined = new Set([...preloadSource.matchAll(/^\s{2}([A-Z_]+):/gm)].map((m) => m[1]));
    const used = [...new Set([...preloadSource.matchAll(/CH\.([A-Z_]+)/g)].map((m) => m[1]))];
    const missing = used.filter((name) => !defined.has(name));
    check('ipc: every CH.* used by preload is defined', missing.length === 0, missing);
  }

  const summary = results.filter((r) => !r.ok);
  console.log(`\n${results.length - summary.length}/${results.length} checks passed`);
  if (summary.length) {
    console.log('Failed checks:');
    for (const item of summary) console.log(` - ${item.name} ${JSON.stringify(item.extra)}`);
  }

  win.destroy();
  app.exit(summary.length ? 1 : 0);
}

main().catch((err) => {
  console.error('SMOKE CRASH', err);
  app.exit(2);
});
