// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

/** IPC channel names shared by main and preload. */
module.exports = {
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
  RENDERER_READY: 'app:renderer-ready'
};
