// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

const path = require('path');
const fs = require('fs');
const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  session,
  shell,
  dialog,
  Menu
} = require('electron');

const { ConfigStore } = require('./config');
const { Logger } = require('./logger');
const { Runner } = require('./automation');
const { pageHtmlScript } = require('./dom');
const ollama = require('./llm/ollama');
const opencode = require('./llm/opencode');
const { GROUPS, FIELDS } = require('../shared/schema');
const IPC = require('../shared/ipc');

app.setName('TestSolver');
app.setAppUserModelId('local.testsolver');

const TOOLBAR_H = 44;
const STATUS_H = 28;
const HEADLESS = process.argv.includes('--headless');

let mainWindow = null;
let siteView = null;
let config = null;
let logger = null;
let runner = null;
let configPath = '';
let startUrlSaveTimer = null;
let answers = [];

const isPortable = process.argv.includes('--portable') || Boolean(process.env.PORTABLE_EXECUTABLE_DIR);

function baseDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR;
  if (isPortable) return path.dirname(process.execPath);
  return app.getPath('userData');
}

function logsDir() {
  const custom = config.get('logging.dir');
  return custom && String(custom).trim() ? custom : path.join(baseDir(), 'logs');
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function applyLoggerConfig() {
  logger.configure({
    dir: logsDir(),
    level: config.get('logging.level'),
    rotateMb: config.get('logging.rotateMb'),
    answersEnabled: config.get('logging.answersJsonl')
  });
}

function createSiteView() {
  const siteSession = session.fromPartition('persist:testsolver');
  siteSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

  siteView = new WebContentsView({
    webPreferences: {
      session: siteSession,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  siteView.setBackgroundColor('#ffffff');
  siteView.setVisible(false);

  const chromeVersion = process.versions.chrome || '120.0.0.0';
  siteView.webContents.setUserAgent(
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
  );

  siteView.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) siteView.webContents.loadURL(url);
    return { action: 'deny' };
  });

  const state = () => sendBrowserState();
  siteView.webContents.on('did-navigate', state);
  siteView.webContents.on('did-navigate-in-page', state);
  siteView.webContents.on('did-start-loading', state);
  siteView.webContents.on('did-stop-loading', state);
  siteView.webContents.on('page-title-updated', state);
  siteView.webContents.on('render-process-gone', (_e, details) => {
    logger.error('Процесс страницы упал', details);
  });

  mainWindow.contentView.addChildView(siteView);
  layout();
}

function browserState() {
  const wc = siteView ? siteView.webContents : null;
  if (!wc || wc.isDestroyed()) {
    return { url: '', canGoBack: false, canGoForward: false, loading: false, title: '' };
  }
  let canGoBack = false;
  let canGoForward = false;
  try {
    canGoBack = wc.navigationHistory.canGoBack();
    canGoForward = wc.navigationHistory.canGoForward();
  } catch (_) {
    canGoBack = typeof wc.canGoBack === 'function' ? wc.canGoBack() : false;
    canGoForward = typeof wc.canGoForward === 'function' ? wc.canGoForward() : false;
  }
  return {
    url: wc.getURL(),
    canGoBack,
    canGoForward,
    loading: wc.isLoading(),
    title: wc.getTitle()
  };
}

function sendBrowserState() {
  send(IPC.BROWSER_STATE, browserState());
}

function rememberStartUrl(url) {
  if (!/^https?:/i.test(url)) return;
  if (startUrlSaveTimer) clearTimeout(startUrlSaveTimer);
  startUrlSaveTimer = setTimeout(() => {
    if (config.get('automation.startUrl') === url) return;
    config.set('automation.startUrl', url);
    try {
      config.save();
    } catch (err) {
      logger.warn('Не удалось сохранить startUrl', { error: err.message });
    }
    send(IPC.CONFIG_CHANGED, config.all());
  }, 800);
}

function layout() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const [width, height] = mainWindow.getContentSize();
  const configured = Number(config.get('ui.panelWidth')) || 400;
  const panelWidth = Math.min(Math.max(configured, 320), Math.max(360, width - 480));

  if (siteView) {
    siteView.setBounds({
      x: 0,
      y: TOOLBAR_H,
      width: Math.max(300, width - panelWidth),
      height: Math.max(120, height - TOOLBAR_H - STATUS_H)
    });
  }
  send(IPC.LAYOUT_PANEL_WIDTH, panelWidth);
}

