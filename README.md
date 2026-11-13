# TestSolver

A local application for auditing test materials for the depth of knowledge they are built on: it runs a whole test through a local language model and shows which questions test real understanding of the subject and which can be answered from a model's general knowledge.

[Русская версия](README.ru.md) | **English** | [中文](README.cn.md)

The user only needs `TestSolver.exe` itself plus **Ollama** or **opencode** installed. Node.js, Python, and extra libraries are not required — Chromium and Node are already bundled in the app.

---

## Why this project

AI tools have been entering everyday life more and more actively, especially among young people. As a result, educational institutions increasingly need to design tests that cannot be passed by a neural network alone.

At the same time, a good test cannot be assembled from the first links on the internet. The material should rest on a careful analysis of the subject, lecture materials, and real teaching experience. If a question requires knowledge of a specific lecture rather than general information, a model trained on public data is practically unable to answer it — the necessary material simply is not in its training data.

Verifying that by hand is expensive: you have to go through dozens of questions and separately track where the model actually knows the answer and where it guessed from the wording. TestSolver automates this run: it opens the test, reads the questions, answers with a local model, and records confidence and reasoning. The log shows which questions are "transparent" to AI and need rework.

Put simply, it is a measurement tool for the test author, not a way to pass someone else's exam.

### Example workflow

1. The author loads their own test (or a test copy of it) into the built-in browser.
2. Runs a full pass with a local model.
3. Gets a table: question → selected answer → confidence → brief reasoning.
4. Looks at where the model answers confidently without the lecture material and rewrites those questions: ties them to a specific lecture, requires reasoning, removes hints in the wording.
5. Repeats the run and compares the results.

---

## What a run shows

| Metric | Meaning |
|---|---|
| Share of completed questions | How many questions the model handled without page-parsing errors |
| Confidence (`confidence`) | How reliable the model itself considers the answer; low confidence is a signal that the question requires knowledge rather than a guess |
| Reasoning (`reason`) | The model's brief explanation: you can see whether it answers substantively or by word matching |
| Parsing errors | Questions that could not be read from the DOM (candidates for vision fallback and layout checks) |
| Export | Answer table in JSON/CSV — the basis for a methodological review |

The result of a run is not a student's grade but a quality map of the test: which questions test depth and which lose their point in the face of a neural network.

---

## Who it is for

- teachers and instructional designers who write and revise tests;
- authors of online courses and learning platforms;
- QA teams on learning platforms checking that a test renders and completes correctly;
- researchers studying the robustness of assignments to generative models.

---

## Quick start

1. Launch `TestSolver.exe` (or `npm start` in development mode).
2. Paste the test URL into the bar at the top → **Go**. Username/password are entered in the same window; the session persists between launches.
3. Check the backend in the right-hand panel:
   - **Ollama** — the server must be running and the model downloaded:
     ```
     ollama pull qwen2.5:7b-instruct
     ollama pull qwen2.5vl:7b        # for the vision fallback
     ```
   - **opencode** — must be in PATH (`opencode --version`). The model is selected from the `opencode models` list.
4. Click **Start** (or `Ctrl+Shift+S`).

The run stops on its own when there are no more answer options on the page, when the question limit is reached, or when **Stop** is pressed.

---

## Features

| Feature | Details |
|---|---|
| Built-in browser | `WebContentsView`, a dedicated `persist:testsolver` profile — login persists |
| Two backends | Ollama (`/api/chat`, structured JSON) and `opencode run --format json`; switchable in the UI |
| Full pass | select an option → pause → "Continue" → wait for the next question |
| Text answers | questions with an input field: a number, a word, a sequence of numbers (e.g. `15432`) |
| Reload resilience | run state lives in the main process, not in the page |
| Vision fallback | screenshot → `qwen2.5vl` extracts the question and options → the answer is matched against the DOM |
| Log | `answers.jsonl` + `app.log`, an answer table, and JSON/CSV export |
| Settings with defaults | form on the "Settings" tab, per-field/all reset, `config.json` |

Limitations: drag-and-drop is not supported; for checkbox questions the model may return several indexes.

If a question contains a numbered list ("1. …", "2. …") and an input field, the answer must be a permutation of `1..N` without separators — if the format is wrong, the model is asked once more.

