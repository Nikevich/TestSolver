// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Sandboxed preload cannot require local modules, so channel names are inlined here.
const CH = {
  CONFIG_GET: 'config:get',
  CONFIG_SCHEMA: 'config:schema',
  CONFIG_SET: 'config:set',
  CONFIG_SET_MANY: 'config:set-many',
  CONFIG_RESET: 'config:reset',
  CONFIG_RESET_ALL: 'config:reset-all',
  CONFIG_CHANGED: 'config:changed',
  CONFIG_PATH: 'config:path',
  LLM_HEALTH: 'llm:health',
  LLM_MODELS: 'llm:models',
  LLM_PULL: 'llm:pull',
  LLM_PULL_PROGRESS: 'llm:pull-progress',
  LLM_TEST: 'llm:test',
  AUTOMATION_START: 'automation:start',
  AUTOMATION_STOP: 'automation:stop',
  AUTOMATION_STATUS: 'automation:status',
  AUTOMATION_EVENT: 'automation:event',
  BROWSER_NAVIGATE: 'browser:navigate',
  BROWSER_BACK: 'browser:back',
  BROWSER_FORWARD: 'browser:forward',
  BROWSER_RELOAD: 'browser:reload',
  BROWSER_OPEN_EXTERNAL: 'browser:open-external',
  BROWSER_STATE: 'browser:state',
  BROWSER_OPEN_TEST: 'browser:open-test',
  BROWSER_DUMP_HTML: 'browser:dump-html',
  LOG_TAIL: 'log:tail',
  LOG_LINE: 'log:line',
  LOG_OPEN_FOLDER: 'log:open-folder',
  ANSWERS_LIST: 'answers:list',
  ANSWERS_NEW: 'answers:new',
  ANSWERS_EXPORT: 'answers:export',
  LAYOUT_PANEL_WIDTH: 'layout:panel-width',
  APP_INFO: 'app:info',
  APP_ABOUT: 'app:about',
  RENDERER_READY: 'app:renderer-ready',
  THEME_CHANGED: 'theme:changed'
};

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('api', {
  config: {
    get: () => ipcRenderer.invoke(CH.CONFIG_GET),
    schema: () => ipcRenderer.invoke(CH.CONFIG_SCHEMA),
    set: (key, value) => ipcRenderer.invoke(CH.CONFIG_SET, { key, value }),
    setMany: (values) => ipcRenderer.invoke(CH.CONFIG_SET_MANY, values),
    reset: (key) => ipcRenderer.invoke(CH.CONFIG_RESET, key),
    resetAll: () => ipcRenderer.invoke(CH.CONFIG_RESET_ALL),
    path: () => ipcRenderer.invoke(CH.CONFIG_PATH),
    onChanged: (callback) => subscribe(CH.CONFIG_CHANGED, callback)
  },
  llm: {
    health: () => ipcRenderer.invoke(CH.LLM_HEALTH),
    models: (backend) => ipcRenderer.invoke(CH.LLM_MODELS, backend),
    pull: (model) => ipcRenderer.invoke(CH.LLM_PULL, model),
    test: () => ipcRenderer.invoke(CH.LLM_TEST),
    onPullProgress: (callback) => subscribe(CH.LLM_PULL_PROGRESS, callback)
  },
  automation: {
    start: () => ipcRenderer.invoke(CH.AUTOMATION_START),
    stop: () => ipcRenderer.invoke(CH.AUTOMATION_STOP),
    status: () => ipcRenderer.invoke(CH.AUTOMATION_STATUS),
    onEvent: (callback) => subscribe(CH.AUTOMATION_EVENT, callback)
  },
  browser: {
    navigate: (url) => ipcRenderer.invoke(CH.BROWSER_NAVIGATE, url),
    back: () => ipcRenderer.invoke(CH.BROWSER_BACK),
    forward: () => ipcRenderer.invoke(CH.BROWSER_FORWARD),
    reload: () => ipcRenderer.invoke(CH.BROWSER_RELOAD),
    openExternal: (url) => ipcRenderer.invoke(CH.BROWSER_OPEN_EXTERNAL, url),
    openTest: () => ipcRenderer.invoke(CH.BROWSER_OPEN_TEST),
    dumpHtml: () => ipcRenderer.invoke(CH.BROWSER_DUMP_HTML),
    onState: (callback) => subscribe(CH.BROWSER_STATE, callback)
  },
  logs: {
    tail: (limit) => ipcRenderer.invoke(CH.LOG_TAIL, limit),
    openFolder: () => ipcRenderer.invoke(CH.LOG_OPEN_FOLDER),
    onLine: (callback) => subscribe(CH.LOG_LINE, callback)
  },
  answers: {
    list: () => ipcRenderer.invoke(CH.ANSWERS_LIST),
    export: () => ipcRenderer.invoke(CH.ANSWERS_EXPORT),
    onNew: (callback) => subscribe(CH.ANSWERS_NEW, callback)
  },
  layout: {
    setPanelWidth: (width) => ipcRenderer.invoke(CH.LAYOUT_PANEL_WIDTH, width),
    onPanelWidth: (callback) => subscribe(CH.LAYOUT_PANEL_WIDTH, callback)
  },
  app: {
    info: () => ipcRenderer.invoke(CH.APP_INFO),
    about: () => ipcRenderer.invoke(CH.APP_ABOUT),
    ready: () => ipcRenderer.invoke(CH.RENDERER_READY),
    onThemeChanged: (callback) => subscribe(CH.THEME_CHANGED, callback)
  }
});
