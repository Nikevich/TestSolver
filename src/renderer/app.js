// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

const $ = (id) => document.getElementById(id);
const tr = (key, params) => window.I18N.t(key, params);
const pick = (value) => window.I18N.pick(value);

const state = {
  config: {},
  schema: { groups: [], fields: [] },
  status: { running: false },
  models: [],
  answers: [],
  browser: {},
  info: null
};

document.addEventListener('DOMContentLoaded', () => {
  init().catch((err) => {
    toast(tr('toast.initError', { message: err.message }), 'error');
    console.error(err);
  });
});

async function init() {
  if (!window.api) {
    document.body.innerHTML = `<pre style="padding:20px">${tr('toast.preloadError')}</pre>`;
    return;
  }

  wireToolbar();
  wireTabs();
  wireControlPane();
  wireSettingsPane();
  wireSplitter();
  wireHotkeys();
  wireAbout();

  const [config, schema, info] = await Promise.all([
    window.api.config.get(),
    window.api.config.schema(),
    window.api.app.info()
  ]);
  state.config = config;
  state.schema = schema;
  state.info = info;

  window.I18N.setLanguage(getPath(config, 'ui.language'));
  applyStaticTranslations();
  buildSettingsForm();
  fillBackendOptions();
  applyConfig(config);
  applyTheme(getPath(config, 'ui.theme'));
  $('config-path').textContent = `config.json: ${info.configPath}`;
  $('config-path').title = info.configPath;

  await Promise.all([refreshModels(), refreshHealth(), refreshAnswers(), refreshLog()]);
  state.status = await window.api.automation.status();
  renderStatus(state.status);
  subscribe();
  window.api.app.ready();
}

function subscribe() {
  window.api.config.onChanged((config) => {
    const previousLanguage = window.I18N.getLanguage();
    state.config = config;
    applyConfig(config);
    applyTheme(getPath(config, 'ui.theme'));

    const nextLanguage = window.I18N.normalize(getPath(config, 'ui.language'));
    if (nextLanguage !== previousLanguage) reloadLanguage(nextLanguage);
  });

  window.api.browser.onState((browser) => {
    state.browser = browser;
    renderBrowser(browser);
  });

  window.api.automation.onEvent((event) => {
    if (event.type === 'status') {
      renderStatus(event.status);
    } else if (event.type === 'answer') {
      const record = event.record;
      toast(tr('toast.answerChosen', {
        qnum: record.qnum ?? '',
        percent: Math.round((record.confidence || 0) * 100)
      }), 'ok');
    } else if (event.type === 'finished') {
      renderStatus(event.status);
      const isError = event.status.level === 'error' || String(event.status.message || '').startsWith('Ошибка') || String(event.status.message || '').startsWith('Error');
      toast(event.status.message, isError ? 'error' : 'ok');
    }
  });

  window.api.logs.onLine((entry) => appendLog(entry));
  window.api.answers.onNew((record) => addAnswerRow(record, false));
  window.api.layout.onPanelWidth((width) => document.documentElement.style.setProperty('--panel-w', `${width}px`));

  window.api.llm.onPullProgress((progress) => renderPullProgress(progress));
}

/* ---------------------------- toolbar ---------------------------- */

function wireToolbar() {
  const url = $('url');

  $('btn-go').addEventListener('click', go);
  $('btn-open-test').addEventListener('click', async () => {
    const result = await window.api.browser.openTest();
    if (result && result.ok === false) {
      toast(result.error || tr('browser.openTestFailed'), 'error');
      url.focus();
    }
  });
  $('btn-back').addEventListener('click', () => window.api.browser.back());
  $('btn-forward').addEventListener('click', () => window.api.browser.forward());
  $('btn-reload').addEventListener('click', () => window.api.browser.reload());
  $('btn-external').addEventListener('click', () => {
    const target = url.value.trim() || state.browser.url;
    if (target) window.api.browser.openExternal(target);
  });

  url.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') go();
  });

  // Placeholder is only visible before the first navigation.

  function go() {
    const value = url.value.trim();
    if (!value) {
      url.focus();
      return;
    }
    window.api.browser.navigate(value).then((result) => {
      if (result && result.ok === false) toast(result.error || tr('browser.navigateFailed'), 'error');
    });
  }
}

