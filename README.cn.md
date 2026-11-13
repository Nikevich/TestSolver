# TestSolver

一个本地应用，用于审查测试材料在其所依据知识上的深度：它让整套测试在本地语言模型中完整跑一遍，并显示哪些题目考查的是对学科的真实理解，哪些题目仅凭模型的通用知识就能答对。

[Русская версия](README.ru.md) | [English](README.md) | **中文**

用户只需要 `TestSolver.exe` 本身，以及安装好的 **Ollama** 或 **opencode**。不需要 Node.js、Python 和额外库——Chromium 和 Node 已经打包在应用里。

---

## 为什么做这个项目

近年来，AI 技术越来越深入地进入日常生活，在年轻人中尤其如此。因此，教育机构越来越需要把测试设计成无法单靠神经网络通过的形式。

同时，高质量的测试无法靠互联网上最前面的几个链接拼凑出来。材料应当建立在对学科的细致分析、讲义材料和真实教学经验之上。如果一道题需要的是某一讲的具体知识，而不是常识，那么基于公开数据训练的模型实际上无法回答——它的训练数据里根本没有这些材料。

靠人工验证这一点成本很高：需要做完几十道题，还要单独区分模型是真的知道答案，还是根据措辞猜出来的。TestSolver 把这一过程自动化：打开测试、读取题目、用本地模型作答，并记录置信度和理由。从日志中可以看出哪些题目对 AI 是“透明的”，需要重写。

简单说，这是给测试出题者用的测量工具，而不是用来替别人通过考试的手段。

### 使用示例

1. 出题者把自己的测试（或其副本）载入内置浏览器。
2. 用本地模型执行一次完整运行。
3. 得到一张表：题目 → 所选答案 → 置信度 → 简要理由。
4. 查看模型在没有讲义材料时仍能自信作答的地方，并重写这些题目：绑定到具体讲义、要求推理、去掉措辞中的提示。
5. 重复运行并对比结果。

---

## 一次运行能看出什么

| 指标 | 含义 |
|---|---|
| 完成题目占比 | 模型在页面解析无错误的情况下处理了多少道题 |
| 置信度（`confidence`） | 模型自身对答案可靠程度的判断；置信度低说明这道题需要知识而不是猜测 |
| 理由（`reason`） | 模型的简要解释：可以看出它是按实质作答，还是靠词语匹配 |
| 解析错误 | 无法从 DOM 读取的题目（vision 回退和页面结构检查的候选） |
| 导出 | JSON/CSV 格式的答案表——用于教学法复盘的基础 |

运行结果不是给学生的评分，而是测试的质量地图：哪些题目考查深度，哪些在神经网络面前失去了意义。

---

## 适用对象

- 编写和修订测试的教师与教学设计师；
- 在线课程和学习平台的作者；
- 检查测试能否正确显示并完成的平台 QA 团队；
- 研究题目对生成模型鲁棒性的研究人员。

---

## 快速开始

1. 启动 `TestSolver.exe`（开发模式下用 `npm start`）。
2. 在顶部地址栏填入测试地址 → **Go**。用户名/密码在同一窗口输入，会话在多次启动之间保留。
3. 在右侧面板检查后端：
   - **Ollama** —— 服务器需已启动且模型已下载：
     ```
     ollama pull qwen2.5:7b-instruct
     ollama pull qwen2.5vl:7b        # 用于 vision 回退
     ```
   - **opencode** —— 必须在 PATH 中（`opencode --version`）。模型从 `opencode models` 列表中选择。
4. 点击 **Start**（或 `Ctrl+Shift+S`）。

当页面上不再有答案选项、达到题目上限或按下 **Stop** 按钮时，运行会自动结束。

---

## 功能

| 功能 | 说明 |
|---|---|
| 内置浏览器 | `WebContentsView`，独立配置 `persist:testsolver` —— 登录状态保留 |
| 两种后端 | Ollama（`/api/chat`，结构化 JSON）与 `opencode run --format json`；在界面中切换 |
| 完整运行 | 选择选项 → 暂停 → “Continue” → 等待下一题 |
| 文本作答 | 带输入框的题目：数字、单词、编号序列（例如 `15432`） |
| 抗刷新 | 运行状态保存在主进程，而不是页面中 |
| Vision 回退 | 截图 → `qwen2.5vl` 提取题目和选项 → 答案与 DOM 匹配 |
| 日志 | `answers.jsonl` + `app.log`、答案表格以及 JSON/CSV 导出 |
| 带默认值的设置 | “Settings”选项卡中的表单、单项/全部重置、`config.json` |

限制：不支持拖放；对于多选（checkbox）题目，模型可能返回多个索引。