---

## Settings

File: `%APPDATA%\TestSolver\config.json` (in portable mode, next to the exe). Created automatically on first launch. Any missing key = default value.

| Key | Default | Description |
|---|---|---|
| `backend` | `ollama` | Who answers the questions: local Ollama, the opencode CLI, or `mock` without a model (for debugging). |
| `ollama.url` | `http://127.0.0.1:11434` | Address of the local Ollama server. |
| `ollama.model` | `qwen2.5:7b-instruct` | Model name from `ollama list`. |
| `ollama.visionModel` | `qwen2.5vl:7b` | Model used for screenshot recognition (vision fallback). |
| `ollama.temperature` | `0` | Generation temperature (0–2); `0` is as deterministic as possible. |
| `ollama.numCtx` | `4096` | Model context window size. |
| `ollama.keepAlive` | `30m` | How long to keep the model in memory after a request. |
| `ollama.timeoutMs` | `120000` | Timeout for the model response, ms. |
| `opencode.bin` | `opencode` | Name in PATH or full path to `opencode.exe`. |
| `opencode.model` | `""` (opencode default) | Model in `provider/model` format; empty means the opencode default model. |
| `opencode.timeoutMs` | `180000` | Timeout for the CLI response, ms. |
| `automation.mode` | `auto` | `auto` — everything automatically; `confirm` — highlight the answer and wait for a manual "Continue". |
| `automation.delayMs` | `3000` | Pause after selecting an answer before "Continue", ms. |
| `automation.jitterPct` | `30` | Random delay spread, %. |
| `automation.maxQuestions` | `0` (no limit) | How many questions to complete per run; `0` means until the end of the test. |
| `automation.clickNext` | `true` | Click "Continue" automatically. |
| `automation.dryRun` | `false` | Only highlight and log answers without clicking on the page. |
| `automation.questionChangeTimeoutMs` | `15000` | How long to wait for a new question after a click, ms. |
| `automation.postClickWaitMs` | `1200` | Extra pause after the page loads, ms. |
| `automation.maxParseFailures` | `3` | How many consecutive parsing errors to tolerate before stopping. |
| `automation.stopOnLowConfidence` | `false` | Stop if the model's confidence is below the threshold. |
| `automation.minConfidence` | `0.4` | Confidence threshold for the previous option (0–1). |
| `automation.startUrl` | `""` | Start page of the test, opened in the app's browser. |
| `vision.enabled` | `true` | Enable the vision fallback when the question text could not be read. |
| `vision.maxPerRun` | `10` | Maximum number of vision calls per run; `0` means no limit. |
| `vision.saveScreenshots` | `false` | Save screenshots to the logs folder (they may contain personal data). |
| `logging.dir` | `%APPDATA%\TestSolver\logs` | Logs folder; empty means the app data folder (in portable mode, next to the exe). |
| `logging.answersJsonl` | `true` | Write `answers.jsonl` — one line per question. |
| `logging.rotateMb` | `10` | `app.log` size before rotation, MB. |
| `logging.level` | `info` | Log verbosity: `debug`, `info`, `warn`, `error`. |
| `ui.panelWidth` | `400` | Side panel width, px; adjustable by dragging. |
| `ui.theme` | `system` | Theme: same as the system, dark, or light. |

CLI flags (not persisted, apply to the current launch):

```
TestSolver.exe --backend opencode --model anthropic/claude-sonnet-4
TestSolver.exe --set automation.delayMs=2500 --set automation.dryRun=true
TestSolver.exe --reset ollama.temperature
TestSolver.exe --portable        # config.json next to the exe
TestSolver.exe --headless        # no window (startup check)
```

---

## Building the exe

```powershell
npm install
npm run dist                    # NSIS installer + portable
npm run dist:portable           # portable only
```

