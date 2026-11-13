# TestSolver — User Guide

TestSolver opens a quiz page in a built-in browser, reads the question and answer options, asks a local model (Ollama or `opencode`), selects the answer and clicks «Продолжить» (Continue). It handles single- and multiple-choice questions as well as text-input questions — a number, a word, or a sequence of item numbers.

**Русская версия:** [USAGE.ru.md](USAGE.ru.md) · **Project overview:** [../README.md](../README.md)

---

## Quick start

1. Run `TestSolver.exe`.
2. Paste the test URL into the address bar at the top → **Перейти** (Go) and sign in.
3. In the right-hand panel choose the backend and model, then click **Проверить связь с моделью** (Test model connection).
4. Click **Старт** (Start) or press `Ctrl` + `Shift` + `S`.
5. Watch the progress; use **Стоп** (Stop) if needed.

---

## 1. Requirements

| Requirement | Details |
|---|---|
| Operating system | Windows 10 or 11, 64-bit |
| Model | Installed **Ollama** with the required models **or** the **opencode** CLI |
| Internet | For the quiz page; for opencode cloud models — access to the provider |
| Node.js, Python, npm | **Not required** — Chromium and Node are bundled |

Ollama with a local model works fully offline. A cloud model through opencode needs internet access and an authenticated opencode CLI.

---

## 2. Installation

### Option A. Installer (recommended)

1. Run `TestSolver-<version>-x64.exe`.
2. If SmartScreen appears ("Windows protected your PC"), click **More info** → **Run anyway**. This is expected for an unsigned exe.
3. Choose the installation folder and wait for completion. Start-menu and desktop shortcuts are created.
4. Launch the app from the shortcut.

Data locations:

| Item | Location |
|---|---|
| Settings | `%APPDATA%\TestSolver\config.json` |
| Logs | `%APPDATA%\TestSolver\logs\` |
| Site session (logins) | `%APPDATA%\TestSolver\Partitions\testsolver\` |

To uninstall, use Settings → Apps → TestSolver. Settings and logs are kept; delete `%APPDATA%\TestSolver` manually if you want a clean removal.

### Option B. Portable

- A single `TestSolver-<version>-portable.exe`, no installation required.
- It unpacks into a temporary folder on every launch, so it starts slower than the installed version (usually 10–40 seconds).
- `config.json` and the `logs` folder are created **next to the exe** — convenient for a USB stick.
- Do not run two copies at once and do not move the exe while the app is running.

---

## 3. First launch

The window has three areas.

**Top navigation bar:**

| Element | Purpose |
|---|---|
| ← / → / ↻ | Back, forward, reload |
| Address bar | Quiz page URL |
| **Перейти** (Go) | Open the entered address |
| **Открыть тест** (Open test) | Open the saved start URL |
| ↗ | Open the current page in the system browser |

**Left — the quiz site.** Login and password are entered right in this window; the session persists between launches, so you usually sign in only once.

**Right — the panel with tabs:**

| Tab | Contents |
|---|---|
| **Управление** (Control) | Backend, model, delay, question limit, Start / Stop, progress |
| **Настройки** (Settings) | All app settings, reset to defaults, logs folder |
| **Лог** (Log) | Live log and the «HTML страницы» (Page HTML) diagnostic button |
| **Ответы** (Answers) | Table of submitted answers and export |

**Bottom — status bar:** Ollama and opencode health, `N / total` progress, average model response time and the current status message.

---

## 4. Connecting a model

Switch the backend in the **Бэкенд** (Backend) field on the **Управление** tab.

### Ollama (local)

1. Install Ollama from [ollama.com](https://ollama.com) and start it. The server listens on `http://127.0.0.1:11434`.
2. Download the models in a terminal:

   ```powershell
   ollama pull qwen2.5:7b-instruct
   ollama pull qwen2.5vl:7b        # required for the vision fallback
   ```

3. In the app: **Бэкенд** = `Ollama (локально)` → click **обновить** (refresh) next to the model → pick a model from the list.
4. Click **Проверить связь с моделью** (Test model connection) — the model should reply.
5. For the vision fallback (recognizing a question from a screenshot), keep **Vision-фолбэк** enabled and set the vision model in settings (`ollama.visionModel`).

A hint under the model list tells you when the selected model is missing from Ollama and must be pulled or replaced.

### opencode (CLI)

1. Install and authenticate opencode as described in its documentation. Check with `opencode --version`.
2. In the app open **Настройки** → `opencode.bin`: keep `opencode` if the CLI is in PATH, or specify the full path to `opencode.exe`.
3. **Бэкенд** = `opencode CLI` → **обновить** → choose a model from `opencode models`.
   The model is written as `provider/model`, for example `opencode/deepseek-v4.1-flash-free`. An empty value means the opencode default model.
4. Click **Проверить связь с моделью**.

> With a cloud model through opencode, question text is sent to the model provider.

### mock (debugging)

The `mock` backend needs no model: it picks a random option for choice questions and enters `12345` for sequences. Useful for checking the UI and page navigation.