如果题目中包含编号列表（“1. …”、“2. …”）和输入框，答案必须是不带分隔符的 `1..N` 排列——格式错误时模型会被再询问一次。

---

## 设置

文件：`%APPDATA%\TestSolver\config.json`（便携模式下位于 exe 旁边）。首次启动时自动创建。任何缺失的键 = 默认值。

| 键 | 默认值 | 说明 |
|---|---|---|
| `backend` | `ollama` | 由谁回答：本地 Ollama、opencode CLI，或不使用模型的 `mock`（用于调试）。 |
| `ollama.url` | `http://127.0.0.1:11434` | 本地 Ollama 服务器地址。 |
| `ollama.model` | `qwen2.5:7b-instruct` | `ollama list` 中的模型名称。 |
| `ollama.visionModel` | `qwen2.5vl:7b` | 用于截图识别的模型（vision 回退）。 |
| `ollama.temperature` | `0` | 生成温度（0–2）；`0` 表示尽可能确定。 |
| `ollama.numCtx` | `4096` | 模型上下文窗口大小。 |
| `ollama.keepAlive` | `30m` | 请求后模型在内存中保留的时长。 |
| `ollama.timeoutMs` | `120000` | 等待模型响应的超时，毫秒。 |
| `opencode.bin` | `opencode` | PATH 中的名称或 `opencode.exe` 的完整路径。 |
| `opencode.model` | `""`（opencode 默认） | `provider/model` 格式的模型；为空表示 opencode 默认模型。 |
| `opencode.timeoutMs` | `180000` | 等待 CLI 响应的超时，毫秒。 |
| `automation.mode` | `auto` | `auto` —— 全自动；`confirm` —— 高亮答案并等待手动点击“Continue”。 |
| `automation.delayMs` | `3000` | 选择答案后到“Continue”之间的暂停，毫秒。 |
| `automation.jitterPct` | `30` | 延迟的随机浮动，%。 |
| `automation.maxQuestions` | `0`（无限制） | 每次运行完成多少题；`0` 表示直到测试结束。 |
| `automation.clickNext` | `true` | 自动点击“Continue”。 |
| `automation.dryRun` | `false` | 只高亮并记录答案，不点击页面。 |
| `automation.questionChangeTimeoutMs` | `15000` | 点击后等待新题出现的时长，毫秒。 |
| `automation.postClickWaitMs` | `1200` | 页面加载后的额外暂停，毫秒。 |
| `automation.maxParseFailures` | `3` | 连续多少次解析错误后停止。 |
| `automation.stopOnLowConfidence` | `false` | 置信度低于阈值时停止。 |
| `automation.minConfidence` | `0.4` | 上一项的置信度阈值（0–1）。 |
| `automation.startUrl` | `""` | 测试起始页，在应用浏览器中打开。 |
| `vision.enabled` | `true` | 题目文本无法读取时启用 vision 回退。 |
| `vision.maxPerRun` | `10` | 每次运行最多 vision 调用次数；`0` 表示无限制。 |
| `vision.saveScreenshots` | `false` | 将截图保存到日志文件夹（可能包含个人数据）。 |
| `logging.dir` | `%APPDATA%\TestSolver\logs` | 日志文件夹；为空表示应用数据文件夹（便携模式下位于 exe 旁）。 |
| `logging.answersJsonl` | `true` | 写入 `answers.jsonl` —— 每题一行。 |
| `logging.rotateMb` | `10` | `app.log` 轮转前的大小，MB。 |
| `logging.level` | `info` | 日志详细程度：`debug`、`info`、`warn`、`error`。 |
| `ui.panelWidth` | `400` | 侧边栏宽度，px；可拖动调整。 |
| `ui.theme` | `system` | 主题：跟随系统、深色或浅色。 |

CLI 参数（不保存，仅对本次启动生效）：

```
TestSolver.exe --backend opencode --model anthropic/claude-sonnet-4
TestSolver.exe --set automation.delayMs=2500 --set automation.dryRun=true
TestSolver.exe --reset ollama.temperature
TestSolver.exe --portable        # config.json 位于 exe 旁
TestSolver.exe --headless        # 不显示窗口（启动检查）
```

---

## 构建 exe

```powershell
npm install
npm run dist                    # NSIS 安装包 + 便携版
npm run dist:portable           # 仅便携版
```

