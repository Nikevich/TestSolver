// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

/**
 * Renders the panel UI with stubbed IPC data and saves a PNG screenshot.
 * Used to eyeball layout/CSS changes without a running backend.
 *
 *   electron scripts/screenshot.js [out.png]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const { GROUPS, FIELDS, defaultsObject } = require('../src/shared/schema');

app.disableHardwareAcceleration();

const outFile = process.argv[2] || path.join(os.tmpdir(), 'testsolver-ui.png');

function stubPreload() {
  const config = defaultsObject();
  config['automation.startUrl'] = 'https://orioks.miet.ru/student/student';

  const data = {
    config,
    schema: {
      groups: GROUPS,
      fields: FIELDS.map((f) => ({
        key: f.key,
        group: f.group,
        label: f.label,
        type: f.type,
        default: f.default,
        options: f.options,
        min: f.min,
        max: f.max,
        step: f.step,
        unit: f.unit,
        help: f.help
      }))
    },
    models: { ok: true, models: [{ name: 'qwen2.5:7b-instruct' }, { name: 'qwen2.5vl:7b' }] },
    health: {
      ollama: { ok: true, models: ['qwen2.5:7b-instruct', 'qwen2.5vl:7b'] },
      opencode: { ok: true, path: 'C:\\Users\\niksh\\AppData\\Roaming\\npm\\node_modules\\@opencode\\cli\\bin\\opencode.exe' },
      backend: 'ollama'
    },
    status: {
      running: false,
      message: 'Готов к запуску',
      answered: 0,
      total: 0,
      avgMs: 0,
      lastQuestion: '',
      lastAnswer: ''
    },
    answers: [],
    log: [
      '2026-10-27T09:14:46.410Z [INFO] TestSolver запущен {"portable":false}',
      '2026-10-27T09:14:46.564Z [INFO] Интерфейс загружен {"version":"1.0.0"}'
    ],
    info: { version: '1.0.0', configPath: path.join(os.tmpdir(), 'config.json'), logDir: os.tmpdir(), portable: false }
  };

  const file = path.join(os.tmpdir(), `testsolver-stub-preload-${Date.now()}.js`);
  fs.writeFileSync(
    file,
    `'use strict';
const { contextBridge } = require('electron');
const DATA = ${JSON.stringify(data)};
const noop = () => () => {};
contextBridge.exposeInMainWorld('api', {
  config: {
    get: async () => DATA.config,
    schema: async () => DATA.schema,
    set: async (key, value) => { DATA.config[key] = value; return DATA.config; },
    setMany: async () => DATA.config,
    reset: async () => DATA.config,
    resetAll: async () => DATA.config,
    path: async () => DATA.info.configPath,
    onChanged: noop
  },
  llm: {
    health: async () => DATA.health,
    models: async () => DATA.models,
    pull: async () => ({ ok: true }),
    test: async () => ({ ok: true, text: 'pong' }),
    onPullProgress: noop
  },
  automation: {
    start: async () => ({ ok: true }),
    stop: async () => ({ ok: true }),
    status: async () => DATA.status,
    onEvent: noop
  },
  browser: {
    navigate: async () => ({ ok: true }),
    back: async () => {},
    forward: async () => {},
    reload: async () => {},
    openExternal: async () => {},
    openTest: async () => ({ ok: true }),
    onState: noop
  },
  logs: { tail: async () => DATA.log, openFolder: async () => {}, onLine: noop },
  answers: { list: async () => DATA.answers, export: async () => ({ ok: false, canceled: true }), onNew: noop },
  layout: { setPanelWidth: async () => 400, onPanelWidth: noop },
  app: { info: async () => DATA.info, ready: async () => true, onThemeChanged: noop }
});
`,
    'utf8'
  );
  return file;
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1500,
    height: 940,
    show: false,
    backgroundColor: '#f3f4f6',
    webPreferences: {
      preload: stubPreload(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  await win.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const base = outFile.replace(/\.png$/i, '');

  const control = await win.webContents.capturePage();
  fs.writeFileSync(`${base}-control.png`, control.toPNG());
  console.log(`saved ${base}-control.png`);

  await win.webContents.executeJavaScript(
    `document.querySelector('.tab[data-tab="settings"]').click()`,
    true
  );
  await new Promise((resolve) => setTimeout(resolve, 500));

  const settings = await win.webContents.capturePage();
  fs.writeFileSync(`${base}-settings.png`, settings.toPNG());
  console.log(`saved ${base}-settings.png`);

  app.exit(0);
});

app.on('window-all-closed', () => app.exit(0));