---

## 5. Running a test

1. Paste the test URL into the address bar and click **Перейти** (Go).
2. Sign in and wait for the first question to load.
3. On the **Управление** tab, check the backend and model.
4. Optionally set the **Задержка** (Delay, pause before «Продолжить», 3000 ms by default) and **Лимит вопросов** (Question limit, `0` = unlimited).
5. Click **Старт** (Start) or press `Ctrl` + `Shift` + `S`.

During a run the panel shows how many questions were answered, the current question, the last answer, model confidence and average response time. **Стоп** (Stop), or the same shortcut, ends the run.

The run stops automatically when:

- the test is over (results page);
- the page has neither answer options nor a text input;
- the question limit is reached;
- too many parsing errors occur in a row (`automation.maxParseFailures`);
- `automation.stopOnLowConfidence` is enabled and model confidence is below the threshold;
- the «Продолжить» button is not found or the question does not change within the timeout.

> Tip: for a first try set **Лимит вопросов** to `1`–`3` to confirm the app understands the page correctly.

---

## 6. Question types

| Type | What it looks like | What the app does |
|---|---|---|
| Single choice | Radio buttons | Clicks the one option returned by the model |
| Multiple choice | Checkboxes | Clicks every option returned by the model |
| Text answer | An input field asking for a number, word or phrase | Types the answer into the field |
| Sequence | Numbered items plus a «Ваш ответ:» (Your answer) field | Types the item numbers in the correct order |

**Sequences.** When a question has a numbered list and a text field, the answer is a permutation of `1..N` without spaces or separators. For example, the correct order "2, 5, 4, 1, 3" for five items is entered as `25413`. The model receives the format requirement from the page; if it returns an invalid format, the app asks once more.

**Highlighting.** Before clicking, the selected option or input is highlighted in green. In **Dry run** mode the highlight is blue and nothing is clicked, so you can verify that the app sees the question and then advance manually.

**Limitations.** Drag-and-drop, captchas and custom widgets (hand-written dropdowns, virtual keyboards) are not supported.

---

## 7. Settings

All parameters are edited on the **Настройки** (Settings) tab and saved to `config.json` immediately:

- installer: `%APPDATA%\TestSolver\config.json`;
- portable: `config.json` next to the exe.

Any missing key falls back to its default. **Сбросить всё к умолчаниям** (Reset all to defaults) restores the original values.

| Key | Default | Description |
|---|---|---|
| `backend` | `ollama` | Who answers: Ollama, opencode or `mock` without a model |
| `ollama.url` | `http://127.0.0.1:11434` | Ollama server address |
| `ollama.model` | `qwen2.5:7b-instruct` | Model name from `ollama list` |
| `ollama.visionModel` | `qwen2.5vl:7b` | Model used to recognize screenshots |
| `ollama.temperature` | `0` | Generation temperature, 0–2; `0` is deterministic |
| `ollama.numCtx` | `4096` | Context window size |
| `ollama.keepAlive` | `30m` | How long to keep the model in memory |
| `ollama.timeoutMs` | `120000` | Model response timeout, ms |
| `opencode.bin` | `opencode` | Name in PATH or full path to `opencode.exe` |
| `opencode.model` | `""` | `provider/model`; empty means the opencode default |
| `opencode.timeoutMs` | `180000` | CLI response timeout, ms |
| `automation.mode` | `auto` | `auto` = fully automatic; `confirm` = highlight and wait for a manual click |
| `automation.delayMs` | `3000` | Pause after answering before «Продолжить», ms |
| `automation.jitterPct` | `30` | Random delay variation, % |
| `automation.maxQuestions` | `0` | How many questions to answer; `0` = until the end |
| `automation.clickNext` | `true` | Click «Продолжить» automatically |
| `automation.dryRun` | `false` | Only highlight and log, do not click |
| `automation.questionChangeTimeoutMs` | `15000` | Wait for the next question after a click, ms |
| `automation.postClickWaitMs` | `1200` | Extra wait after page load, ms |
| `automation.maxParseFailures` | `3` | Parse errors in a row allowed before stopping |
| `automation.stopOnLowConfidence` | `false` | Stop when model confidence is low |
| `automation.minConfidence` | `0.4` | Confidence threshold for the option above, 0–1 |
| `automation.startUrl` | `""` | Start page used by «Открыть тест» |
| `vision.enabled` | `true` | Enable the vision fallback when question text cannot be read |
| `vision.maxPerRun` | `10` | Maximum vision calls per run; `0` = unlimited |
| `vision.saveScreenshots` | `false` | Save screenshots to the logs folder |
| `logging.dir` | `%APPDATA%\TestSolver\logs` | Logs folder; empty = the app data folder |
| `logging.answersJsonl` | `true` | Write `answers.jsonl`, one line per question |
| `logging.rotateMb` | `10` | `app.log` size before rotation, MB |
| `logging.level` | `info` | Log verbosity: `debug`, `info`, `warn`, `error` |
| `ui.language` | `en` | Interface language: `en` or `ru`; also run statuses and model prompts |
| `ui.panelWidth` | `400` | Right panel width, px; also changed by dragging |
| `ui.theme` | `system` | Theme: system, dark or light |