function navigate(input) {
  if (!siteView) return { ok: false };
  let url = String(input || '').trim();
  if (!url) return { ok: false, error: 'Пустой адрес' };
  if (!/^[a-z]+:\/\//i.test(url)) url = `https://${url}`;
  if (!/^https?:/i.test(url)) return { ok: false, error: 'Поддерживаются только http/https' };

  siteView.setVisible(true);
  siteView.webContents.loadURL(url).catch((err) => {
    logger.warn('Не удалось открыть адрес', { url, error: err.message });
    send(IPC.BROWSER_STATE, { ...browserState(), error: err.message });
  });
  rememberStartUrl(url);
  return { ok: true, url };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1000,
    minHeight: 680,
    backgroundColor: '#f3f4f6',
    title: 'TestSolver',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.once('ready-to-show', () => {
    if (!HEADLESS) mainWindow.show();
    send(IPC.CONFIG_CHANGED, config.all());
    send(IPC.BROWSER_STATE, browserState());
    layout();
  });

  mainWindow.webContents.on('console-message', (...args) => {
    try {
      const details = args[1] && typeof args[1] === 'object' ? args[1] : { level: args[1], message: args[2] };
      const level = String(details.level || '').toLowerCase();
      if (level.includes('error') || level === '3') {
        logger.warn('renderer console', { message: details.message, source: details.sourceId, line: details.lineNumber });
      }
    } catch (_) {
      /* ignore */
    }
  });

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    logger.error('preload error', { preloadPath, error: error.message });
  });

  mainWindow.on('resize', layout);
  mainWindow.on('maximize', layout);
  mainWindow.on('unmaximize', layout);

  mainWindow.on('close', () => {
    if (runner && runner.running) runner.stop();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-finish-load', () => {
    send(IPC.CONFIG_CHANGED, config.all());
    send(IPC.BROWSER_STATE, browserState());
    layout();
  });
}