Output in `dist\`:

| File | What it is |
|---|---|
| `TestSolver-1.0.0-x64.exe` | NSIS installer (recommended): installs to `%LOCALAPPDATA%`, creates shortcuts |
| `TestSolver-1.0.0-portable.exe` | single file, no installation, unpacks to `%TEMP%` on launch |

`npm` and Electron are only needed on the build machine. The user receives a ready-made exe.

If `npm install` did not download the Electron binary (the `allowScripts` policy):

```powershell
node node_modules\electron\install.js
```

An unsigned exe triggers a SmartScreen warning ("More info → Run anyway"). That is fine for a personal tool; distribution requires a code-signing certificate.

---

## Development and testing

```powershell
npm start        # app with DevTools logs in the console
npm run smoke    # headless tests: parser, clicks, config, full cycle on mock
npm run test:adapters  # Ollama adapters (fake server) and the real opencode CLI
```

The smoke test uses `fixtures/test-page.html` — a local copy of a test page with five questions, page reloads, and a results page. It does not contact the real site and does not require a model (`backend: mock`).

Structure:

```
src/
  main/          main.js, automation.js, dom.js, config.js, logger.js, prompts.js, solver.js
  main/llm/      ollama.js, opencode.js
  preload/       preload.js (contextBridge)
  renderer/      index.html, app.js, styles.css
  shared/        schema.js (settings and defaults), ipc.js
fixtures/        test-page.html
assets/          icon.ico, icon.png (generated by `npm run icon`)
scripts/         smoke.js, test-adapters.js, make-icon.js, screenshot.js
```

`npm run screenshot` captures PNGs of the UI panel (`ui-control.png`, `ui-settings.png` in `%TEMP%`) without starting a model — handy for checking the layout. `npm run icon` regenerates `assets/icon.ico` (a blue rounded square with a checkmark), which ends up in the exe and shortcuts.

---

## Troubleshooting

| Symptom | What to do |
|---|---|
| `Ollama: no connection` | Start Ollama (`ollama serve` or the tray app) and check `http://127.0.0.1:11434/api/tags` |
| `Model "..." not found` | `ollama pull <model>` or pick another one on the "Manage" tab |
| `opencode not found in PATH` | Set the full path to `opencode.exe` in the `opencode.bin` setting |
| "Start" does not find a question | Make sure the test page has loaded and has options (`input[type=radio]`/`checkbox`) or an input field; click "Page HTML" on the "Log" tab and inspect the saved file in the logs folder |
| An answer is selected but the question does not change | Increase `automation.questionChangeTimeoutMs`; check that the button is labelled "Continue/Next" |
| A question with an input field is not filled | Click "Page HTML" and check that the field is not a search/login field; it must be a visible `input`/`textarea` |
| The model responds slowly | Use a smaller model (7B) or reduce `ollama.numCtx` |
| Need to check without clicking | Enable `automation.dryRun` — answers are only highlighted |

On a parsing error the page is automatically saved to the logs folder as `no-question-<timestamp>.html`; the "Page HTML" button does the same on demand.

Privacy: logs and screenshots (if enabled) stay local; only requests to the local model leave the machine. When using `opencode` with a cloud model, the question text is sent to the model provider.

---

## Purpose and scope

The project is intended for auditing test materials for the depth of the knowledge they are built on: it helps an author see which questions rely on actual lecture material and which can be answered from a model's general knowledge.

The project is not intended for taking other people's exams, assessments, or any tests with access control or proctoring. It should only be used on materials the user owns and within the rules of their organization.

Whether an automated test run is acceptable is decided by the test owner and the educational institution. Users are responsible for complying with their institution's rules, the test platform's terms of use, and the laws of their country.

**The author accepts no liability if the project is used for purposes other than those intended.**

---

## License

TestSolver is dual-licensed:

- **AGPL-3.0-only** — free and open source. See [`LICENSE`](LICENSE).
- **Commercial license** — for closed-source distribution, embedding, and hosted services. See [`COMMERCIAL.md`](COMMERCIAL.md).

Releases published before 14 November 2026 remain available under the MIT license; this and all subsequent releases are covered by the terms above.

If you distribute a modified version, you must provide the complete corresponding source, including the build scripts. `npm run source:archive` creates the source archive that is attached to each release.

The TestSolver name and logo are not covered by the code license — see [`TRADEMARKS.md`](TRADEMARKS.md). Third-party components are listed in [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

Contributions require a signed CLA — see [`CLA.md`](CLA.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md).
