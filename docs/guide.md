# Ark 框架使用指南

> 本指南是完整的 Ark 使用参考，涵盖从零上手到所有高级特性。读完后你将能够：运行已有的组合 CLI、编写 Leaf CLI、用 YAML 配置各种流水线拓扑、包装第三方 CLI，以及用 AI Composer 自动生成 Wiring Plan。

---

## 目录

- [第一章：Ark 是什么](#第一章ark-是什么)
- [第二章：安装与第一次运行](#第二章安装与第一次运行)
- [第三章：核心概念](#第三章核心概念)
- [第四章：编写 Leaf CLI](#第四章编写-leaf-cli)
- [第五章：Wiring Plan 详解](#第五章wiring-plan-详解)
  - [5.1 顺序执行（sequential）](#51-顺序执行sequential)
  - [5.2 DAG 并行执行（dag）](#52-dag-并行执行dag)
  - [5.3 条件分支（if/else + branch）](#53-条件分支ifelse--branch)
  - [5.4 批量并发处理（parallel-map）](#54-批量并发处理parallel-map)
  - [5.5 持续监听（streaming）](#55-持续监听streaming)
- [第六章：模板表达式](#第六章模板表达式)
- [第七章：内置步骤](#第七章内置步骤)
- [第八章：Composed CLI 与多命令](#第八章composed-cli-与多命令)
- [第九章：包装第三方 CLI（ark wrap）](#第九章包装第三方-cli-ark-wrap)
- [第十章：执行模式（manual / auto / dry-run）](#第十章执行模式manual--auto--dry-run)
- [第十一章：错误处理、重试与超时](#第十一章错误处理重试与超时)
- [第十二章：AI Composer](#第十二章ai-composer)
- [附录：YAML 字段速查表](#附录yaml-字段速查表)

---

## 第一章：Ark 是什么

### 1.1 痛点

假设你想做这样一件事：

> 每天早上自动获取北京的天气，然后让 AI 写一段天气播报，最后把它发到小红书。

这涉及三个工具：

1. **天气工具**：请求 wttr.in，返回结构化天气数据
2. **AI 报告工具**：把天气数据喂给 Claude，生成一段文字
3. **发帖工具**：用浏览器自动化，把文字发出去

如果你自己把它们串起来，你需要写"胶水代码"：调第一个工具，拿到结果，传给第二个工具，再拿到结果，传给第三个……很快代码就乱了，工具和流程耦合死，修改和复用都很难。

### 1.2 Ark 的方案

Ark 的核心思想：**把每个工具做成标准化的 Leaf CLI，用 YAML 文件（Wiring Plan）声明它们如何连接**，框架负责数据传递和执行调度。

```
[天气工具] ──┐
              ├── ark-wiring.yaml ──→ ark run → 自动执行全流程
[AI工具]  ──┘
```

好处：
- 每个工具独立开发、独立测试
- 连接逻辑写在 YAML 里，一目了然
- 支持顺序/并行/条件分支/人工审核/AI 自动决策
- 工具可以被任意组合复用

---

## 第二章：安装与第一次运行

### 2.1 安装

```bash
# 克隆仓库后
pnpm install
pnpm build
```

**环境要求：** Node >= 20.0.0，pnpm >= 9.0.0。

### 2.2 查看有哪些工具

```bash
ark list
```

输出：

```
Ark CLIs
──────────────────────────────────────────────────────────────
[leaf]     @ark/cli-weather              Weather CLI
           Fetches current weather data for a given city from wttr.in

[leaf]     @ark/cli-report               Weather Report CLI
           Receives structured weather data and uses AI to generate a report

[leaf]     @ark/cli-content              Content Generator CLI
           Generates platform-native social media content using AI

[leaf]     @ark/cli-xhs                  Xiaohongshu Publisher CLI
           Publishes content to Xiaohongshu via browser automation

[composed] @ark/cli-weather-report       Weather Daily Report
           Fetches weather and generates a daily report using AI

[composed] @ark/cli-social-publisher     Social Publisher
           Generates and publishes social media content to XHS or Twitter/X
```

- `[leaf]`：原子工具，只做一件事
- `[composed]`：多个工具串联的流水线

### 2.3 查看工具详情

```bash
ark describe @ark/cli-weather-report
```

```
──────────────────────────────────────────────────────────────
Weather Daily Report (@ark/cli-weather-report v0.1.0)
──────────────────────────────────────────────────────────────
DESCRIPTION
  Composed CLI that fetches current weather for a city and generates
  a human-readable daily report in Chinese using AI.

MODES      auto, manual
LINEAGE    composed
PARENTS
  @ark/cli-weather @ 0.1.0
  @ark/cli-report @ 0.1.0
```

### 2.4 运行示例（手动模式）

```bash
export ANTHROPIC_API_KEY=sk-ant-...
ark run @ark/cli-weather-report --city Shanghai
```

框架会：

1. 调用 `@ark/cli-weather`，获取上海天气数据
2. 暂停，展示数据请你确认：
   ```
   [Human Review] Please review the following payload:
   { "city": "Shanghai", "tempC": 18, "description": "Partly cloudy", ... }
   [y]es / [e]dit (as JSON) / [n]o cancel
   ```
3. 你输入 `y` 后，调用 `@ark/cli-report`，AI 生成报告
4. 输出报告并保存到 `./reports/`

### 2.5 自动模式

```bash
ark run @ark/cli-weather-report --auto
```

不暂停，AI 自动选城市和风格，全程跑完。

### 2.6 查看工具家谱

```bash
ark lineage @ark/cli-weather-report
```

```
◆ @ark/cli-weather-report v0.1.0 [composed]
  ◇ @ark/cli-weather v0.1.0 [leaf]
  ◇ @ark/cli-report v0.1.0 [leaf]
```

---

## 第三章：核心概念

### 3.1 Leaf CLI：原子工具

Leaf CLI 是最小单元，只做一件事。它遵循一个 I/O 协议：

- **输入**：从环境变量 `ARK_INPUT_PAYLOAD` 读取 JSON
- **输出**：向 stdout 写 `ARK_OUTPUT:<json>` 格式的行

这样框架能在步骤之间传递结构化数据，而不依赖 stdout 文本解析。

每个 Leaf CLI 有一个 `ark-descriptor.yaml` 声明自己的"接口"。

### 3.2 Composed CLI：组合工具

Composed CLI 是多个 Leaf CLI 串联的结果，由两个文件定义：

- `ark-descriptor.yaml`：声明它是谁（`lineage.kind: composed`），父工具是谁
- `ark-wiring.yaml`（或 `wirings/*.yaml`）：定义执行流程

### 3.3 Wiring Plan：接线图

`ark-wiring.yaml` 是流水线蓝图。核心是 `steps` 列表，每步说明：

- 调用哪个工具（`uses`）
- 输入从哪来（`inputs`，用模板表达式引用上下文）
- 输出存到哪（`outputs.bind`，绑定到上下文变量）

### 3.4 Pipeline Context：流水线状态

框架运行时维护一个全局上下文（ctx），所有步骤都能读写它：

```
ctx.mode            → 当前模式：'manual' 或 'auto'
ctx.flags.*         → 命令行参数，如 ctx.flags.city = 'Shanghai'
ctx.bindings.*      → 步骤间传递的数据，如 ctx.bindings.weatherData
ctx.dryRun          → 是否预览模式（true/false）
ctx.meta.runId      → 本次运行的唯一 ID
```

YAML 里用 `{{ ctx.xxx }}` 引用，框架执行时自动替换。

---

## 第四章：编写 Leaf CLI

### 4.1 目录结构

```
packages/cli-translate/
├── src/
│   └── index.ts          ← 唯一入口
├── ark-descriptor.yaml   ← 接口声明
├── package.json
└── tsconfig.json
```

### 4.2 入口文件（src/index.ts）

以一个调用 DeepL API 的翻译工具为例：

```typescript
#!/usr/bin/env node
import { readInputPayload, writeOutput } from '@ark/core'

interface TranslateInput {
  text?: string
  targetLang?: string
}

// 1. 尝试从管道读取输入（被 ark 调用时从这里获取）
const payload = readInputPayload<TranslateInput>()

// 2. 如果没有管道输入，从命令行参数读取（直接运行时）
const args = process.argv.slice(2)
function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag)
  return idx !== -1 ? args[idx + 1] : undefined
}

const text = payload?.text ?? getFlag('--text') ?? 'Hello'
const targetLang = payload?.targetLang ?? getFlag('--target-lang') ?? 'ZH'

// 3. 鉴权检查
const apiKey = process.env['DEEPL_API_KEY']
if (!apiKey) {
  process.stderr.write('[ark:translate] Error: DEEPL_API_KEY env var is required\n')
  process.exit(1)
}

// 4. 调用 DeepL API
const response = await fetch('https://api-free.deepl.com/v2/translate', {
  method: 'POST',
  headers: {
    'Authorization': `DeepL-Auth-Key ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ text: [text], target_lang: targetLang }),
})

if (!response.ok) {
  process.stderr.write(`[ark:translate] DeepL API error: ${response.status}\n`)
  process.exit(1)
}

const data = await response.json() as { translations: Array<{ text: string }> }

// 5. 输出结果（框架解析 ARK_OUTPUT: 行，存入 ctx.bindings）
writeOutput({
  original: text,
  translated: data.translations[0]?.text ?? '',
  targetLang,
})
process.exit(0)
```

**关键 API：**

| 函数 | 作用 |
|------|------|
| `readInputPayload<T>()` | 读 `ARK_INPUT_PAYLOAD` 环境变量，返回 `T \| undefined` |
| `writeOutput(obj)` | 向 stdout 写 `ARK_OUTPUT:{...}`，框架提取此行作为步骤输出 |

### 4.3 ark-descriptor.yaml

```yaml
apiVersion: ark/v1
kind: CliDescriptor

functional:
  id: "@my-org/cli-translate"
  version: "0.1.0"
  displayName: "Translate CLI"
  description: |
    Translates text using the DeepL API.
    Supports pipeline input (ARK_INPUT_PAYLOAD) and direct CLI usage.
  entrypoint: "dist/index.js"
  modes: [manual, auto]

  inputs:
    - id: text
      type: string
      required: true
      description: "Text to translate."
    - id: targetLang
      type: string
      required: false
      description: "Target language code (e.g. ZH, EN, JA). Defaults to ZH."

  outputs:
    - id: original
      type: string
      description: "Original input text."
    - id: translated
      type: string
      description: "Translated text."
    - id: targetLang
      type: string
      description: "Target language code used."

  commands:
    - name: translate
      description: "Translate text using DeepL."
      options:
        - flag: "--text"
          type: string
          required: true
          description: "Text to translate."
        - flag: "--target-lang"
          type: string
          required: false
          description: "Target language code. Default: ZH."

  env:
    - name: DEEPL_API_KEY
      required: true
      description: "DeepL API authentication key."

lineage:
  kind: leaf
  createdAt: "2026-03-29T00:00:00+00:00"
```

### 4.4 package.json 和 tsconfig.json

```json
{
  "name": "@my-org/cli-translate",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@ark/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

### 4.5 构建与直接运行

```bash
pnpm --filter @my-org/cli-translate build

# 直接运行（不走管道）
DEEPL_API_KEY=xxx node dist/index.js translate --text "Hello, world" --target-lang ZH
```

---

## 第五章：Wiring Plan 详解

Wiring Plan 是 ark 流水线的核心配置，支持五种执行模式，分别适用于不同场景。

### 5.1 顺序执行（sequential）

**适用场景：** 步骤之间有明确的先后顺序，每步依赖上一步的输出；或者需要条件分支、`builtin/branch` 跳转。

**例子：天气播报流水线**

场景：获取天气 → （manual 模式下人工审核）→ AI 生成报告 → 日志输出

```yaml
apiVersion: ark/v1
kind: WiringPlan

pipeline:
  topology: sequential    # 步骤严格按顺序执行

steps:
  - id: fetch
    uses: "@ark/cli-weather"
    command: fetch
    description: "获取指定城市的当前天气"
    inputs:
      city: "{{ ctx.flags.city | default: 'Beijing' }}"
    outputs:
      bind:
        weatherData: "."    # "." 表示把整个输出对象绑定到 weatherData

  - id: review
    uses: builtin/human-review
    condition: "{{ ctx.mode == 'manual' }}"    # 只在 manual 模式执行
    description: "展示天气数据，等待人工确认"
    inputs:
      payload: "{{ ctx.bindings.weatherData }}"
    outputs:
      bind:
        approvedWeather: approved    # human-review 的 approved 字段 = 用户确认的数据

  - id: generate
    uses: "@ark/cli-report"
    command: generate
    description: "用 AI 生成天气播报"
    inputs:
      # ternary：manual 模式用人工审核后的数据，auto 模式直接用原始数据
      weatherData: "{{ ctx.mode == 'manual' ? ctx.bindings.approvedWeather : ctx.bindings.weatherData }}"
      style: "{{ ctx.flags.style | default: 'casual daily report' }}"
      outputDir: "{{ ctx.flags.output-dir | default: './reports' }}"
    outputs:
      bind:
        result: "."

  - id: done
    uses: builtin/log
    description: "打印完成信息"
    inputs:
      message: "{{ ctx.bindings.result }}"

errorPolicy:
  onStepFailure: abort
  retryPolicy:
    maxAttempts: 3
    backoffMs: 2000
    jitter: true    # 重试时加随机抖动，避免并发重试雪崩

flags:
  - name: city
    type: string
    required: false
    description: "要播报的城市"
  - name: style
    type: string
    required: false
    default: "casual daily report"
  - name: output-dir
    type: string
    required: false
    default: "./reports"
```

**数据流：**

```
ctx.flags.city
      ↓
  [fetch]  ──→  ctx.bindings.weatherData
                       ↓
                  [review] (manual only) ──→  ctx.bindings.approvedWeather
                                                        ↓
                                              [generate] ──→  ctx.bindings.result
                                                                       ↓
                                                              [done] (log)
```

---

### 5.2 DAG 并行执行（dag）

**适用场景：** 多个步骤之间没有数据依赖，可以同时运行以节省时间。

**例子：多城市天气对比报告**

场景：同时获取上海、北京、广州三个城市的天气，再把三份数据合并生成对比报告。

```yaml
apiVersion: ark/v1
kind: WiringPlan

pipeline:
  topology: dag      # 启用 DAG 调度：框架自动推断依赖，无依赖的步骤并发运行
  concurrency: 4     # 可选：最多同时运行 4 个步骤（默认不限）

steps:
  # 这三个步骤之间没有互相依赖，框架会并发启动它们
  - id: fetch-shanghai
    uses: "@ark/cli-weather"
    command: fetch
    inputs:
      city: "Shanghai"
    outputs:
      bind:
        weatherShanghai: "."

  - id: fetch-beijing
    uses: "@ark/cli-weather"
    command: fetch
    inputs:
      city: "Beijing"
    outputs:
      bind:
        weatherBeijing: "."

  - id: fetch-guangzhou
    uses: "@ark/cli-weather"
    command: fetch
    inputs:
      city: "Guangzhou"
    outputs:
      bind:
        weatherGuangzhou: "."

  # generate 的 inputs 引用了三个 binding
  # 框架自动推断：generate 依赖以上三个步骤，等它们全部完成后才开始
  - id: generate
    uses: "@ark/cli-report"
    command: generate
    inputs:
      weatherData:
        shanghai: "{{ ctx.bindings.weatherShanghai }}"
        beijing: "{{ ctx.bindings.weatherBeijing }}"
        guangzhou: "{{ ctx.bindings.weatherGuangzhou }}"
      style: "comparison report"
    outputs:
      bind:
        report: "."

  - id: done
    uses: builtin/log
    inputs:
      message: "{{ ctx.bindings.report }}"

errorPolicy:
  onStepFailure: abort
  parallelBehavior: failFast    # 三个 fetch 中任一失败 → 立即取消其他 → 报错
```

**执行时间对比：**

```
sequential（顺序）：
  fetch-shanghai → fetch-beijing → fetch-guangzhou → generate
  总耗时 ≈ 2s + 2s + 2s + 5s = 11s

dag（并行）：
  fetch-shanghai ──┐
  fetch-beijing  ──┼→ generate
  fetch-guangzhou──┘
  总耗时 ≈ max(2s, 2s, 2s) + 5s = 7s
```

**手动声明依赖（dependsOn）：**

有时两个步骤没有数据传递，但有顺序要求（如都写同一个文件）：

```yaml
steps:
  - id: write-config
    uses: "@my-org/cli-config-writer"
    # ...

  - id: start-service
    uses: "@my-org/cli-service"
    dependsOn: [write-config]    # 手动声明依赖，框架推断不出来
```

`dependsOn` 和自动推断的依赖取并集，不是替换。

---

### 5.3 条件分支（if/else + branch）

Ark 有两种"跳过"机制，适用场景不同：

| 机制 | 作用 | 场景 |
|------|------|------|
| `condition` 字段 | 条件为 false 时跳过**单个步骤** | 某一步可选，其他步骤不受影响 |
| `builtin/branch` | 根据条件**跳转到指定步骤**，跳过中间所有步骤 | 互斥路径，类似 if/else |

**例子：翻译 → 审核 → 发布**

场景：把英文内容翻译成中文，根据内容长度决定是否需要人工审核，最后发到小红书。

```yaml
apiVersion: ark/v1
kind: WiringPlan

pipeline:
  topology: sequential

steps:
  - id: translate
    uses: "@my-org/cli-translate"
    command: translate
    inputs:
      text: "{{ ctx.flags.text }}"
      targetLang: "ZH"
    outputs:
      bind:
        translated: "."

  # builtin/branch：根据条件选择跳转路径
  # 框架按顺序检查每个 case 的 condition，第一个为 true 的 next 生效
  - id: route
    uses: builtin/branch
    cases:
      - condition: "{{ ctx.bindings.translated.translated.length > 200 }}"
        next: review       # 内容超过 200 字，需要人工审核
      - condition: "true"
        next: post         # 否则直接发布（兜底 case）

  - id: review
    uses: builtin/human-review
    description: "内容较长，请确认后再发布"
    inputs:
      payload: "{{ ctx.bindings.translated }}"
    outputs:
      bind:
        approved: approved

  - id: post
    uses: "@ark/cli-xhs"
    command: post
    inputs:
      # 如果经过了 review 步骤，用审核后的内容；否则用翻译后的内容
      title: "{{ ctx.bindings.approved.title | default: ctx.bindings.translated.title }}"
      body: "{{ ctx.bindings.approved.translated | default: ctx.bindings.translated.translated }}"
    outputs:
      bind:
        result: "."

  - id: done
    uses: builtin/log
    inputs:
      message: "已发布：{{ ctx.bindings.result.postUrl }}"

errorPolicy:
  onStepFailure: abort

flags:
  - name: text
    type: string
    required: true
    description: "要翻译并发布的英文内容"
```

**单步条件（跳过单个步骤）：**

如果只需要某一步在特定条件下跳过，直接用 `condition`：

```yaml
- id: notify-slack
  uses: "@my-org/cli-slack"
  condition: "{{ ctx.flags.notify == 'true' }}"    # 只有传 --notify 时才执行
  inputs:
    message: "发布完成：{{ ctx.bindings.result.postUrl }}"
```

`condition` 为 false 时该步骤状态变为 `skipped`，流水线继续执行下一步。

---

### 5.4 批量并发处理（parallel-map）

**适用场景：** 对一个数组的每个元素执行同样的操作，类似 `Array.map()`，但并发执行。

**例子：批量翻译文章列表**

场景：有一批英文文章标题需要翻译成中文，并行处理所有标题。

```yaml
apiVersion: ark/v1
kind: WiringPlan

pipeline:
  topology: sequential    # parallel-map 步骤内部自管理并发，外层用 sequential 即可

steps:
  # fan-out：对 articles 数组的每个元素，并发调用 cli-translate
  - id: translate-all
    uses: builtin/parallel-map
    inputs:
      items: "{{ ctx.flags.articles }}"      # 数组，如 '["Hello world","Good morning"]'
      step: "@my-org/cli-translate"          # 对每个 item 调用哪个 CLI
      command: translate                     # 调用的子命令（可选）
      inputKey: text                         # 把每个 item 放入输入的哪个字段
      concurrency: 5                         # 最多同时处理 5 个（默认不限）
    outputs:
      bind:
        translations: results    # results 是按原顺序收集的输出数组

  # fan-in：汇总所有翻译结果
  - id: summarize
    uses: builtin/log
    inputs:
      message: "共翻译 {{ ctx.bindings.translations.length }} 条"

  # 把翻译结果写入文件（示例）
  - id: save
    uses: "@my-org/cli-file-writer"
    inputs:
      data: "{{ ctx.bindings.translations }}"
      path: "./output/translations.json"

errorPolicy:
  onStepFailure: abort
  parallelBehavior: failFast    # 任一翻译失败 → 立即取消其他

flags:
  - name: articles
    type: string
    required: true
    description: "JSON 数组格式的文章标题列表"
```

**执行过程：**

```
articles = ["Hello world", "Good morning", "How are you"]

并发运行（最多 5 个）：
  cli-translate { text: "Hello world" }   ──┐
  cli-translate { text: "Good morning" }  ──┼→ translations = [
  cli-translate { text: "How are you" }   ──┘     { original: "Hello world", translated: "你好世界" },
                                                   { original: "Good morning", translated: "早上好" },
                                                   { original: "How are you", translated: "你好吗" }
                                                 ]
```

**parallel-map 与 dag 结合：**

`builtin/parallel-map` 是一个普通步骤，可以放在 `dag` 流水线里和其他步骤并行：

```yaml
pipeline:
  topology: dag

steps:
  # 这两个步骤同时开始
  - id: translate-all
    uses: builtin/parallel-map
    inputs:
      items: "{{ ctx.flags.articles }}"
      step: "@my-org/cli-translate"
      inputKey: text
    outputs:
      bind:
        translations: results

  - id: fetch-weather
    uses: "@ark/cli-weather"
    inputs:
      city: "{{ ctx.flags.city }}"
    outputs:
      bind:
        weather: "."

  # 等两个步骤都完成后再生成报告
  - id: generate-report
    uses: "@ark/cli-report"
    inputs:
      translations: "{{ ctx.bindings.translations }}"
      weather: "{{ ctx.bindings.weather }}"
```

**partial failure（waitAll）：**

```yaml
errorPolicy:
  parallelBehavior: waitAll    # 即使部分失败，也等所有 item 跑完

# 结果（3 个 item，第 2 个失败）：
# translations = [
#   { original: "Hello world", translated: "你好世界" },
#   null,                                                  ← 失败的 item 变成 null
#   { original: "How are you", translated: "你好吗" }
# ]
# 步骤仍标记为 failed，但你可以在后续步骤里过滤 null
```

---

### 5.5 持续监听（streaming）

**适用场景：** source CLI 持续向 stdout 输出事件（价格 tick、日志行、传感器数据……），框架持续读取并驱动 downstream 步骤处理每条事件，直到满足停止条件或收到信号。适合监控类、实时流处理场景。

**例子：持续监控商品价格，低于阈值时发送告警**

```yaml
apiVersion: ark/v1
kind: WiringPlan

pipeline:
  topology: sequential
  lifecycle: streaming          # 声明为 streaming 模式：source CLI 持续运行，框架持续监听其输出

# streaming 控制选项（顶层字段，与 pipeline/steps 同级）
streaming:
  until: "{{ ctx.bindings.priceAlert.triggered }}"    # 为 truthy 时停止
  stopOn:
    - signal: SIGINT            # Ctrl+C 时优雅退出
    - signal: SIGTERM
  restartOnFailure: true        # source CLI 退出后自动重启，不停止流水线

steps:
  # 每次循环：获取当前价格
  - id: fetch-price
    uses: "@my-org/cli-price-checker"
    inputs:
      productId: "{{ ctx.flags.product-id }}"
      source: "{{ ctx.flags.source | default: 'jd' }}"
    outputs:
      bind:
        priceData: "."

  # 检查是否低于阈值
  - id: check-threshold
    uses: builtin/branch
    cases:
      - condition: "{{ ctx.bindings.priceData.price <= ctx.flags.threshold }}"
        next: alert             # 低于阈值 → 触发告警
      - condition: "true"
        next: log-and-wait      # 否则 → 记录日志，等下次循环

  # 触发告警：发通知，然后设置 triggered = true 触发 until 条件
  - id: alert
    uses: "@my-org/cli-notify"
    inputs:
      channel: "{{ ctx.flags.channel | default: 'wecom' }}"
      message: "价格告警：{{ ctx.flags.product-id }} 当前价格 {{ ctx.bindings.priceData.price }} 元，低于阈值 {{ ctx.flags.threshold }} 元"
    outputs:
      bind:
        priceAlert:
          triggered: true

  - id: log-and-wait
    uses: builtin/log
    inputs:
      message: "当前价格 {{ ctx.bindings.priceData.price }} 元，高于阈值，继续监控..."

errorPolicy:
  onStepFailure: continue    # 单次循环失败时继续（配合 restartOnFailure）

flags:
  - name: product-id
    type: string
    required: true
    description: "要监控的商品 ID"
  - name: threshold
    type: number
    required: true
    description: "价格阈值（元）"
  - name: source
    type: string
    required: false
    default: "jd"
  - name: channel
    type: string
    required: false
    default: "wecom"
```

**streaming lifecycle 字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `pipeline.lifecycle` | `streaming` | 声明为持续监听模式 |
| `streaming.until` | 模板表达式 | 每次事件处理后求值，为 truthy 时停止 |
| `streaming.stopOn` | `[{signal: string}]` | 收到指定 OS 信号时优雅退出 |
| `streaming.restartOnFailure` | boolean | source CLI 退出后是否自动重启，默认 false |

> **注意：** `streaming:` 是 WiringPlan 的**顶层字段**，与 `pipeline:`、`steps:` 同级，不是 `pipeline:` 的子字段。

**运行方式：**

```bash
# 启动持续监控（source CLI 持续运行，每次输出触发 downstream 处理）
ark run @my-org/cli-price-monitor --product-id B09ABC123 --threshold 299

# Ctrl+C 优雅退出（触发 SIGINT）
```

---

## 第六章：模板表达式

模板表达式是 Wiring Plan 的"胶水"，让步骤之间的数据流动起来。

### 6.1 基本语法

```yaml
"{{ ctx.flags.city }}"               # 访问命令行参数
"{{ ctx.bindings.weatherData }}"     # 访问上一步的输出
"{{ ctx.bindings.weatherData.tempC }}"  # 访问嵌套字段
"{{ ctx.mode }}"                     # 访问当前模式
```

### 6.2 默认值

```yaml
"{{ ctx.flags.city | default: 'Beijing' }}"
"{{ ctx.flags.style | default: 'casual' }}"
```

当 `ctx.flags.city` 为 undefined 或空字符串时，使用 `'Beijing'`。

### 6.3 三元运算符

```yaml
"{{ ctx.mode == 'manual' ? ctx.bindings.approvedData : ctx.bindings.rawData }}"
"{{ ctx.flags.lang == 'zh' ? '你好' : 'Hello' }}"
```

### 6.4 类型保留

**单个插值**（整个字符串只有一个 `{{ }}`）：保留原始类型。

```yaml
weatherData: "{{ ctx.bindings.fetchResult }}"    # 传入整个对象，不是字符串
count: "{{ ctx.flags.count }}"                   # 传入数字，不是字符串 "5"
```

**多个插值混合**：强制转为字符串。

```yaml
message: "城市 {{ ctx.bindings.city }}，温度 {{ ctx.bindings.tempC }}℃"
# → 字符串 "城市 Shanghai，温度 18℃"
```

### 6.5 在 condition 里使用

```yaml
condition: "{{ ctx.mode == 'manual' }}"
condition: "{{ ctx.flags.notify == 'true' }}"
condition: "{{ ctx.bindings.result.length > 0 }}"
```

### 6.6 在 builtin/branch cases 里使用

```yaml
cases:
  - condition: "{{ ctx.bindings.score >= 90 }}"
    next: publish-immediately
  - condition: "{{ ctx.bindings.score >= 60 }}"
    next: review-first
  - condition: "true"
    next: reject
```

---

## 第七章：内置步骤

Ark 提供几个不需要额外安装的内置步骤类型。

### 7.1 builtin/log

打印信息到终端。

```yaml
- id: done
  uses: builtin/log
  inputs:
    message: "完成：{{ ctx.bindings.result.postUrl }}"
```

### 7.2 builtin/human-review

暂停流水线，展示数据等待人工确认。

```yaml
- id: review
  uses: builtin/human-review
  condition: "{{ ctx.mode == 'manual' }}"    # 通常只在 manual 模式下激活
  inputs:
    payload: "{{ ctx.bindings.generatedContent }}"    # 展示给用户看的数据
  outputs:
    bind:
      approvedData: approved    # approved = 用户确认（或编辑）后的数据
```

用户会看到：

```
[Human Review] Please review the following payload:
{
  "title": "今日天气播报",
  "body": "今天上海天气晴朗..."
}
[y]es / [e]dit (as JSON) / [n]o cancel
```

- `y`：确认，`approved` = 原始 payload
- `e`：编辑，用户修改 JSON 后确认，`approved` = 修改后的数据
- `n`：取消，流水线终止

### 7.3 builtin/branch

条件路由，跳转到指定步骤（跳过中间步骤）。

```yaml
- id: route
  uses: builtin/branch
  cases:
    - condition: "{{ ctx.flags.platform == 'xhs' }}"
      next: post-xhs
    - condition: "{{ ctx.flags.platform == 'x' }}"
      next: post-x
    - condition: "true"    # 兜底 case
      next: error-unsupported-platform
```

**注意：** `builtin/branch` 只在 `topology: sequential` 下有效，DAG 模式里会被忽略。

### 7.4 builtin/parallel-map

对数组并发执行，见 [5.4 节](#54-批量并发处理parallel-map)。

---

## 第八章：Composed CLI 与多命令

当你的工具需要支持多个独立的子命令（每个子命令有自己的流水线），使用多命令结构。

### 8.1 目录结构

```
packages/cli-social-publisher/
├── src/
│   └── index.ts               ← 双模式入口（runComposedCli）
├── wirings/
│   ├── post-xhs.yaml          ← post-xhs 命令的流水线
│   └── post-x.yaml            ← post-x 命令的流水线
├── ark-descriptor.yaml        ← 声明两个命令
├── package.json
└── tsconfig.json
```

### 8.2 ark-descriptor.yaml（多命令版）

每个命令通过 `wiringRef` 指向自己的 wiring plan 文件：

```yaml
functional:
  id: "@ark/cli-social-publisher"
  version: "0.1.0"
  displayName: "Social Publisher"
  entrypoint: "dist/index.js"
  modes: [auto, manual]
  defaultCommand: post-xhs    # 当被父流水线调用、不指定命令时的默认命令

  commands:
    - name: post-xhs
      description: "生成并发布一条小红书帖子"
      wiringRef: "wirings/post-xhs.yaml"    # ← 指向各自的 wiring plan
      options:
        - flag: "--topic"
          type: string
          required: true
        - flag: "--style"
          type: string
          required: false
        - flag: "--auto"
          type: boolean
          required: false

    - name: post-x
      description: "生成并发布一条 Twitter/X 推文"
      wiringRef: "wirings/post-x.yaml"
      options:
        - flag: "--topic"
          type: string
          required: true

lineage:
  kind: composed
  parents:
    - id: "@ark/cli-content"
      version: "0.1.0"
    - id: "@ark/cli-xhs"
      version: "0.1.0"
    - id: "@ark/cli-x"
      version: "0.1.0"
```

### 8.3 wirings/post-xhs.yaml（小红书发帖流水线）

```yaml
apiVersion: ark/v1
kind: WiringPlan

pipeline:
  topology: sequential

steps:
  - id: generate
    uses: "@ark/cli-content"
    command: xhs
    description: "用 AI 生成小红书风格的内容"
    inputs:
      topic: "{{ ctx.flags.topic }}"
      style: "{{ ctx.flags.style | default: 'casual' }}"
    outputs:
      bind:
        content: "."    # content = { title, body, tags }

  - id: review
    uses: builtin/human-review
    condition: "{{ ctx.mode == 'manual' }}"
    description: "展示生成内容，等待确认"
    inputs:
      payload: "{{ ctx.bindings.content }}"
    outputs:
      bind:
        approvedContent: approved

  - id: post
    uses: "@ark/cli-xhs"
    command: post
    description: "用浏览器自动化发布到小红书"
    inputs:
      title: "{{ ctx.mode == 'manual' ? ctx.bindings.approvedContent.title : ctx.bindings.content.title }}"
      body: "{{ ctx.mode == 'manual' ? ctx.bindings.approvedContent.body : ctx.bindings.content.body }}"
      tags: "{{ ctx.mode == 'manual' ? ctx.bindings.approvedContent.tags : ctx.bindings.content.tags }}"
    outputs:
      bind:
        result: "."

  - id: done
    uses: builtin/log
    inputs:
      message: "已发布到小红书：{{ ctx.bindings.result.postUrl }}"

errorPolicy:
  onStepFailure: abort
  retryPolicy:
    maxAttempts: 2
    backoffMs: 3000

flags:
  - name: topic
    type: string
    required: true
    description: "帖子主题"
  - name: style
    type: string
    required: false
    default: "casual"
```

### 8.4 src/index.ts（双模式入口）

使用 `runComposedCli()` 一行搞定双模式：

```typescript
#!/usr/bin/env node
import { runComposedCli } from '@ark/runtime'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

await runComposedCli({
  packageDir: join(__dirname, '..'),
  composedCliId: '@ark/cli-social-publisher',
  monorepoRoot: join(__dirname, '..', '..', '..'),
})
```

`runComposedCli()` 自动处理两种调用场景：

| 场景 | 检测方式 | 行为 |
|------|----------|------|
| **被父流水线调用**（作为 leaf 步骤）| `ARK_INPUT_PAYLOAD` 环境变量存在 | 读取 payload，运行对应命令的 wiring plan，写出 `ARK_OUTPUT` |
| **直接从终端运行** | `ARK_INPUT_PAYLOAD` 不存在 | 解析 `process.argv`，运行对应命令，输出到终端 |

### 8.5 运行方式

```bash
# 直接运行（human-review 模式）
ark run @ark/cli-social-publisher post-xhs --topic "春日健康饮食" --manual

# 自动模式
ark run @ark/cli-social-publisher post-xhs --topic "春日健康饮食" --auto

# 预览模式
ark run @ark/cli-social-publisher post-x --topic "AI trends 2026" --dry-run

# 查看帮助
ark run @ark/cli-social-publisher --help
```

### 8.6 在父流水线里调用 Composed CLI

Composed CLI 本身也可以作为一个步骤被更大的流水线调用：

```yaml
steps:
  - id: generate-weather-post
    uses: "@ark/cli-weather-report"
    command: run          # 调用它的 run 命令（或省略，使用 defaultCommand）
    inputs:
      city: "{{ ctx.flags.city }}"
    outputs:
      bind:
        weatherPost: "."

  - id: publish-to-xhs
    uses: "@ark/cli-social-publisher"
    command: post-xhs     # 调用多命令 composed CLI 的特定命令
    inputs:
      topic: "今日 {{ ctx.flags.city }} 天气播报"
```

---

## 第九章：包装第三方 CLI（ark wrap）

当你想把一个已有的第三方 CLI（如 `gh`、`feishu`、`slack`）接入 Ark 流水线时，用 `ark wrap` 自动生成适配器骨架。

### 9.1 命令格式

```bash
ark wrap \
  --cli <third-party-binary> \
  --cmd "<subcommand>" \
  --id "<package-id>" \
  --out <output-directory>
```

| 参数 | 说明 | 示例 |
|------|------|------|
| `--cli` | 第三方 CLI 的二进制名 | `gh` |
| `--cmd` | 要包装的子命令 | `"issue create"` |
| `--id` | 新包的 npm 包名 | `"@my-org/cli-gh-issue"` |
| `--out` | 输出目录（相对于仓库根目录） | `packages/cli-gh-issue` |

### 9.2 例子：包装 gh CLI 自动创建 GitHub Issue

```bash
ark wrap \
  --cli gh \
  --cmd "issue create" \
  --id "@my-org/cli-gh-issue" \
  --out packages/cli-gh-issue
```

生成的文件：

```
packages/cli-gh-issue/
├── src/
│   ├── index.ts          ← 适配器入口（含 TODO 注释指引）
│   └── types.ts          ← 输入/输出类型定义（需要填写）
├── ark-descriptor.yaml   ← 需要补充 inputs/outputs/env 声明
├── package.json
└── tsconfig.json
```

### 9.3 生成的 src/index.ts

```typescript
#!/usr/bin/env node
import { readInputPayload, writeOutput } from '@ark/core'
import { execa } from 'execa'
import type { GhIssueInput, GhIssueOutput } from './types.js'

// ── 1. Read inputs ────────────────────────────────────────────────────────
const payload = readInputPayload<GhIssueInput>()

const args = process.argv.slice(2)
function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag)
  return idx !== -1 ? args[idx + 1] : undefined
}

// TODO: replace with your actual input fields
// const myField = payload?.myField ?? getFlag('--my-field')

// ── 2. Auth check ─────────────────────────────────────────────────────────
// const token = process.env['GH_TOKEN']
// if (!token) { process.stderr.write('...'); process.exit(1) }

// ── 3. Invoke third-party CLI ─────────────────────────────────────────────
const result = await execa('gh', [
  'issue', 'create',
  // TODO: add CLI flags mapped from inputs
], { reject: false })

if (result.exitCode !== 0) {
  process.stderr.write(`[ark:gh-issue] CLI error: ${result.stderr}\n`)
  process.exit(1)
}

// ── 4. Parse CLI output ───────────────────────────────────────────────────
let output: GhIssueOutput
try {
  output = JSON.parse(result.stdout) as GhIssueOutput
} catch {
  output = {
    // TODO: parse result.stdout（如果 gh 输出的不是 JSON）
  } as GhIssueOutput
}

// ── 5. Write Ark protocol output ──────────────────────────────────────────
writeOutput(output)
process.exit(0)
```

### 9.4 填写生成的骨架

**第一步：填写 src/types.ts**

```typescript
// 根据 `gh issue create` 的参数和输出填写
export interface GhIssueInput {
  title: string
  body: string
  repo: string        // 仓库名，如 "my-org/my-repo"
  labels?: string[]
}

export interface GhIssueOutput {
  issueUrl: string    // 创建成功的 Issue URL
  issueNumber: number
}
```

**第二步：填写 src/index.ts**

```typescript
const title = payload?.title ?? getFlag('--title') ?? ''
const body = payload?.body ?? getFlag('--body') ?? ''
const repo = payload?.repo ?? getFlag('--repo') ?? ''
const labels = payload?.labels ?? []

const result = await execa('gh', [
  'issue', 'create',
  '--title', title,
  '--body', body,
  '--repo', repo,
  ...(labels.length > 0 ? ['--label', labels.join(',')] : []),
  '--json', 'url,number',    // 让 gh 输出 JSON
], { reject: false })

// gh --json 输出 JSON，直接解析
const parsed = JSON.parse(result.stdout) as { url: string; number: number }
output = { issueUrl: parsed.url, issueNumber: parsed.number }
```

**第三步：填写 ark-descriptor.yaml**

```yaml
functional:
  id: "@my-org/cli-gh-issue"
  # ...
  inputs:
    - id: title
      type: string
      required: true
      description: "Issue 标题"
    - id: body
      type: string
      required: true
      description: "Issue 正文（支持 Markdown）"
    - id: repo
      type: string
      required: true
      description: "仓库名，格式：owner/repo"
    - id: labels
      type: string[]
      required: false
      description: "标签列表"

  outputs:
    - id: issueUrl
      type: string
      description: "创建成功的 Issue URL"
    - id: issueNumber
      type: number
      description: "Issue 编号"

  env:
    - name: GH_TOKEN
      required: true
      description: "GitHub Personal Access Token"
```

**第四步：构建并接入流水线**

```bash
pnpm --filter @my-org/cli-gh-issue build
```

然后在任意 wiring plan 里使用：

```yaml
- id: create-issue
  uses: "@my-org/cli-gh-issue"
  inputs:
    title: "发现 Bug：{{ ctx.bindings.errorReport.title }}"
    body: "{{ ctx.bindings.errorReport.detail }}"
    repo: "my-org/my-repo"
    labels: ["bug", "auto-reported"]
  outputs:
    bind:
      issue: "."

- id: notify
  uses: builtin/log
  inputs:
    message: "Issue 已创建：{{ ctx.bindings.issue.issueUrl }}"
```

### 9.5 其他常用包装场景

```bash
# 包装飞书消息发送
ark wrap --cli feishu --cmd "message send" \
  --id "@my-org/cli-feishu-msg" \
  --out packages/cli-feishu-msg

# 包装 Slack 通知
ark wrap --cli slack --cmd "chat postMessage" \
  --id "@my-org/cli-slack-notify" \
  --out packages/cli-slack-notify

# 包装 git 提交
ark wrap --cli git --cmd "commit" \
  --id "@my-org/cli-git-commit" \
  --out packages/cli-git-commit
```

---

## 第十章：执行模式（manual / auto / dry-run）

同一个 wiring plan 支持三种运行模式，行为不同但代码不变。

### 10.1 manual 模式（默认）

```bash
ark run @ark/cli-social-publisher post-xhs --topic "春日健康饮食"
```

- `ctx.mode = 'manual'`
- `condition: "{{ ctx.mode == 'manual' }}"` 的步骤会执行（通常是 `builtin/human-review`）
- 会在关键节点暂停，等待用户确认

**适合：** 调试、审核内容质量时。

### 10.2 auto 模式

```bash
ark run @ark/cli-weather-report --auto
```

- `ctx.mode = 'auto'`
- `builtin/human-review` 步骤被跳过（`condition: "{{ ctx.mode == 'manual' }}"` 不满足）
- 如果 wiring plan 有 `autoMode.decisionStep`，AI 会在该步骤前自动决策输入参数

```yaml
# wiring plan 里声明 AI 决策步骤
autoMode:
  decisionStep:
    before: fetch          # 在 fetch 步骤执行前，先让 AI 决定输入
    prompt: |
      选择一个今天值得播报天气的中国城市，以及报告风格（casual / professional / poetic）。
      返回 JSON：{ "city": string, "style": string }
    outputBindings:
      city: ctx.flags.city    # AI 的输出 city 字段 → ctx.flags.city
      style: ctx.flags.style
```

**适合：** 定时任务、CI/CD、无人值守运行。

### 10.3 dry-run 模式

```bash
ark run @ark/cli-social-publisher post-xhs --topic "春日健康饮食" --dry-run
```

- `ctx.dryRun = true`
- 所有步骤走完逻辑，但**不真正执行副作用**（不发 HTTP 请求、不发帖、不写文件）
- 每个步骤打印"would run"日志，输出空对象 `{}`

**适合：** 验证 wiring plan 配置是否正确、预览数据流。

### 10.4 同一个 pipeline 的三种模式对比

以小红书发帖流水线为例：

```
模式         步骤执行顺序                          是否实际发帖
──────────────────────────────────────────────────────────
manual       generate → review(暂停) → post → done    是
auto         generate → post → done                    是
dry-run      generate(跳过) → post(跳过) → done       否
```

---

## 第十一章：错误处理、重试与超时

### 11.1 onStepFailure

```yaml
errorPolicy:
  onStepFailure: abort      # 某步失败 → 立即停止整条流水线（默认）
  # onStepFailure: continue # 某步失败 → 记录错误，继续执行后续步骤
```

### 11.2 retryPolicy

```yaml
errorPolicy:
  onStepFailure: abort
  retryPolicy:
    maxAttempts: 3      # 最多尝试 3 次（第 1 次 + 重试 2 次）
    backoffMs: 2000     # 重试前等待 2000ms
    jitter: true        # 加随机抖动（避免并发重试时雪崩）
```

重试时的等待时间：`backoffMs * attempt + random(0, backoffMs * 0.3)`（jitter 模式）。

### 11.3 步骤超时（timeout）

```yaml
steps:
  - id: fetch-weather
    uses: "@ark/cli-weather"
    timeout: "30s"        # 单个步骤的超时时间
    inputs:
      city: "{{ ctx.flags.city }}"

  - id: generate-report
    uses: "@ark/cli-report"
    timeout: "2m"         # 2 分钟超时
```

**支持的单位：** `s`（秒）、`m`（分钟），如 `"30s"`、`"2m"`、`"90s"`。

**超时流程：**

1. 步骤启动，计时器开始
2. 超时 → 向子进程发 SIGTERM（优雅退出）
3. 再等 2 秒，仍在运行 → 发 SIGKILL（强制终止）
4. 步骤标记为失败，触发 `onStepFailure` 策略

### 11.4 并行错误策略（parallelBehavior）

在 `topology: dag` 或 `builtin/parallel-map` 时生效：

```yaml
errorPolicy:
  parallelBehavior: failFast    # 任一并发步骤失败 → 立即取消其他步骤（默认）
  # parallelBehavior: waitAll   # 等所有并发步骤都完成，再决定整体结果
```

**选择指南：**

- 所有并发步骤的结果都必须用到 → `failFast`（一个失败后续反正无法继续，早停省资源）
- 允许部分失败，想尽量收集成功结果 → `waitAll`

### 11.5 综合例子：带超时和重试的并行流水线

```yaml
apiVersion: ark/v1
kind: WiringPlan

pipeline:
  topology: dag
  concurrency: 4

steps:
  - id: fetch-weather
    uses: "@ark/cli-weather"
    timeout: "30s"          # 单个 API 请求 30s 超时
    inputs:
      city: "{{ ctx.flags.city }}"
    outputs:
      bind:
        weather: "."

  - id: fetch-news
    uses: "@my-org/cli-news"
    timeout: "15s"
    outputs:
      bind:
        news: "."

  - id: generate
    uses: "@ark/cli-report"
    timeout: "2m"           # AI 生成允许更长时间
    inputs:
      weather: "{{ ctx.bindings.weather }}"
      news: "{{ ctx.bindings.news }}"
    outputs:
      bind:
        report: "."

errorPolicy:
  onStepFailure: abort
  parallelBehavior: failFast
  retryPolicy:
    maxAttempts: 3
    backoffMs: 2000
    jitter: true
```

### 11.6 实时运行状态

终端运行时，框架显示实时面板（每 100ms 刷新）：

```
Pipeline: @ark/cli-weather-report  [running]  3.2s

  ◆ fetch-weather   [running]  3.2s
  ◆ fetch-news      [done]     1.1s  ✓
  ◆ generate        [waiting]       deps: fetch-weather, fetch-news
```

**步骤状态：**

| 状态 | 含义 |
|------|------|
| `pending` | 还没开始 |
| `waiting` | 依赖步骤还没完成 |
| `running` | 正在运行 |
| `done` | 成功完成 |
| `failed` | 失败 |
| `skipped` | condition 不满足，跳过 |
| `cancelled` | 被 failFast 取消 |

完成后打印耗时摘要：

```
Step timing summary:
  fetch-weather   2.1s
  fetch-news      1.1s
  generate        4.3s
  ─────────────────────────
  total wall time 6.4s  (sequential would have been 7.5s)
```

在 CI 或非 TTY 环境，自动切换为结构化日志：

```
[ark][step:fetch-weather] start  uses=@ark/cli-weather
[ark][step:fetch-news] start     uses=@my-org/cli-news
[ark][step:fetch-weather] done   elapsed=2.1s
[ark][step:fetch-news] done      elapsed=1.1s
[ark][step:generate] start       uses=@ark/cli-report  deps=[fetch-weather,fetch-news]
[ark][step:generate] done        elapsed=4.3s
[ark][pipeline] done             elapsed=6.4s
```

---

## 第十二章：AI Composer

AI Composer 根据你的需求描述，自动生成 wiring plan 并脚手架新的 composed CLI 包。

### 12.1 写 compose request 文件

```yaml
# compose-request.yaml
request: |
  我需要一个自动化工具，每天早上：
  1. 获取上海和北京的天气（可以并行）
  2. 让 AI 生成一段双城天气对比播报
  3. 人工审核后发布到小红书

parents:
  - "@ark/cli-weather"
  - "@ark/cli-report"
  - "@ark/cli-xhs"

outputId: "@my-org/cli-dual-city-weather"
outputDir: "packages/cli-dual-city-weather"
```

### 12.2 运行 Composer

```bash
ark compose --request compose-request.yaml
```

Composer 会：

1. 读取所有父工具的 descriptor，了解它们的输入输出
2. 调用 Claude，生成 wiring plan 草稿
3. 检测可并行的步骤，给出建议：

```
我注意到以下步骤之间没有数据依赖，可以并行运行：
  - fetch-shanghai
  - fetch-beijing

并行执行可以将预计耗时从 ~10s 降低到 ~7s。
推荐：failFast（两个结果都被后续步骤使用，任一失败后续无法继续）

是否启用并行执行？
  [1] 是，使用 DAG 模式 + failFast（推荐）
  [2] 是，使用 DAG 模式 + waitAll
  [3] 否，保持顺序执行
```

4. 展示生成的 wiring plan，等待你审核
5. 审核通过后，脚手架整个包目录

### 12.3 生成后的目录

```
packages/cli-dual-city-weather/
├── src/
│   └── index.ts          ← runComposedCli() 一行搞定
├── ark-wiring.yaml       ← AI 生成的流水线（你可以手动调整）
├── ark-descriptor.yaml   ← AI 生成的描述符
├── package.json
└── tsconfig.json
```

### 12.4 构建与运行

```bash
pnpm --filter @my-org/cli-dual-city-weather build

# 手动模式
ark run @my-org/cli-dual-city-weather --manual

# 自动模式
ark run @my-org/cli-dual-city-weather --auto
```

---

## 附录：YAML 字段速查表

### ark-descriptor.yaml 完整字段

```yaml
apiVersion: ark/v1
kind: CliDescriptor

functional:
  id: "@my-org/cli-name"           # npm 包名
  version: "0.1.0"
  displayName: "My CLI"
  description: |                   # 多行描述
    功能说明
  entrypoint: "dist/index.js"      # 编译后的入口文件
  modes: [manual, auto]            # 支持的运行模式
  defaultCommand: run              # 被父流水线调用时默认使用的命令（多命令 CLI 用）

  inputs:                          # 输入字段声明
    - id: fieldName
      type: string | number | boolean | string[]   # 支持的类型
      required: true | false
      description: "说明"

  outputs:                         # 输出字段声明
    - id: fieldName
      type: string
      description: "说明"

  commands:                        # 支持的子命令
    - name: run
      description: "命令说明"
      wiringRef: "wirings/run.yaml"    # 指向此命令的 wiring plan（多命令 CLI 用）
      options:
        - flag: "--city"
          type: string
          required: false
          description: "选项说明"

  types:                           # 自定义类型（用于 inputs/outputs 声明复杂类型）
    WeatherData:
      city: string
      tempC: number

  env:                             # 依赖的环境变量
    - name: ANTHROPIC_API_KEY
      required: true
      description: "API key 说明"

lineage:
  kind: leaf | composed
  createdAt: "ISO8601时间戳"
  parents:                         # composed 专用：父工具列表
    - id: "@ark/cli-weather"
      version: "0.1.0"
```

### ark-wiring.yaml 完整字段

```yaml
apiVersion: ark/v1
kind: WiringPlan

pipeline:
  topology: sequential | dag       # 执行拓扑（必填，mode 为旧写法已废弃）
  concurrency: 4                   # 可选，最大并发步骤数（仅 dag 模式）
  lifecycle: streaming             # 可选，声明持续监听模式

streaming:                         # 顶层字段，仅 lifecycle: streaming 时有效
  until: "{{ 模板表达式 }}"         # 每次事件后求值，为 truthy 时停止
  stopOn:
    - signal: SIGINT
    - signal: SIGTERM
  restartOnFailure: true           # source CLI 退出后自动重启

steps:
  - id: step-name                  # 步骤 ID（在 pipeline 内唯一）
    uses: "@org/cli-name"          # 调用的 CLI（或 builtin/xxx）
    command: subcommand            # 可选，调用的子命令
    description: "步骤说明"
    condition: "{{ 模板表达式 }}"   # 可选，false 时跳过此步骤
    timeout: "30s"                 # 可选，超时时间
    dependsOn: [step-a, step-b]    # 可选，手动声明依赖（dag 模式）
    inputs:
      field: "{{ ctx.xxx }}"       # 输入，支持模板表达式
    outputs:
      bind:
        bindingName: "."           # "." = 整个输出；"fieldName" = 某个字段

  # builtin/branch 专用字段
  - id: route
    uses: builtin/branch
    cases:
      - condition: "{{ 表达式 }}"
        next: step-id-to-jump-to

  # builtin/parallel-map 专用字段
  - id: fan-out
    uses: builtin/parallel-map
    inputs:
      items: "{{ ctx.bindings.array }}"
      step: "@org/cli-name"
      command: run                 # 可选
      inputKey: item               # 可选，默认 "item"
      concurrency: 5               # 可选，默认不限
    outputs:
      bind:
        results: results

errorPolicy:
  onStepFailure: abort | continue
  parallelBehavior: failFast | waitAll    # 仅 dag / parallel-map 时生效
  retryPolicy:
    maxAttempts: 3
    backoffMs: 2000
    jitter: true

autoMode:                          # 仅 auto 模式时生效
  decisionStep:
    before: step-id                # 在此步骤前执行 AI 决策
    prompt: |
      AI 决策的提示词
    outputBindings:
      field: ctx.flags.xxx         # AI 输出字段 → context 字段的映射

flags:                             # 命令行参数声明
  - name: city
    type: string | number | boolean
    required: true | false
    default: "Beijing"
    description: "参数说明"
```

### 模板表达式速查

| 表达式 | 说明 |
|--------|------|
| `{{ ctx.flags.city }}` | 命令行参数 |
| `{{ ctx.flags.city \| default: 'Beijing' }}` | 带默认值 |
| `{{ ctx.bindings.weatherData }}` | 步骤绑定数据 |
| `{{ ctx.bindings.data.field }}` | 嵌套字段 |
| `{{ ctx.mode }}` | 当前模式（manual / auto） |
| `{{ ctx.dryRun }}` | 是否 dry-run |
| `{{ ctx.mode == 'manual' ? ctx.bindings.a : ctx.bindings.b }}` | 三元运算 |
| `{{ ctx.bindings.list.length > 0 }}` | 比较表达式 |

---

*文档版本：2026-03-29 · 涵盖 Ark 所有特性*