function renderBrowser(browser) {
  const url = $('url');
  if (document.activeElement !== url && browser.url && browser.url !== 'about:blank') {
    url.value = browser.url;
  }
  $('btn-back').disabled = !browser.canGoBack;
  $('btn-forward').disabled = !browser.canGoForward;
  if (browser.error) toast(browser.error, 'error');
}

/* ------------------------------ about ----------------------------- */

function wireAbout() {
  $('about-link').addEventListener('click', async () => {
    const result = await window.api.app.about().catch((err) => ({ ok: false, error: err.message }));
    if (result && result.ok === false) {
      toast(result.error || tr('about.openFailed'), 'error');
    }
  });
}

/* ------------------------------ tabs ----------------------------- */

function wireTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', async () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.pane').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      const pane = document.getElementById(`pane-${tab.dataset.tab}`);
      if (pane) pane.classList.add('active');
      if (tab.dataset.tab === 'log') await refreshLog();
      if (tab.dataset.tab === 'answers') await refreshAnswers();
    });
  });
}

/* --------------------------- control pane ------------------------ */

function wireControlPane() {
  const backend = $('backend');

  backend.addEventListener('change', async () => {
    state.config = await window.api.config.set('backend', backend.value);
    applyConfig(state.config, backend);
    await refreshModels();
  });

  $('model').addEventListener('change', async () => {
    const key = modelKey();
    if (!key) return;
    const value = $('model').value;
    state.config = await window.api.config.set(key, value === '__default__' ? '' : value);
    applyConfig(state.config, $('model'));
  });

  $('btn-refresh-models').addEventListener('click', () => refreshModels(true));

  $('btn-pull').addEventListener('click', async () => {
    const model = $('pull-model').value.trim();
    if (!model) {
      toast(tr('model.nameRequired'), 'error');
      return;
    }
    $('btn-pull').disabled = true;
    $('pull-status').textContent = tr('pull.downloading', { model });
    const result = await window.api.llm.pull(model);
    $('btn-pull').disabled = false;
    if (result && result.ok === false) {
      $('pull-status').textContent = tr('pull.error', { error: result.error });
      toast(result.error || tr('model.failed'), 'error');
    } else {
      $('pull-status').textContent = tr('pull.ready', { model });
      await refreshModels(true);
      await refreshHealth();
    }
  });

  bindNumber('delay', 'automation.delayMs');
  bindNumber('max-questions', 'automation.maxQuestions');
  bindCheckbox('vision', 'vision.enabled');
  bindCheckbox('dry-run', 'automation.dryRun');
  bindCheckbox('click-next', 'automation.clickNext');

  $('btn-start').addEventListener('click', startRun);
  $('btn-stop').addEventListener('click', stopRun);

  $('btn-test-llm').addEventListener('click', async () => {
    $('llm-test-result').textContent = tr('llm.testing');
    const result = await window.api.llm.test();
    if (result && result.ok) {
      $('llm-test-result').textContent = tr('llm.ok', { text: result.text || tr('llm.answerReceived') });
      toast(tr('llm.connected'), 'ok');
    } else {
      $('llm-test-result').textContent = tr('llm.error', { error: (result && result.error) || tr('llm.noResponse') });
      toast((result && result.error) || tr('llm.notResponding'), 'error');
    }
  });
}

function fillBackendOptions() {
  const field = state.schema.fields.find((f) => f.key === 'backend');
  if (!field) return;
  $('backend').innerHTML = (field.options || [])
    .map((option) => `<option value="${escapeAttr(option.value)}">${escapeHtml(pick(option.label))}</option>`)
    .join('');
  $('backend').value = state.config.backend || 'ollama';
}

