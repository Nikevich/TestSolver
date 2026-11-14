// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
// Copyright (C) 2026 Shkilevich Nikita

'use strict';

/**
 * Adapter test without downloading a model:
 * - fake Ollama server checks request shape (JSON schema, options, images) and answer parsing
 * - real opencode CLI is called with a tiny prompt (uses the configured default model)
 *
 *   node scripts/test-adapters.js
 */

const fs = require('fs');
const http = require('http');
const assert = require('assert');

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push([name, true]);
    console.log(`PASS ${name}`);
  } catch (err) {
    results.push([name, false, err.message]);
    console.log(`FAIL ${name} :: ${err.message}`);
  }
}

function startFakeOllama() {
  let lastChat = null;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (req.url === '/api/tags') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ models: [{ name: 'test-model' }, { name: 'vision-test' }] }));
        return;
      }
      if (req.url === '/api/chat') {
        lastChat = JSON.parse(body);
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            message: { role: 'assistant', content: '{"answers":[1],"confidence":0.77,"reason":"тест"}' }
          })
        );
        return;
      }
      res.statusCode = 404;
      res.end('{}');
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, getLastChat: () => lastChat }));
  });
}

async function main() {
  const ollama = require('../src/main/llm/ollama');
  const fake = await startFakeOllama();
  const cfg = {
    'ui.language': 'en',
    'ollama.url': `http://127.0.0.1:${fake.port}`,
    'ollama.model': 'test-model',
    'ollama.visionModel': 'vision-test',
    'ollama.temperature': 0,
    'ollama.numCtx': 2048,
    'ollama.keepAlive': '5m',
    'ollama.timeoutMs': 5000
  };

  const models = await ollama.listModels(cfg);
  check('ollama: listModels', () => assert.deepStrictEqual(models.map((m) => m.name), ['test-model', 'vision-test']));

  const health = await ollama.health(cfg);
  check('ollama: health ok', () => assert.strictEqual(health.ok, true));

  const answer = await ollama.solve(
    cfg,
    'Вопрос?',
    [
      { i: 0, text: 'А' },
      { i: 1, text: 'Б' }
    ],
    'single'
  );
  check('ollama: solve parses JSON answer', () => {
    assert.deepStrictEqual(answer.answers, [1]);
    assert.ok(Math.abs(answer.confidence - 0.77) < 1e-9);
  });

  const request = fake.getLastChat();
  check('ollama: request uses schema and temperature 0', () => {
    assert.ok(request.format && request.format.properties && request.format.properties.answers);
    assert.strictEqual(request.options.temperature, 0);
    assert.strictEqual(request.stream, false);
    assert.strictEqual(request.model, 'test-model');
    assert.ok(request.messages[1].content.includes('0) А'));
  });

  check('ollama: english prompt by default', () => {
    assert.ok(request.messages[0].content.startsWith('You are an expert'), request.messages[0].content);
    assert.ok(request.messages[1].content.startsWith('Question:'), request.messages[1].content);
  });

  const badHealth = await ollama.health({ ...cfg, 'ollama.url': 'http://127.0.0.1:1' });
  check('ollama: health reports failure', () => assert.strictEqual(badHealth.ok, false));

  fake.server.close();

  // --- opencode -------------------------------------------------------
  const opencode = require('../src/main/llm/opencode');
  const binary = await opencode.resolveBinary('opencode');
  check('opencode: binary resolved and executable', () => {
    assert.ok(binary.path, binary.path);
    assert.ok(fs.existsSync(binary.path), binary.path);
    if (process.platform !== 'win32') fs.accessSync(binary.path, fs.constants.X_OK);
  });

  const cliAnswer = await opencode.solve(
    {
      'ui.language': 'en',
      'opencode.bin': 'opencode',
      'opencode.model': '',
      'opencode.timeoutMs': 180000
    },
    'Сколько будет 2+2? Варианты: 0) 3, 1) 4. Верни JSON с индексом правильного варианта.',
    [
      { i: 0, text: '3' },
      { i: 1, text: '4' }
    ],
    'single'
  );
  check('opencode: real CLI returns a valid index', () => {
    assert.ok(Array.isArray(cliAnswer.answers), JSON.stringify(cliAnswer));
    assert.ok(cliAnswer.answers[0] === 0 || cliAnswer.answers[0] === 1, JSON.stringify(cliAnswer));
  });

  const failed = results.filter((r) => !r[1]);
  console.log(`\n${results.length - failed.length}/${results.length} adapter checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error('CRASH', err);
  process.exit(2);
});
