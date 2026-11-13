// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const {
  EXTRACT_JS,
  clickOptionScript,
  highlightOptionScript,
  fillTextScript,
  highlightInputScript,
  clickNextScript,
  pageHtmlScript
} = require('./dom');
const solver = require('./solver');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Runner extends EventEmitter {
  constructor({ getWebContents, getConfig, logger }) {
    super();
    this.getWebContents = getWebContents;
    this.getConfig = getConfig;
    this.logger = logger;

    this.running = false;
    this.abort = null;
    this.cfg = null;
    this.message = 'Готов к запуску';
    this.stats = this.emptyStats();
    this.visionUsed = 0;
  }

  emptyStats() {
    return {
      startedAt: null,
      answered: 0,
      failures: 0,
      qnum: null,
      total: null,
      latencies: [],
      lastQuestion: '',
      lastAnswer: '',
      lastConfidence: null
    };
  }

  status() {
    const avg = this.stats.latencies.length
      ? Math.round(this.stats.latencies.reduce((a, b) => a + b, 0) / this.stats.latencies.length)
      : 0;
    return {
      running: this.running,
      message: this.message,
      startedAt: this.stats.startedAt,
      answered: this.stats.answered,
      failures: this.stats.failures,
      qnum: this.stats.qnum,
      total: this.stats.total,
      avgMs: avg,
      lastQuestion: this.stats.lastQuestion,
      lastAnswer: this.stats.lastAnswer,
      lastConfidence: this.stats.lastConfidence,
      visionUsed: this.visionUsed,
      backend: this.cfg ? this.cfg.backend : null,
      model: this.cfg ? (this.cfg.backend === 'opencode' ? this.cfg['opencode.model'] : this.cfg['ollama.model']) : null,
      mode: this.cfg ? this.cfg['automation.mode'] : null,
      dryRun: this.cfg ? Boolean(this.cfg['automation.dryRun']) : false
    };
  }

  emitStatus() {
    this.emit('status', this.status());
  }

  start() {
    if (this.running) return { ok: false, error: 'Автопрогон уже запущен' };

    this.cfg = this.getConfig();
    this.running = true;
    this.abort = new AbortController();
    this.message = 'Подготовка...';
    this.stats = this.emptyStats();
    this.stats.startedAt = Date.now();
    this.visionUsed = 0;

    this.logger.info('Автопрогон запущен', {
      backend: this.cfg.backend,
      mode: this.cfg['automation.mode'],
      dryRun: this.cfg['automation.dryRun']
    });
    this.emitStatus();

    this.run().catch((err) => {
      if (!this.running) return;
      this.finish(`Ошибка: ${err.message}`, 'error');
    });

    return { ok: true };
  }

  stop() {
    if (!this.running) return { ok: false, error: 'Автопрогон не запущен' };
    this.finish('Остановлено пользователем');
    return { ok: true };
  }

  finish(message, level = 'info') {
    if (!this.running) return;
    this.running = false;
    this.message = message;
    try {
      if (this.abort) this.abort.abort();
    } catch (_) {
      /* ignore */
    }
    const status = this.status();
    this.logger[level === 'error' ? 'error' : 'info'](message, { answered: status.answered });
    this.emitStatus();
    this.emit('finished', status);
  }

  async run() {
    const cfg = this.cfg;
    let q = await this.waitForQuestion();
    if (!q) {
      await this.dumpPage('no-question');
      throw new Error('Не удалось найти ни вариантов ответа, ни поля ввода на странице');
    }

    while (this.running) {
      if (cfg['automation.maxQuestions'] > 0 && this.stats.answered >= cfg['automation.maxQuestions']) {
        this.finish('Достигнут лимит вопросов');
        return;
      }
      if (q.qnum && q.total && q.qnum > q.total) {
        this.finish('Все вопросы пройдены');
        return;
      }

      this.stats.qnum = q.qnum;
      this.stats.total = q.total;
      this.stats.lastQuestion = q.question;
      this.message = `Отправляю вопрос ${q.qnum || this.stats.answered + 1} в ${cfg.backend}`;
      if (cfg['automation.dryRun']) this.message += ' (dry run)';
      this.emitStatus();

      const startedAt = Date.now();
      let result;
      try {
        result = await this.ask(q);
      } catch (err) {
        if (!this.running) return;
        this.stats.failures += 1;
        this.logger.error('Не удалось получить ответ', { error: err.message, raw: err.raw });
        if (this.stats.failures >= Number(cfg['automation.maxParseFailures'])) {
          throw new Error(`Много ошибок подряд: ${err.message}`);
        }
        await sleep(1500);
        q = await this.extract();
        if (!Runner.usable(q)) {
          await this.dumpPage('lost-question');
          throw new Error('Страница перестала быть доступной');
        }
        continue;
      }

      if (!result) throw new Error('Модель не вернула ответ');
      if (!this.running) return;

      let applied;
      let effective = [];
      let chosen;

      if (q.type === 'text') {
        const value = String(result.value == null ? '' : result.value).trim();
        if (!value) throw new Error('Модель не вернула значение для поля ввода');
        applied = await this.fillTextAnswer(value);
        if (!applied.ok) {
          throw new Error(`Не удалось заполнить текстовое поле${applied.reason ? ` (${applied.reason})` : ''}`);
        }
        chosen = [applied.value || value];
      } else {
        if (!Array.isArray(result.answers) || !result.answers.length) {
          throw new Error('Модель не вернула ответ');
        }
        const answers = result.answers.filter(
          (idx) => Number.isInteger(idx) && idx >= 0 && idx < q.options.length
        );
        if (!answers.length) throw new Error('Ответ модели не соответствует вариантам на странице');
        effective = q.type === 'multi' ? answers : [answers[0]];

        applied = await this.clickAnswers(effective);
        if (!applied.ok) throw new Error('Не удалось выбрать вариант на странице');
        chosen = effective.map((i) => q.options[i].text);
      }

      const ms = Date.now() - startedAt;
      this.stats.latencies.push(ms);
      this.stats.answered += 1;
      this.stats.failures = 0;
      this.stats.lastConfidence = result.confidence;
      this.stats.lastAnswer = chosen.join(' | ');

      const record = {
        ts: new Date().toISOString(),
        url: q.url,
        qnum: q.qnum,
        total: q.total,
        question: q.question,
        options: q.options.map((o) => o.text),
        answers: effective,
        value: q.type === 'text' ? chosen[0] : undefined,
        chosen,
        type: q.type,
        confidence: result.confidence,
        reason: result.reason || '',
        backend: result.backend || cfg.backend,
        model: result.model || '',
        vision: Boolean(result.vision),
        action: this.cfg['automation.dryRun'] ? 'dry-run' : 'answered',
        ms
      };

      this.logger.answer(record);
      this.emit('answer', record);
      this.emitStatus();

      if (
        cfg['automation.stopOnLowConfidence'] &&
        Number(result.confidence) < Number(cfg['automation.minConfidence'])
      ) {
        this.finish(`Остановлено: низкая уверенность модели (${result.confidence})`);
        return;
      }

      const questionChanged = await this.advance(q, cfg);
      if (!questionChanged) return;
      q = questionChanged;
    }
  }

  /** Clicks "next" (unless dry-run / confirm) and waits for the next question. */
  async advance(q, cfg) {
    const manual =
      cfg['automation.dryRun'] || cfg['automation.mode'] === 'confirm' || !cfg['automation.clickNext'];

    if (manual) {
      this.message = 'Ответ выбран, жду перехода к следующему вопросу';
      this.emitStatus();
      return this.waitForNext(q.pageSig, 0);
    }

    const delay = this.nextDelay(cfg);
    this.message = `Пауза ${(delay / 1000).toFixed(1)} с перед «Продолжить»`;
    this.emitStatus();
    await sleep(delay);
    if (!this.running) return null;

    // Some tests advance as soon as an answer is selected/typed. Clicking
    // «Продолжить» again would skip the next question, so check first.
    const current = await this.extract();
    const sameNumber = q.qnum != null && current && current.qnum != null && current.qnum === q.qnum;
    if (Runner.usable(current) && current.pageSig !== q.pageSig && !sameNumber) {
      this.logger.info('Вопрос уже сменился — кнопку «Продолжить» не нажимаю');
      return current;
    }

    const wc = this.getWebContents();
    if (!wc || wc.isDestroyed()) throw new Error('Окно браузера закрыто');

    const clicked = await wc.executeJavaScript(clickNextScript(), true).catch((err) => ({
      ok: false,
      reason: err.message
    }));
    if (!clicked || !clicked.ok) {
      this.finish('Кнопка «Продолжить» не найдена — остановка');
      return null;
    }
    this.logger.info('Нажата кнопка', { text: clicked.text });

    const postWait = Number(cfg['automation.postClickWaitMs']) || 0;
    if (postWait > 0) await sleep(postWait);
    if (!this.running) return null;

    const next = await this.waitForNext(q.pageSig, Number(cfg['automation.questionChangeTimeoutMs']) || 15000);
    if (!next) {
      if (this.running) this.finish('Вопрос не сменился за отведённое время — остановка');
      return null;
    }
    return next;
  }

  nextDelay(cfg) {
    const base = Number(cfg['automation.delayMs']) || 0;
    const jitter = Number(cfg['automation.jitterPct']) || 0;
    const delta = base * (jitter / 100);
    return Math.max(0, Math.round(base + (Math.random() * 2 - 1) * delta));
  }

  async clickAnswers(indexes) {
    const wc = this.getWebContents();
    if (!wc || wc.isDestroyed()) throw new Error('Окно браузера закрыто');
    const dryRun = Boolean(this.cfg && this.cfg['automation.dryRun']);
    for (const index of indexes) {
      const script = dryRun ? highlightOptionScript(index) : clickOptionScript(index);
      const result = await wc.executeJavaScript(script, true);
      if (!result || !result.ok) return result || { ok: false, reason: 'unknown' };
    }
    return { ok: true, dryRun };
  }

  async fillTextAnswer(value) {
    const wc = this.getWebContents();
    if (!wc || wc.isDestroyed()) throw new Error('Окно браузера закрыто');
    const dryRun = Boolean(this.cfg && this.cfg['automation.dryRun']);

    const result = await wc.executeJavaScript(dryRun ? highlightInputScript() : fillTextScript(value), true);
    if (!result || !result.ok) return result || { ok: false, reason: 'unknown' };
    if (dryRun) return { ok: true, dryRun: true, value };

    const actual = String(result.value || '');
    if (actual !== value) {
      this.logger.warn('Поле ввода изменило ответ', { wanted: value, actual });
    }
    return { ok: true, value: actual };
  }

  /** Saves the page HTML into the log folder — helps to add support for a new page layout. */
  async dumpPage(tag = 'page') {
    const wc = this.getWebContents();
    if (!wc || wc.isDestroyed()) return null;
    try {
      const data = await wc.executeJavaScript(pageHtmlScript(), true);
      fs.mkdirSync(this.logger.dir, { recursive: true });
      const file = path.join(this.logger.dir, `${tag}-${Date.now()}.html`);
      const header = `<!-- ${data.url}\n     ${data.title} -->\n`;
      fs.writeFileSync(file, header + String(data.html || ''), 'utf8');
      this.logger.warn('HTML страницы сохранён для диагностики', { file });
      return file;
    } catch (err) {
      this.logger.warn('Не удалось сохранить HTML страницы', { error: err.message });
      return null;
    }
  }

  async extract() {
    const wc = this.getWebContents();
    if (!wc || wc.isDestroyed()) return { ok: false, reason: 'no-webcontents' };
    if (wc.isLoading()) return { ok: false, reason: 'loading' };
    try {
      return await wc.executeJavaScript(EXTRACT_JS, true);
    } catch (err) {
      return { ok: false, reason: 'execute-failed', error: err.message };
    }
  }

  static usable(result) {
    if (!result || !result.ok) return false;
    if (result.type === 'text') return Boolean(result.hasInput);
    return Array.isArray(result.options) && result.options.length >= 2;
  }

  async waitForQuestion() {
    const deadline = Date.now() + 30000;
    let attempts = 0;
    while (Date.now() < deadline && this.running) {
      const result = await this.extract();
      if (Runner.usable(result)) return result;
      attempts += 1;
      if (attempts === 10) {
        this.message = 'Всё ещё ищу вопрос на странице...';
        this.emitStatus();
      }
      await sleep(700);
    }
    return null;
  }

  /** Waits until the question signature changes. timeoutMs = 0 means "until stopped". */
  async waitForNext(prevSig, timeoutMs) {
    const deadline = timeoutMs > 0 ? Date.now() + timeoutMs : 0;
    let noOptions = 0;

    while (this.running) {
      if (deadline && Date.now() > deadline) return null;
      await sleep(400);
      if (!this.running) return null;

      const result = await this.extract();
      if (result && result.ok) {
        noOptions = 0;
        if (result.pageSig !== prevSig) return result;
        continue;
      }

      if (result && result.reason === 'no-options') {
        noOptions += 1;
        if (noOptions >= 3) {
          if (result.resultHint) {
            this.finish('Тест завершён (страница результатов)');
          } else {
            await this.dumpPage('no-question');
            this.finish('На странице больше нет вариантов ответа — остановка');
          }
          return null;
        }
      } else {
        noOptions = 0;
      }
    }
    return null;
  }

  async ask(q) {
    const cfg = this.cfg;
    const needVision = !q.question || q.question.trim().length < 8;
    const visionLimit = Number(cfg['vision.maxPerRun']) || 0;
    const visionAvailable =
      Boolean(cfg['vision.enabled']) &&
      cfg.backend !== 'mock' &&
      (visionLimit === 0 || this.visionUsed < visionLimit);

    if (needVision && visionAvailable) {
      try {
        return await this.askVision(q);
      } catch (err) {
        if (!this.running) throw err;
        this.logger.warn('Vision-фолбэк не сработал, пробую текстовую модель', { error: err.message });
      }
    }

    try {
      return await solver.solveQuiz(cfg, q, { signal: this.abort.signal });
    } catch (err) {
      if (!this.running || err.aborted) throw err;
      if (!visionAvailable) throw err;
      this.logger.warn('Текстовая модель не ответила, пробую vision', { error: err.message });
      return this.askVision(q);
    }
  }

  async askVision(q) {
    this.visionUsed += 1;
    this.message = 'Распознаю вопрос по скриншоту (vision)';
    this.emitStatus();
    const wc = this.getWebContents();
    if (!wc || wc.isDestroyed()) throw new Error('Окно браузера закрыто');

    const capture = async () => {
      const image = await wc.capturePage();
      if (!image || image.isEmpty()) throw new Error('Пустой скриншот страницы');
      const png = image.toPNG();
      if (this.cfg['vision.saveScreenshots']) {
        try {
          const dir = require('path').join(this.logger.dir, 'screens');
          require('fs').mkdirSync(dir, { recursive: true });
          require('fs').writeFileSync(
            require('path').join(dir, `q-${Date.now()}.png`),
            png
          );
        } catch (_) {
          /* screenshots are optional */
        }
      }
      return png.toString('base64');
    };

    const result = await solver.solveWithVision(this.cfg, q, capture, { signal: this.abort.signal });
    this.logger.info('Vision-ответ получен', { answers: result.answers, confidence: result.confidence });
    return result;
  }
}

module.exports = { Runner, sleep };