function bindNumber(id, key) {
  const el = $(id);
  el.addEventListener('change', async () => {
    state.config = await window.api.config.set(key, Number(el.value));
    applyConfig(state.config, el);
  });
}

function bindCheckbox(id, key) {
  const el = $(id);
  el.addEventListener('change', async () => {
    state.config = await window.api.config.set(key, el.checked);
    applyConfig(state.config, el);
  });
}

async function startRun() {
  const result = await window.api.automation.start();
  if (!result || result.ok === false) {
    toast((result && result.error) || tr('run.startFailed'), 'error');
    return;
  }
  toast(tr('run.started'), 'ok');
}

async function stopRun() {
  const result = await window.api.automation.stop();
  if (result && result.ok === false) toast((result && result.error) || tr('run.notRunning'), 'error');
}

function modelKey() {
  if (state.config.backend === 'opencode') return 'opencode.model';
  if (state.config.backend === 'ollama') return 'ollama.model';
  return null;
}

async function refreshModels(showToast = false) {
  const backend = state.config.backend || 'ollama';
  $('btn-refresh-models').disabled = true;
  const result = await window.api.llm.models(backend);
  $('btn-refresh-models').disabled = false;

  state.models = (result.models || []).map((m) => m.name);
  fillModelSelect();

  if (showToast) {
    if (result.ok) toast(tr('model.found', { count: state.models.length }), 'ok');
    else toast(result.error || tr('model.failed'), 'error');
  }
}

function fillModelSelect() {
  const select = $('model');
  const key = modelKey();
  const current = key ? String(getPath(state.config, key) || '') : '';

  if (!key) {
    select.innerHTML = `<option value="">${escapeHtml(tr('model.noneRequired'))}</option>`;
    select.disabled = true;
    $('model-hint').textContent = tr('model.mockHint');
    return;
  }

  select.disabled = false;
  const options = [];
  if (key === 'opencode.model') {
    options.push({ value: '', label: tr('model.defaultFromOpencode') });
  }
  state.models.forEach((name) => options.push({ value: name, label: name }));
  if (current && !state.models.includes(current)) {
    options.push({ value: current, label: tr('model.notFoundSuffix', { name: current }) });
  }

  select.innerHTML = options
    .map((option) => `<option value="${escapeAttr(option.value)}">${escapeHtml(option.label)}</option>`)
    .join('');
  select.value = current;

  const datalist = $('models-datalist');
  datalist.innerHTML = state.models
    .map((name) => `<option value="${escapeAttr(name)}"></option>`)
    .join('');

  if (key === 'ollama.model' && current && !state.models.includes(current)) {
    $('model-hint').textContent = tr('model.notFoundInOllama', { model: current });
  } else if (key === 'ollama.model') {
    $('model-hint').textContent = tr('model.listFromOllama');
  } else {
    $('model-hint').textContent = tr('model.listFromOpencode');
  }
}

async function refreshHealth() {
  const health = await window.api.llm.health();
  setDot('dot-ollama', health.ollama && health.ollama.ok);
  $('ollama-status').textContent = health.ollama && health.ollama.ok
    ? tr('status.ollamaOk', { count: (health.ollama.models || []).length })
    : tr('status.ollamaError', { error: (health.ollama && health.ollama.error) || tr('status.noConnection') });

  setDot('dot-opencode', health.opencode && health.opencode.ok);
  $('opencode-status').textContent = health.opencode && health.opencode.ok
    ? tr('status.opencodeFound')
    : tr('status.opencodeError', { error: (health.opencode && health.opencode.error) || tr('status.opencodeNotFound') });
}

function setDot(id, ok) {
  const dot = $(id);
  dot.classList.toggle('ok', Boolean(ok));
  dot.classList.toggle('bad', !ok);
}

/* --------------------------- settings pane ----------------------- */