输出在 `dist\`：

| 文件 | 说明 |
|---|---|
| `TestSolver-1.0.0-x64.exe` | NSIS 安装包（推荐）：安装到 `%LOCALAPPDATA%`，创建快捷方式 |
| `TestSolver-1.0.0-portable.exe` | 单文件免安装，启动时解压到 `%TEMP%` |

`npm` 和 Electron 只在构建机上需要。用户拿到的是现成的 exe。

如果 `npm install` 没有下载 Electron 二进制（`allowScripts` 策略）：

```powershell
node node_modules\electron\install.js
```

未签名的 exe 会触发 SmartScreen 警告（“更多信息 → 仍要运行”）。对个人工具而言这很正常；若要分发则需要代码签名证书。

---

## 开发与测试

```powershell
npm start        # 带 DevTools 控制台日志的应用
npm run smoke    # 无头测试：解析器、点击、配置、mock 上的完整流程
npm run test:adapters  # Ollama 适配器（模拟服务器）和真实 opencode CLI
```

冒烟测试使用 `fixtures/test-page.html` —— 一个包含五道题、页面刷新和结果页的测试页面本地副本。它不访问真实站点，也不需要模型（`backend: mock`）。

目录结构：

```
src/
  main/          main.js, automation.js, dom.js, config.js, logger.js, prompts.js, solver.js
  main/llm/      ollama.js, opencode.js
  preload/       preload.js (contextBridge)
  renderer/      index.html, app.js, styles.css
  shared/        schema.js（设置与默认值）, ipc.js
fixtures/        test-page.html
assets/          icon.ico, icon.png（由 `npm run icon` 生成）
scripts/         smoke.js, test-adapters.js, make-icon.js, screenshot.js
```

`npm run screenshot` 在未启动模型的情况下截取界面面板的 PNG（`ui-control.png`、`ui-settings.png`，位于 `%TEMP%`）——方便检查布局。`npm run icon` 重新生成 `assets/icon.ico`（带对勾的蓝色圆角方块），它会进入 exe 和快捷方式。

---

## 故障排查

| 现象 | 处理办法 |
|---|---|
| `Ollama: нет связи`（无连接） | 启动 Ollama（`ollama serve` 或托盘应用），检查 `http://127.0.0.1:11434/api/tags` |
| `Модель «...» не найдена`（模型未找到） | 执行 `ollama pull <模型>`，或在“Manage”选项卡中选择其他模型 |
| `opencode не найден в PATH`（在 PATH 中未找到） | 在 `opencode.bin` 设置中填写 `opencode.exe` 的完整路径 |
| 点击“Start”找不到题目 | 确认测试页面已加载且存在选项（`input[type=radio]`/`checkbox`）或输入框；在“Log”选项卡点击“Page HTML”，查看日志文件夹中保存的文件 |
| 答案被选中但题目没有变化 | 增大 `automation.questionChangeTimeoutMs`；检查按钮名称是否为“Continue/Next” |
| 带输入框的题目没有被填写 | 点击“Page HTML”，确认该字段不是搜索/登录框；必须是可见的 `input`/`textarea` |
| 模型响应很慢 | 换用更小的模型（7B）或减小 `ollama.numCtx` |
| 需要在不点击的情况下检查 | 启用 `automation.dryRun` —— 答案只会被高亮 |

解析出错时，页面会自动保存到日志文件夹，文件名为 `no-question-<timestamp>.html`；“Page HTML”按钮按需执行同样的操作。

隐私：日志和截图（若启用）保留在本地；离开设备的只有发往本地模型的请求。使用 `opencode` 搭配云端模型时，题目文本会发送给模型提供商。

---

## 用途与适用范围

本项目用于审查测试材料在其所依据知识上的深度：它帮助出题者看出哪些题目依赖真实的讲义材料，哪些仅凭模型的通用知识就能回答。

本项目不适用于参加他人的考试、测评，以及任何带有访问控制或监考的测试。只应在用户拥有权利的材料上、并在所在机构的规则范围内使用。

自动化运行测试是否可接受，由测试所有者与教育机构决定。用户有责任遵守所在机构的规定、测试平台的使用条款以及本国法律。

**若项目被用于非预期用途，作者不承担任何责任。**

---

## 许可证

TestSolver 采用双许可证模式：

- **AGPL-3.0-only** —— 自由开源许可证。详见 [`LICENSE`](LICENSE)。
- **商业许可证** —— 用于闭源分发、嵌入专有产品以及托管服务。详见 [`COMMERCIAL.md`](COMMERCIAL.md)。

2026 年 11 月 14 日之前发布的版本仍按 MIT 许可证提供；本版本及之后的所有版本适用上述条款。

如果您分发修改后的版本，必须提供完整的对应源代码，包括构建脚本。`npm run source:archive` 会生成随每次发布附带的源码归档。

TestSolver 的名称和徽标不在代码许可证的覆盖范围内——详见 [`TRADEMARKS.md`](TRADEMARKS.md)。第三方组件列于 [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md)。

外部贡献需要签署 CLA——详见 [`CLA.md`](CLA.md) 和 [`CONTRIBUTING.md`](CONTRIBUTING.md)。