function registerIpc() {
  ipcMain.handle(IPC.CONFIG_GET, () => config.all());
  ipcMain.handle(IPC.CONFIG_SCHEMA, () => ({
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
  }));

  ipcMain.handle(IPC.CONFIG_SET, (_event, payload) => {
    const { key, value } = payload || {};
    config.set(key, value);
    config.save();
    afterConfigChange(key);
    return config.all();
  });

  ipcMain.handle(IPC.CONFIG_SET_MANY, (_event, values) => {
    config.setMany(values || {});
    config.save();
    afterConfigChange(null);
    return config.all();
  });

  ipcMain.handle(IPC.CONFIG_RESET, (_event, key) => {
    config.reset(key);
    config.save();
    afterConfigChange(key);
    return config.all();
  });

  ipcMain.handle(IPC.CONFIG_RESET_ALL, () => {
    config.resetAll();
    config.save();
    afterConfigChange(null);
    return config.all();
  });

  ipcMain.handle(IPC.CONFIG_PATH, () => configPath);

  ipcMain.handle(IPC.LLM_HEALTH, async () => {
    const cfg = config.flat();
    const [ollamaState, opencodeState] = await Promise.all([
      ollama.health(cfg),
      opencode.health(cfg)
    ]);
    return { ollama: ollamaState, opencode: opencodeState, backend: cfg.backend };
  });

  ipcMain.handle(IPC.LLM_MODELS, async (_event, backend) => {
    const cfg = config.flat();
    const target = backend || cfg.backend;
    try {
      if (target === 'opencode') return { ok: true, models: await opencode.listModels(cfg) };
      if (target === 'mock') return { ok: true, models: [{ name: 'mock' }] };
      return { ok: true, models: await ollama.listModels(cfg) };
    } catch (err) {
      return { ok: false, error: err.message, models: [] };
    }
  });

  ipcMain.handle(IPC.LLM_PULL, async (_event, model) => {
    const cfg = config.flat();
    if (!model) return { ok: false, error: 'Не указана модель' };
    try {
      await ollama.pull(cfg, model, (event) => {
        send(IPC.LLM_PULL_PROGRESS, { model, ...event });
      });
      send(IPC.LLM_PULL_PROGRESS, { model, status: 'success', done: true });
      return { ok: true };
    } catch (err) {
      logger.error('Ошибка скачивания модели', { model, error: err.message });
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle(IPC.LLM_TEST, async () => {
    const cfg = config.flat();
    try {
      if (cfg.backend === 'mock') return { ok: true, text: 'mock готов' };
      if (cfg.backend === 'opencode') {
        const result = await opencode.test(cfg);
        return result;
      }
      const data = await ollama.chat(cfg, {
        messages: [{ role: 'user', content: 'Ответь одним словом: ping' }]
      });
      return { ok: true, text: String(data.content || '').slice(0, 200) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle(IPC.AUTOMATION_START, () => runner.start());
  ipcMain.handle(IPC.AUTOMATION_STOP, () => runner.stop());
  ipcMain.handle(IPC.AUTOMATION_STATUS, () => runner.status());

  ipcMain.handle(IPC.BROWSER_NAVIGATE, (_event, url) => navigate(url));
  ipcMain.handle(IPC.BROWSER_BACK, () => {
    try {
      siteView.webContents.navigationHistory.goBack();
    } catch (_) {
      /* ignore */
    }
  });
  ipcMain.handle(IPC.BROWSER_FORWARD, () => {
    try {
      siteView.webContents.navigationHistory.goForward();
    } catch (_) {
      /* ignore */
    }
  });
  ipcMain.handle(IPC.BROWSER_RELOAD, () => siteView.webContents.reload());
  ipcMain.handle(IPC.BROWSER_OPEN_EXTERNAL, (_event, url) => {
    const target = url || (siteView && siteView.webContents.getURL());
    if (target) shell.openExternal(target);
  });
  ipcMain.handle(IPC.BROWSER_OPEN_TEST, () => {
    const url = config.get('automation.startUrl');
    if (!url) return { ok: false, error: 'Стартовый URL не задан' };
    return navigate(url);
  });
  ipcMain.handle(IPC.BROWSER_DUMP_HTML, async () => {
    try {
      const data = await siteView.webContents.executeJavaScript(pageHtmlScript(), true);
      fs.mkdirSync(logger.dir, { recursive: true });
      const file = path.join(logger.dir, `page-${Date.now()}.html`);
      fs.writeFileSync(file, `<!-- ${data.url}\n     ${data.title} -->\n${data.html || ''}`, 'utf8');
      logger.info('HTML страницы сохранён по запросу', { file });
      return { ok: true, path: file };
    } catch (err) {
      logger.warn('Не удалось сохранить HTML страницы', { error: err.message });
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle(IPC.LOG_TAIL, (_event, limit) => logger.tail(limit || 300));
  ipcMain.handle(IPC.LOG_OPEN_FOLDER, () => {
    fs.mkdirSync(logger.dir, { recursive: true });
    shell.openPath(logger.dir);
  });

  ipcMain.handle(IPC.ANSWERS_LIST, () => answers.slice(-300));
  ipcMain.handle(IPC.ANSWERS_EXPORT, async () => {
    if (!answers.length) return { ok: false, error: 'Журнал пуст' };
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Экспорт ответов',
      defaultPath: path.join(app.getPath('documents'), `testsolver-answers-${Date.now()}.json`),
      filters: [
        { name: 'JSON', extensions: ['json'] },
        { name: 'CSV', extensions: ['csv'] }
      ]
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };

    const file = result.filePath;
    try {
      if (/\.csv$/i.test(file)) {
        const header = ['ts', 'qnum', 'question', 'chosen', 'confidence', 'backend', 'model', 'vision', 'ms'];
        const lines = [header.join(';')];
        for (const record of answers) {
          const row = [
            record.ts,
            record.qnum ?? '',
            record.question,
            (record.chosen || []).join(' | '),
            record.confidence,
            record.backend,
            record.model,
            record.vision ? 'yes' : 'no',
            record.ms
          ].map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`);
          lines.push(row.join(';'));
        }
        fs.writeFileSync(file, `${lines.join('\r\n')}\r\n`, 'utf8');
      } else {
        fs.writeFileSync(file, JSON.stringify(answers, null, 2), 'utf8');
      }
      return { ok: true, path: file };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle(IPC.LAYOUT_PANEL_WIDTH, (_event, width) => {
    config.set('ui.panelWidth', width);
    try {
      config.save();
    } catch (_) {
      /* ignore */
    }
    layout();
    return config.get('ui.panelWidth');
  });

  ipcMain.handle(IPC.APP_INFO, () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    configPath,
    logDir: logger.dir,
    portable: isPortable,
    copyright: 'Copyright (C) 2026 Shkilevich Nikita',
    licenseName: 'AGPL-3.0-only OR LicenseRef-Commercial',
    licenseUrl: 'https://www.gnu.org/licenses/agpl-3.0.txt',
    commercialEmail: 'nik.shkilevich3@gmail.com',
    sourceUrl: ''
  }));

  ipcMain.handle(IPC.APP_ABOUT, async () => {
    const buttons = ['Текст лицензии', 'Коммерческая лицензия', 'Закрыть'];
    const detail = [
      'Copyright (C) 2026 Shkilevich Nikita',
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
    ].join('\n');

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'О программе',
      message: `TestSolver ${app.getVersion()}`,
      detail,
      buttons,
      defaultId: 2,
      cancelId: 2,
      noLink: true
    });

    if (result.response === 0) shell.openExternal('https://www.gnu.org/licenses/agpl-3.0.txt');
    if (result.response === 1) {
      shell.openExternal('mailto:nik.shkilevich3@gmail.com?subject=TestSolver%20commercial%20license');
    }
    return { ok: true, response: result.response };
  });

  ipcMain.handle(IPC.RENDERER_READY, () => {
    logger.info('Интерфейс загружен', { version: app.getVersion() });
    return true;
  });
}

function afterConfigChange(key) {
  if (!key || key.startsWith('logging.')) applyLoggerConfig();
  if (!key || key === 'ui.panelWidth') layout();
  send(IPC.CONFIG_CHANGED, config.all());
}

function wireLogger() {
  logger.on('line', (entry) => send(IPC.LOG_LINE, entry));
  logger.on('answer', (record) => {
    answers.push(record);
    if (answers.length > 2000) answers = answers.slice(-2000);
    send(IPC.ANSWERS_NEW, record);
  });
}

function loadAnswersFromDisk() {
  try {
    const file = logger.answersPath;
    if (!fs.existsSync(file)) return;
    const lines = fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-300);
    for (const line of lines) {
      try {
        answers.push(JSON.parse(line));
      } catch (_) {
        /* skip malformed line */
      }
    }
  } catch (err) {
    logger.warn('Не удалось прочитать журнал ответов', { error: err.message });
  }
}

function wireRunner() {
  runner.on('status', (status) => send(IPC.AUTOMATION_EVENT, { type: 'status', status }));
  runner.on('answer', (record) => send(IPC.AUTOMATION_EVENT, { type: 'answer', record }));
  runner.on('finished', (status) => send(IPC.AUTOMATION_EVENT, { type: 'finished', status }));
}

process.on('uncaughtException', (err) => {
  try {
    if (logger) logger.error('uncaughtException', { error: err.message, stack: err.stack });
  } catch (_) {
    /* ignore */
  }
});
process.on('unhandledRejection', (err) => {
  try {
    if (logger) logger.error('unhandledRejection', { error: String(err) });
  } catch (_) {
    /* ignore */
  }
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    configPath = path.join(baseDir(), 'config.json');
    config = new ConfigStore(configPath);
    config.applyArgv(process.argv);
    const hadConfig = fs.existsSync(configPath);

    logger = new Logger({
      dir: logsDir(),
      level: config.get('logging.level'),
      rotateMb: config.get('logging.rotateMb'),
      answersEnabled: config.get('logging.answersJsonl')
    });
    wireLogger();
    logger.info('TestSolver запущен', { configPath, portable: isPortable });
    loadAnswersFromDisk();

    if (!hadConfig) {
      try {
        config.save();
        logger.info('Создан config.json со значениями по умолчанию', { configPath });
      } catch (err) {
        logger.warn('Не удалось сохранить config.json', { error: err.message });
      }
    }

    runner = new Runner({
      getWebContents: () => (siteView && !siteView.webContents.isDestroyed() ? siteView.webContents : null),
      getConfig: () => config.flat(),
      logger
    });
    wireRunner();

    createWindow();
    createSiteView();
    registerIpc();

    // Load saved test page once the renderer is ready.
    mainWindow.webContents.once('did-finish-load', () => {
      const url = config.get('automation.startUrl');
      if (url) navigate(url);
      else send(IPC.BROWSER_STATE, browserState());
    });

    if (config.loadError) {
      logger.warn('Не удалось прочитать config.json, используются значения по умолчанию', {
        error: config.loadError
      });
    }
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('before-quit', () => {
    if (runner && runner.running) runner.stop();
  });
}