function wireSettingsPane() {
  $('btn-reset-all').addEventListener('click', async () => {
    if (!window.confirm(tr('settings.resetConfirm'))) return;
    state.config = await window.api.config.resetAll();
    applyConfig(state.config);
    await refreshModels();
    toast(tr('settings.resetDone'), 'ok');
  });

  $('btn-open-logs').addEventListener('click', () => window.api.logs.openFolder());
  $('btn-log-open').addEventListener('click', () => window.api.logs.openFolder());
  $('btn-log-refresh').addEventListener('click', () => refreshLog());
  $('btn-dump-html').addEventListener('click', async () => {
    const result = await window.api.browser.dumpHtml();
    if (result && result.ok) toast(tr('files.htmlSaved', { path: result.path }), 'ok');
    else toast((result && result.error) || tr('files.htmlSaveFailed'), 'error');
  });
  $('btn-log-clear').addEventListener('click', () => {
    $('log').textContent = '';
  });
  $('btn-export').addEventListener('click', async () => {
    const result = await window.api.answers.export();
    if (result && result.ok) toast(tr('files.saved', { path: result.path }), 'ok');
    else if (result && !result.canceled) toast(result.error || tr('files.saveFailed'), 'error');
  });

  $('settings-form').addEventListener('change', async (event) => {
    const control = event.target.closest('[data-key]');
    if (!control) return;
    const key = control.dataset.key;
    const type = control.dataset.type;
    const value = type === 'boolean' ? control.checked : control.value;

    state.config = await window.api.config.set(key, value);

    if (key === 'ui.language') {
      await reloadLanguage(value);
    } else {
      applyConfig(state.config, control);
    }
    if (key === 'backend') await refreshModels();
  });
}

function buildSettingsForm() {
  const container = $('settings-form');
  container.innerHTML = '';

  const modelKeys = new Set(['ollama.model', 'ollama.visionModel', 'opencode.model']);

  state.schema.groups.forEach((group) => {
    const fields = state.schema.fields.filter((field) => field.group === group.id);
    if (!fields.length) return;

    const section = document.createElement('div');
    section.className = 'settings-group';
    const title = document.createElement('h3');
    title.textContent = pick(group.title);
    section.appendChild(title);

    fields.forEach((field) => {
      const row = document.createElement('div');
      row.className = 'settings-row';

      const head = document.createElement('div');
      head.className = 'field-head';

      const label = document.createElement('span');
      label.className = 'field-label';
      label.textContent = pick(field.label);

      const right = document.createElement('span');
      const def = document.createElement('span');
      def.className = 'field-default';
      def.textContent = tr('settings.default', { value: formatDefault(field) });

      const reset = document.createElement('button');
      reset.className = 'field-reset';
      reset.textContent = '↺';
      reset.title = tr('settings.resetField');
      reset.addEventListener('click', async () => {
        state.config = await window.api.config.reset(field.key);
        applyConfig(state.config);
        toast(tr('settings.resetFieldDone', { label: pick(field.label) }), 'ok');
      });

      right.appendChild(def);
      right.appendChild(reset);
      head.appendChild(label);
      head.appendChild(right);
      row.appendChild(head);

      let control;
      if (field.type === 'select') {
        control = document.createElement('select');
        (field.options || []).forEach((option) => {
          const opt = document.createElement('option');
          opt.value = option.value;
          opt.textContent = pick(option.label);
          control.appendChild(opt);
        });
      } else if (field.type === 'boolean') {
        const wrap = document.createElement('label');
        wrap.className = 'check';
        control = document.createElement('input');
        control.type = 'checkbox';
        const text = document.createElement('span');
        text.textContent = tr('settings.enabled');
        wrap.appendChild(control);
        wrap.appendChild(text);
        row.appendChild(wrap);
      } else {
        control = document.createElement('input');
        control.type = field.type === 'number' ? 'number' : 'text';
        if (field.type === 'number') {
          if (field.min !== undefined) control.min = field.min;
          if (field.max !== undefined) control.max = field.max;
          if (field.step !== undefined) control.step = field.step;
        }
        if (modelKeys.has(field.key)) {
          control.setAttribute('list', 'models-datalist');
          control.placeholder = tr('settings.modelPlaceholder');
        }
      }

      control.dataset.key = field.key;
      control.dataset.type = field.type;
      if (field.type !== 'boolean') row.appendChild(control);

      if (field.help) {
        const help = document.createElement('div');
        help.className = 'field-help';
        help.textContent = pick(field.help);
        row.appendChild(help);
      }

      section.appendChild(row);
    });

    container.appendChild(section);
  });
}