### Practical tips

- **Delay 2000–5000 ms** with 20–40 % jitter looks more natural and gives the page time to render.
- **Slow site:** raise `automation.questionChangeTimeoutMs` to 30000–60000.
- **Trial run:** set `automation.maxQuestions` to 1–3, then remove the limit.
- **Check without clicking:** enable `automation.dryRun`.
- **Manual confirmation:** set `automation.mode` to `confirm` — the app highlights the answer and waits until you click «Продолжить» yourself.
- **Weak computer:** use a 7B model and lower `ollama.numCtx` to 2048–4096.
- **Fewer vision calls:** `vision.maxPerRun` caps the number of screenshots per run.
- **Privacy:** `vision.saveScreenshots` is off by default because screenshots may contain personal data.

Automation settings apply to the next run; the current run uses the values captured when you clicked **Старт**.

### Command-line flags (advanced)

Flags are not saved to `config.json` and only affect the current launch:

```powershell
TestSolver.exe --backend opencode --model anthropic/claude-sonnet-4
TestSolver.exe --delay 2500
TestSolver.exe --set automation.dryRun=true --set automation.maxQuestions=2
TestSolver.exe --reset ollama.temperature
TestSolver.exe --portable        # config.json next to the exe
TestSolver.exe --headless        # no window (launch check)
```

---

## 8. Answers and logs

### «Ответы» (Answers) tab

The table shows the last 300 records: question number, question text, the chosen answer (the entered value for text questions), model confidence as a percentage, and response time in milliseconds.

**Экспорт** (Export) saves the journal as JSON or CSV (`;` separator, UTF-8). All records loaded in the current session are exported.

### Files in the logs folder

| File | Contents |
|---|---|
| `app.log` | App events: startup, button clicks, errors, saved HTML |
| `app.log.1` … `app.log.3` | Previous logs kept after rotation |
| `answers.jsonl` | One JSON per question: text, answer, confidence, model, time |
| `no-question-*.html` | HTML of a page where the question could not be parsed |
| `lost-question-*.html` | HTML of a page where the question disappeared mid-run |
| `page-*.html` | HTML saved manually with «HTML страницы» |

The **Папка логов** (Logs folder) button opens this folder in Explorer.

**Page diagnostics.** If a question is not recognized, open **Лог** (Log) → **HTML страницы** (Page HTML): the file is saved to the logs folder. The same file is saved automatically on a parse failure. It shows how the page is built and helps add support for a new layout.

---

## 9. Troubleshooting

| Symptom | What to do |
|---|---|
| `Ollama: нет связи` (no connection) | Start Ollama (`ollama serve` or the tray app) and check `http://127.0.0.1:11434/api/tags` |
| `Модель «...» не найдена` (model not found) | Run `ollama pull <model>` or choose another model |
| `opencode не найден в PATH` | Set the full path to `opencode.exe` in `opencode.bin` |
| `Не удалось найти ни вариантов ответа, ни поля ввода на странице` (no options or input found) | Wait for the page to finish loading; make sure the test itself is open, not the test list; save the page HTML |
| `На странице больше нет вариантов ответа — остановка` (no more options) | The test may be finished or the question type changed; check `no-question-*.html` |
| `Вопрос не сменился за отведённое время — остановка` (question did not change) | Increase `automation.questionChangeTimeoutMs`; check the button label («Продолжить/Далее/Следующий») |
| `Кнопка «Продолжить» не найдена — остановка` (button not found) | The button has a different label or is hidden; save the page HTML |
| The text field is not filled | It must be a visible `input` or `textarea` and not a search/login field; check the saved HTML |
| The answer is selected but the question does not change | Enable `automation.dryRun` and check manually; increase the delay |
| `Много ошибок подряд` (too many errors) | The model returns an invalid format; change the model or raise `automation.maxParseFailures` |
| Stopped with "low model confidence" | Disable `automation.stopOnLowConfidence` or lower `automation.minConfidence` |
| The model is very slow | Use a 7B model instead of a large one, lower `ollama.numCtx`, close other apps |
| SmartScreen blocks the exe | **More info** → **Run anyway**; distribution requires a code-signing certificate |
| Portable starts slowly | It unpacks to a temp folder; antivirus may slow the first launch |
| Answers are wrong | The model may be too weak for the subject: try a larger local model or a cloud model via opencode; inspect `answers.jsonl` |

If nothing helps, attach `app.log` and the saved page HTML — they show where the run stopped.

---

## 10. Privacy and limitations

- Everything runs locally: questions, answers and logs stay on your computer.
- Ollama does not send data anywhere. With **opencode** and a cloud model, question text is sent to the model provider.
- Screenshots (if enabled) and page HTML may contain personal data — store the logs folder accordingly.
- Drag-and-drop and custom widgets are not supported.
- Automating tests may violate your institution's rules. You are responsible for how you use this tool.