function formatDefault(field) {
  if (field.type === 'boolean') return field.default ? tr('common.yes') : tr('common.no');
  if (field.type === 'select') {
    const option = (field.options || []).find((o) => o.value === field.default);
    return option ? pick(option.label) : String(field.default);
  }
  if (field.default === '' || field.default === undefined) return '—';
  const unit = field.unit ? ` ${pick(field.unit)}` : '';
  return `${field.default}${unit}`;
}

/* --------------------------- config render ----------------------- */

function applyConfig(config, skipElement) {
  state.config = config;

  setIfIdle('backend', config.backend);
  setIfIdle('delay', getPath(config, 'automation.delayMs'));
  setIfIdle('max-questions', getPath(config, 'automation.maxQuestions'));
  setCheckedIfIdle('vision', getPath(config, 'vision.enabled'));
  setCheckedIfIdle('dry-run', getPath(config, 'automation.dryRun'));
  setCheckedIfIdle('click-next', getPath(config, 'automation.clickNext'));

  fillModelSelect();

  $('pull-model').disabled = config.backend !== 'ollama';
  $('btn-pull').disabled = config.backend !== 'ollama';

  document.querySelectorAll('#settings-form [data-key]').forEach((control) => {
    if (control === skipElement || control === document.activeElement) return;
    const key = control.dataset.key;
    const type = control.dataset.type;
    const value = getPath(config, key);
    if (type === 'boolean') control.checked = Boolean(value);
    else control.value = value === undefined || value === null ? '' : value;
  });

  if (window.api && getPath(config, 'ui.theme')) applyTheme(getPath(config, 'ui.theme'));
}

function setIfIdle(id, value) {
  const el = $(id);
  if (!el || el === document.activeElement) return;
  el.value = value === undefined || value === null ? '' : value;
}

function setCheckedIfIdle(id, value) {
  const el = $(id);
  if (!el || el === document.activeElement) return;
  el.checked = Boolean(value);
}

function getPath(object, key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), object);
}

/* ---------------------------- status ----------------------------- */

function renderStatus(status) {
  state.status = status || {};
  const running = Boolean(status && status.running);
  const answered = status ? status.answered || 0 : 0;
  const total = status && status.total ? status.total : 0;

  $('btn-start').disabled = running;
  $('btn-stop').disabled = !running;
  $('backend').disabled = running;
  $('model').disabled = running || !modelKey();

  $('progress-count').textContent = `${answered} / ${total || '—'}`;
  $('progress-msg').textContent = (status && status.message) || tr('control.ready');
  $('bar-fill').style.width = total ? `${Math.min(100, (answered / total) * 100)}%` : answered ? '100%' : '0%';
  $('current-question').textContent = status && status.lastQuestion ? status.lastQuestion : '';
  $('last-answer').textContent = status && status.lastAnswer ? `→ ${status.lastAnswer}` : '';

  $('status-progress').textContent = `${answered} / ${total || '—'}`;
  $('status-avg').textContent = tr('status.avg', { ms: status && status.avgMs ? status.avgMs : 0 });
  $('status-message').textContent = (status && status.message) || tr('status.ready');
}

/* ----------------------------- log ------------------------------- */

async function refreshLog() {
  const lines = await window.api.logs.tail(300);
  const pre = $('log');
  pre.textContent = '';
  lines.forEach((entry) => appendLog(entry, false));
  pre.scrollTop = pre.scrollHeight;
}

function appendLog(entry, scroll = true) {
  const pre = $('log');
  if (!pre) return;
  const line = typeof entry === 'string' ? entry : `${entry.ts || ''} [${(entry.level || 'info').toUpperCase()}] ${entry.message || ''}`;
  const span = document.createElement('span');
  span.className = entry.level || 'info';
  span.textContent = `${line}\n`;
  pre.appendChild(span);
  while (pre.childNodes.length > 600) pre.removeChild(pre.firstChild);
  if (scroll) pre.scrollTop = pre.scrollHeight;
}

/* --------------------------- answers ----------------------------- */

async function refreshAnswers() {
  const list = await window.api.answers.list();
  state.answers = list;
  const body = $('answers-body');
  body.innerHTML = '';
  list.forEach((record) => addAnswerRow(record, false, false));
  $('answers-count').textContent = tr('answers.count', { count: list.length });
}

function addAnswerRow(record, isLive, scroll = true) {
  const body = $('answers-body');
  if (!body) return;
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${escapeHtml(String(record.qnum ?? '—'))}</td>
    <td title="${escapeAttr(record.question || '')}">${escapeHtml(truncate(record.question || '', 160))}</td>
    <td title="${escapeAttr((record.chosen || []).join(' | '))}">${escapeHtml(truncate((record.chosen || []).join(' | '), 160))}</td>
    <td>${record.confidence === undefined ? '—' : Math.round(Number(record.confidence) * 100) + '%'}</td>
    <td>${record.ms ?? '—'}</td>
  `;
  if (isLive) body.prepend(row);
  else body.appendChild(row);

  const count = body.childNodes.length;
  $('answers-count').textContent = tr('answers.count', { count });
}

/* --------------------------- splitter ---------------------------- */

function wireSplitter() {
  const splitter = $('splitter');
  let dragging = false;

  splitter.addEventListener('mousedown', (event) => {
    dragging = true;
    event.preventDefault();
    document.body.style.cursor = 'col-resize';
  });

  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    const width = Math.round(window.innerWidth - event.clientX);
    const clamped = Math.min(Math.max(width, 320), window.innerWidth - 480);
    document.documentElement.style.setProperty('--panel-w', `${clamped}px`);
  });

  window.addEventListener('mouseup', async () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    const width = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--panel-w'), 10) || 400;
    state.config = await window.api.config.set('ui.panelWidth', width);
    window.api.layout.setPanelWidth(width);
  });
}

/* --------------------------- misc -------------------------------- */

function wireHotkeys() {
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && (event.key === 'S' || event.key === 's' || event.key === 'Ы' || event.key === 'ы')) {
      event.preventDefault();
      if (state.status && state.status.running) stopRun();
      else startRun();
    }
  });
}

function applyTheme(theme) {
  if (!theme || theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = theme;
}

function applyStaticTranslations() {
  document.documentElement.lang = window.I18N.getLanguage();
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = tr(element.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((element) => {
    element.title = tr(element.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    element.placeholder = tr(element.dataset.i18nPlaceholder);
  });
}

async function reloadLanguage(language) {
  window.I18N.setLanguage(language);
  applyStaticTranslations();
  fillBackendOptions();
  buildSettingsForm();
  applyConfig(state.config);
  renderStatus(await window.api.automation.status());
  await Promise.all([refreshHealth(), refreshAnswers()]);
}

function renderPullProgress(progress) {
  const status = progress.status || '';
  if (progress.done || status === 'success') {
    $('pull-status').textContent = tr('pull.ready', { model: progress.model });
    return;
  }
  const total = progress.total || 0;
  const completed = progress.completed || 0;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  $('pull-status').textContent = total
    ? `${status} ${percent}% (${formatBytes(completed)} / ${formatBytes(total)})`
    : status;
}

function formatBytes(bytes) {
  if (!bytes) return tr('bytes.zero');
  const units = [tr('bytes.b'), tr('bytes.kb'), tr('bytes.mb'), tr('bytes.gb')];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}

function toast(message, kind = '') {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`.trim();
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .25s';
    setTimeout(() => el.remove(), 260);
  }, 3800);
}

function truncate(text, limit) {
  const value = String(text || '');
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}
