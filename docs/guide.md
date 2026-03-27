# Ark 框架使用指南

> 本指南从零开始，带你理解并使用 Ark 框架。读完后你将能够：运行已有的组合 CLI、编写自己的 Leaf CLI、用 YAML 把多个工具串联成一条自动化流水线。

---

## 目录

- [第一章：Ark 是什么，解决什么问题](#第一章ark-是什么解决什么问题)
- [第二章：先跑起来——运行内置示例](#第二章先跑起来运行内置示例)
- [第三章：理解核心概念](#第三章理解核心概念)
- [第四章：编写你的第一个 Leaf CLI](#第四章编写你的第一个-leaf-cli)
- [第五章：用 Wiring Plan 把工具串联起来](#第五章用-wiring-plan-把工具串联起来)
- [第六章：模板表达式完全指南](#第六章模板表达式完全指南)
- [第七章：三种执行模式详解](#第七章三种执行模式详解)
- [第八章：错误处理与重试](#第八章错误处理与重试)
- [第九章：用 AI Composer 自动生成 Wiring Plan](#第九章用-ai-composer-自动生成-wiring-plan)
- [附录：YAML 字段速查表](#附录yaml-字段速查表)

---

## 第一章：Ark 是什么，解决什么问题

### 1.1 痛点

假设你想做这样一件事：

> 每天早上自动获取北京的天气，然后让 AI 写一段天气播报，最后把它发到小红书。

这涉及三个工具：
1. **天气工具**：请求 wttr.in，返回结构化天气数据
2. **AI 报告工具**：把天气数据喂给 Claude，生成一段文字
3. **发帖工具**：用 Playwright 控制浏览器，把文字发出去

如果你自己把它们串起来，你需要写"胶水代码"：调第一个工具，拿到结果，传给第二个工具，再拿到结果，传给第三个……很快代码就乱了，逻辑和工具耦合在一起，复用性极差。

### 1.2 Ark 的方案

Ark 的核心思想是：**把每个工具做成标准化的 Leaf CLI，然后用一个 YAML 文件（Wiring Plan）声明它们如何连接**，框架负责数据传递和执行调度。

```
你只需要：

  [工具A] ──┐
             ├── ark-wiring.yaml ──→ ark run → 自动执行全流程
  [工具B] ──┘
```

好处：
- 每个工具独立开发、独立测试
- 连接逻辑写在 YAML 里，一目了然
- 支持条件分支、人工审核、错误重试、AI 自动决策
- 用 AI（Claude）帮你生成 Wiring Plan

---

## 第二章：先跑起来——运行内置示例

在理解概念之前，先把框架跑起来，有个直观感受。

### 2.1 安装

```bash
# 克隆仓库后
pnpm install
pnpm build
```

### 2.2 查看有哪些可用工具

```bash
ark list
```

你会看到：

```
Ark CLIs
──────────────────────────────────────────────────────────────
[leaf]     @ark/cli-weather              Weather CLI
           Fetches current weather data for a given city from wttr.in

[leaf]     @ark/cli-report               Weather Report CLI
           Receives structured weather data and uses AI to generate a report

[composed] @ark/cli-weather-report       Weather Daily Report
           Composed CLI that fetches weather and generates a report
```

- 标记为 `[leaf]` 的是原子工具
- 标记为 `[composed]` 的是已经组合好的流水线

### 2.3 了解一个工具的详情

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

### 2.4 运行它（手动模式）

```bash
ark run @ark/cli-weather-report --city Shanghai
```

运行后框架会：

1. 调用 `@ark/cli-weather`，获取上海的天气数据
2. 把天气数据展示给你，**等你确认**：
   ```
   [Human Review] Please review the following payload:
   { "city": "Shanghai", "tempC": 18, "description": "Partly cloudy", ... }
   [y]es / [e]dit (as JSON) / [n]o cancel
   ```
3. 你输入 `y` 确认后，把数据传给 `@ark/cli-report`，让 AI 生成报告
4. 输出最终报告

### 2.5 运行它（自动模式）

```bash
ark run @ark/cli-weather-report --auto
```

这次不会暂停等你确认。框架会先让 AI 自动选一个城市和报告风格，然后全程自动跑完。

### 2.6 查看工具的"家谱"

```bash
ark lineage @ark/cli-weather-report
```

```
Lineage tree for @ark/cli-weather-report

  ◆ @ark/cli-weather-report v0.1.0 [composed]
    ◇ @ark/cli-weather v0.1.0 [leaf]
    ◇ @ark/cli-report v0.1.0 [leaf]
```

`◆` 表示组合工具，`◇` 表示叶子工具。

---

## 第三章：理解核心概念

运行过示例后，我们来搞清楚背后的四个核心概念。

### 3.1 Leaf CLI：原子工具

Leaf CLI 是最小单元，只做一件事。它是一个普通的 Node.js 脚本，但遵循一个特殊的 I/O 协议：

**输入**：从环境变量 `ARK_INPUT_PAYLOAD` 读取 JSON 字符串

**输出**：向 stdout 写 `ARK_OUTPUT:<json>` 格式的行

这样框架就能在步骤之间传递结构化数据，而不是依赖 stdout 的文本解析。

每个 Leaf CLI 还有一个 `ark-descriptor.yaml`，声明自己的"接口"：接受什么输入、产出什么输出、支持哪些命令。

### 3.2 Composed CLI：组合工具

Composed CLI 是多个 Leaf CLI 串联的结果。它由两个文件定义：

- `ark-descriptor.yaml`：声明这个组合工具是谁（lineage.kind = composed），它的父工具是谁
- `ark-wiring.yaml`：定义执行流程——步骤顺序、数据如何在步骤间流动

### 3.3 Wiring Plan：接线图

`ark-wiring.yaml` 是整个流水线的蓝图。核心是 `steps` 列表，每一步说明：

- 调用哪个工具（`uses`）
- 输入从哪来（`inputs`，用模板表达式引用上下文）
- 输出存到哪（`outputs.bind`，绑定到上下文变量）

```yaml
steps:
  - id: fetch                          # 步骤名，随便起
    uses: "@ark/cli-weather"           # 调用哪个工具
    inputs:
      city: "{{ ctx.flags.city }}"     # 输入来自命令行参数
    outputs:
      bind:
        weatherData: "."               # 把整个输出存为 ctx.bindings.weatherData

  - id: generate
    uses: "@ark/cli-report"
    inputs:
      data: "{{ ctx.bindings.weatherData }}"  # 输入来自上一步的输出
```

### 3.4 Pipeline Context：流水线状态

框架在运行时维护一个全局"上下文对象"（ctx），所有步骤都能读写它：

```
ctx.mode            → 当前模式：'manual' 或 'auto'
ctx.flags.*         → 命令行传入的参数，比如 ctx.flags.city = 'Shanghai'
ctx.bindings.*      → 步骤间传递的数据，比如 ctx.bindings.weatherData
ctx.dryRun          → 是否是预览模式（true/false）
ctx.meta.runId      → 本次运行的唯一 ID
```

在 YAML 里用 `{{ ctx.xxx }}` 语法引用上下文，框架在执行时自动替换成实际值。

---

## 第四章：编写你的第一个 Leaf CLI

我们从零写一个 Leaf CLI：一个简单的"把文字翻译成大写"的工具。

### 4.1 创建目录结构

```bash
mkdir -p packages/cli-uppercase/src
cd packages/cli-uppercase
```

最终结构：

```
packages/cli-uppercase/
├── src/
│   └── index.ts
├── ark-descriptor.yaml
├── package.json
└── tsconfig.json
```

### 4.2 编写入口文件（src/index.ts）

```typescript
#!/usr/bin/env node
import { readInputPayload, writeOutput } from '@ark/core'

// 定义这个工具接受的输入结构
interface UppercaseInput {
  text?: string
}

// 第一步：尝试从管道读取输入（当被 ark 调用时，输入从这里来）
const payload = readInputPayload<UppercaseInput>()

// 第二步：如果没有管道输入，从命令行参数读取（当直接运行时）
const args = process.argv.slice(2)
const textFlagIdx = args.indexOf('--text')
const textFromArgv = textFlagIdx !== -1 ? args[textFlagIdx + 1] : undefined

// 优先使用管道输入，其次用命令行参数，最后用默认值
const text = payload?.text ?? textFromArgv ?? 'hello world'

// 第三步：执行业务逻辑
const result = {
  original: text,
  uppercased: text.toUpperCase(),
}

// 第四步：向管道输出结果
writeOutput(result)
process.exit(0)
```

**关键点解释：**

- `readInputPayload<T>()`：读取 `ARK_INPUT_PAYLOAD` 环境变量里的 JSON。当你在终端直接运行这个脚本时，这个变量不存在，返回 `undefined`；当被 ark 管道调用时，框架会自动设置它。
- `writeOutput(obj)`：向 stdout 写一行 `ARK_OUTPUT:{"original":"...","uppercased":"..."}` 。框架会解析这一行，提取 JSON，存到步骤输出。
- `process.exit(0)`：明确表示成功。失败时用 `exit(1)`，用户取消时用 `exit(2)`。

### 4.3 编写 ark-descriptor.yaml

```yaml
apiVersion: ark/v1
kind: CliDescriptor

functional:
  id: "@my-org/cli-uppercase"
  version: "0.1.0"
  displayName: "Uppercase CLI"
  description: |
    Converts input text to uppercase.
    Accepts text from pipeline or --text flag.
  entrypoint: "dist/index.js"
  modes: [manual, auto]         # 声明支持两种运行模式

  # 这个工具接受什么输入
  inputs:
    - id: text
      type: string
      required: false
      description: "Text to convert"

  # 这个工具产出什么输出
  outputs:
    - id: original
      type: string
      description: "Original text"
    - id: uppercased
      type: string
      description: "Uppercased text"

  # 当直接用命令行调用时支持的子命令和选项
  commands:
    - name: convert
      description: "Convert text to uppercase"
      options:
        - flag: "--text"
          type: string
          required: false
          description: "Text to convert. Defaults to 'hello world'."

lineage:
  kind: leaf                    # Leaf CLI 固定写 leaf
  createdAt: "2025-03-27T00:00:00+00:00"
  authors:
    - handle: "your-username"
```

**descriptor 的作用：** 这个文件是工具的"说明书"。其他工具想调用它时，框架先读这个文件，知道它的输入输出长什么样。Composer 用 AI 生成 wiring plan 时，也靠这个文件了解工具的能力。

### 4.4 编写 package.json

```json
{
  "name": "@my-org/cli-uppercase",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "my-uppercase": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@ark/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^22.0.0",
    "vitest": "^2.0.0"
  }
}
```

### 4.5 编写 tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

### 4.6 构建并验证

```bash
# 在 packages/cli-uppercase 目录下
pnpm build

# 回到根目录验证
cd ../..
ark validate @my-org/cli-uppercase
ark describe @my-org/cli-uppercase
```

### 4.7 单独测试（不通过管道）

```bash
node packages/cli-uppercase/dist/index.js --text "hello ark"
```

输出：

```
ARK_OUTPUT:{"original":"hello ark","uppercased":"HELLO ARK"}
```

---

## 第五章：用 Wiring Plan 把工具串联起来

现在我们已经有了两个工具：`@ark/cli-weather`（获取天气）和刚才写的 `@my-org/cli-uppercase`（转大写）。我们来把它们串成一条流水线：先获取天气描述，再把它转成大写。

### 5.1 创建 Composed CLI 的目录

```bash
mkdir -p packages/cli-weather-upper/src
cd packages/cli-weather-upper
```

### 5.2 编写 ark-wiring.yaml（核心文件）

```yaml
apiVersion: ark/v1
kind: WiringPlan
generatedAt: "2025-03-27T00:00:00+00:00"
approvedAt: "2025-03-27T00:00:00+00:00"

pipeline:
  mode: sequential      # 步骤顺序执行，目前框架只支持这个模式

# ── 步骤列表 ──────────────────────────────────────────────────
steps:

  # 步骤一：获取天气
  - id: fetch-weather
    uses: "@ark/cli-weather"    # 调用哪个工具
    command: fetch              # 调用工具的哪个子命令
    inputs:
      # ctx.flags.city 来自命令行参数 --city
      # 如果没传 --city，默认用 'Beijing'
      city: "{{ ctx.flags.city | default: 'Beijing' }}"
    outputs:
      bind:
        # "." 表示把整个输出对象存为 ctx.bindings.weatherData
        # 之后的步骤可以通过 ctx.bindings.weatherData 访问
        weatherData: "."

  # 步骤二：可选的人工审核（只在 manual 模式下执行）
  - id: review
    uses: builtin/human-review
    condition: "{{ ctx.mode == 'manual' }}"   # 条件不满足时，跳过此步骤
    inputs:
      # 把天气数据展示给用户审核
      payload: "{{ ctx.bindings.weatherData }}"
    outputs:
      bind:
        # approved 是 human-review 固定输出的字段名
        # 用户审核后（可能有修改）的数据存为 ctx.bindings.approvedData
        approvedData: approved

  # 步骤三：转大写
  - id: uppercase
    uses: "@my-org/cli-uppercase"
    command: convert
    inputs:
      # 三元表达式：manual 模式用审核后的数据，auto 模式直接用原始数据
      text: "{{ ctx.mode == 'manual' ? ctx.bindings.approvedData.description : ctx.bindings.weatherData.description }}"
    outputs:
      bind:
        result: "."

  # 步骤四：打印结果
  - id: print
    uses: builtin/log
    inputs:
      message: "{{ ctx.bindings.result.uppercased }}"

# ── 错误处理 ──────────────────────────────────────────────────
errorPolicy:
  onStepFailure: retry        # 失败时重试
  retryPolicy:
    maxAttempts: 3
    backoffMs: 1000           # 第一次重试等 1s，第二次等 2s，第三次等 3s
    jitter: true              # 加随机抖动，避免同时重试导致服务雪崩

# ── 自动模式配置 ───────────────────────────────────────────────
autoMode:
  decisionStep:
    before: fetch-weather     # 在 fetch-weather 步骤之前，插入 AI 决策步骤
    prompt: |
      Choose an interesting Chinese city for a weather report today.
      Return JSON with a single key: city (string, city name in English).
    outputBindings:
      # AI 返回的 JSON 里的 city 字段，注入到 ctx.flags.city
      city: ctx.flags.city

# ── 这个 CLI 支持的命令行标志 ──────────────────────────────────
flags:
  - name: city
    type: string
    required: false
    description: "City to fetch weather for"
```

### 5.3 理解数据流

我们用图来表示这条流水线中数据是怎么流动的：

```
命令行: ark run ... --city Shanghai
           │
           ▼
    ctx.flags.city = "Shanghai"
           │
           ▼
┌─────────────────────────────┐
│  步骤 fetch-weather          │
│  输入: city = "Shanghai"     │
│  输出: { tempC: 18,          │  ──→ ctx.bindings.weatherData = { tempC: 18, description: "Partly cloudy", ... }
│          description: "...", │
│          ... }               │
└─────────────────────────────┘
           │
           ▼（manual 模式才执行）
┌─────────────────────────────┐
│  步骤 review（human-review） │
│  展示 weatherData 给用户     │  ──→ ctx.bindings.approvedData = { ...用户确认或修改后的数据 }
│  等待 y/e/n                 │
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  步骤 uppercase              │
│  输入: text = "Partly cloudy"│
│  输出: { uppercased:         │  ──→ ctx.bindings.result = { original: "...", uppercased: "PARTLY CLOUDY" }
│    "PARTLY CLOUDY" }         │
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  步骤 print（builtin/log）   │
│  输出: "PARTLY CLOUDY"       │  ──→ 打印到终端
└─────────────────────────────┘
```

### 5.4 编写 ark-descriptor.yaml

```yaml
apiVersion: ark/v1
kind: CliDescriptor

functional:
  id: "@my-org/cli-weather-upper"
  version: "0.1.0"
  displayName: "Weather Uppercase"
  description: |
    Fetches weather for a city and converts the description to uppercase.
  entrypoint: "dist/index.js"
  modes: [manual, auto]

lineage:
  kind: composed
  createdAt: "2025-03-27T00:00:00+00:00"
  parents:
    - id: "@ark/cli-weather"
      version: "0.1.0"
    - id: "@my-org/cli-uppercase"
      version: "0.1.0"
  approvedWiringRef: "ark-wiring.yaml"
```

### 5.5 编写 src/index.ts（入口）

Composed CLI 的入口代码都长一个样：加载 descriptor，创建 PipelineRunner，传入 argv 执行。

```typescript
#!/usr/bin/env node
import { PipelineRunner } from '@ark/runtime'
import { loadDescriptor } from '@ark/core'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(__dirname, '..')

const descriptor = await loadDescriptor(join(packageRoot, 'ark-descriptor.yaml'))
const runner = new PipelineRunner({
  wiringPlanPath: join(packageRoot, 'ark-wiring.yaml'),
  descriptor,
})

await runner.run(process.argv.slice(2))
```

### 5.6 构建并运行

```bash
pnpm build

# 手动模式
ark run @my-org/cli-weather-upper --city Chengdu

# 自动模式（AI 自动选城市）
ark run @my-org/cli-weather-upper --auto

# 预览模式（不真正调用 API）
ark run @my-org/cli-weather-upper --dry-run --city Beijing
```

---

## 第六章：模板表达式完全指南

模板表达式是 Wiring Plan 里最核心的语法，用来动态引用上下文数据。所有 `{{ }}` 包裹的内容都会在运行时被替换成实际值。

### 6.1 基本路径访问

```yaml
inputs:
  city: "{{ ctx.flags.city }}"               # 命令行参数
  data: "{{ ctx.bindings.weatherData }}"     # 上一步绑定的数据
  nested: "{{ ctx.bindings.weather.tempC }}" # 嵌套字段
  mode: "{{ ctx.mode }}"                     # 当前运行模式
  isDryRun: "{{ ctx.dryRun }}"               # 是否预览模式
```

### 6.2 带默认值

当路径不存在或为 null 时，使用默认值：

```yaml
inputs:
  city: "{{ ctx.flags.city | default: 'Beijing' }}"
  style: "{{ ctx.flags.style | default: 'casual' }}"
```

### 6.3 条件判断（用于 condition 字段）

```yaml
# 只在 manual 模式下执行这个步骤
condition: "{{ ctx.mode == 'manual' }}"

# 只在 auto 模式下执行
condition: "{{ ctx.mode == 'auto' }}"

# 检查某个 flag 是否被设置
condition: "{{ ctx.flags.verbose }}"
```

### 6.4 三元表达式

根据条件选择不同的值：

```yaml
inputs:
  # manual 模式用审核后的数据，auto 模式用原始数据
  data: "{{ ctx.mode == 'manual' ? ctx.bindings.approvedData : ctx.bindings.rawData }}"

  # 根据 dryRun 状态选择
  target: "{{ ctx.dryRun ? 'sandbox' : 'production' }}"
```

### 6.5 类型保留规则

这个规则很重要，会影响你传给下游工具的数据类型：

```yaml
# ✅ 单个表达式：保留原始类型
inputs:
  count: "{{ ctx.flags.count }}"       # 若 count=42，传给工具的是数字 42，不是字符串 "42"
  enabled: "{{ ctx.flags.debug }}"     # 若 debug=true，传给工具的是布尔 true

# ⚠️ 混合文字：全部转为字符串
inputs:
  label: "City: {{ ctx.flags.city }}, Temp: {{ ctx.bindings.tempC }}"
  # 传给工具的是字符串 "City: Shanghai, Temp: 18"
```

### 6.6 常见错误

```yaml
# ❌ 错误：引用了不存在的 binding（上一步没有绑定 result）
inputs:
  data: "{{ ctx.bindings.result }}"

# ✅ 正确：先确认上游步骤有 outputs.bind.result
steps:
  - id: prev-step
    outputs:
      bind:
        result: "."   # 这里绑定了，后面才能用 ctx.bindings.result
```

---

## 第七章：三种执行模式详解

### 7.1 Manual 模式（默认）

```bash
ark run @ark/cli-weather-report --city Shanghai
```

**适用场景：** 你想在关键步骤前确认数据是否正确，或者想手动修改 AI 的中间结果。

**执行过程：**

1. 步骤按顺序执行
2. 遇到 `builtin/human-review` 步骤时，框架暂停并展示数据：
   ```
   [Human Review] Please review the following payload:
   {
     "city": "Shanghai",
     "tempC": 18,
     "description": "Partly cloudy"
   }
   [y]es / [e]dit (as JSON) / [n]o cancel
   ```
3. 你有三个选择：
   - **`y`（回车）**：数据原样通过，继续执行
   - **`e`**：提示你输入修改后的 JSON（一行），用修改后的数据继续
   - **`n`**：取消整条流水线，退出码为 2
4. `condition: "{{ ctx.mode == 'manual' }}"` 的步骤**会执行**

### 7.2 Auto 模式

```bash
ark run @ark/cli-weather-report --auto
```

**适用场景：** 全自动化运行，不需要人介入。适合定时任务、批处理。

**执行过程：**

1. 如果 wiring plan 里配置了 `autoMode.decisionStep`，框架在指定步骤之前插入一个 AI 决策步骤：
   ```
   [ark:runtime] [auto] Running AI decision step...
   ```
2. AI 根据 prompt 返回 JSON，框架根据 `outputBindings` 把值注入到 ctx：
   ```
   [ark:runtime] [auto] Set ctx.flags.city = "Chengdu"
   ```
3. `builtin/human-review` 步骤**自动跳过**（视为用户已通过）
4. `condition: "{{ ctx.mode == 'manual' }}"` 的步骤**不执行**

### 7.3 Dry-run 模式

```bash
ark run @ark/cli-weather-report --dry-run --city Beijing
```

**适用场景：** 调试 wiring plan，检查模板表达式是否写对，验证步骤顺序是否符合预期。

**执行过程：**

- 所有步骤**跳过实际执行**（不调用子进程，不发 API 请求）
- `builtin/human-review` 自动通过（不等待输入）
- 步骤的输出为空对象 `{}`
- 返回退出码 0

**注意：** dry-run 时模板表达式仍然会求值，但步骤本身不执行。如果模板引用了前一步的输出（而该步骤 dry-run 时输出为空），可能会得到 undefined，这是正常的。

---

## 第八章：错误处理与重试

### 8.1 三种失败策略

在 `ark-wiring.yaml` 里通过 `errorPolicy.onStepFailure` 配置：

**`abort`（终止，默认）**

```yaml
errorPolicy:
  onStepFailure: abort
```

任意步骤失败 → 立即停止整条流水线，打印错误，退出码 1。

**`continue`（跳过，继续）**

```yaml
errorPolicy:
  onStepFailure: continue
```

步骤失败 → 打印警告，该步骤输出为空对象 `{}`，继续执行下一步。

适合"失败了也没关系"的场景，比如可选的通知步骤。

**`retry`（重试）**

```yaml
errorPolicy:
  onStepFailure: retry
  retryPolicy:
    maxAttempts: 3      # 最多尝试 3 次（包括第一次）
    backoffMs: 2000     # 基础等待时间：2 秒
    jitter: true        # 加随机抖动
```

失败后按以下间隔重试：
- 第 1 次失败 → 等约 2 秒 → 重试
- 第 2 次失败 → 等约 4 秒 → 重试
- 第 3 次仍失败 → 按 `abort` 处理

`jitter: true` 会在等待时间上加一个随机量，避免多个并发任务同时重试冲击下游服务。

### 8.2 运行时日志

框架向 stderr 输出详细日志，方便调试：

```
[ark:runtime] Starting pipeline "@ark/cli-weather-report" (mode=manual, dryRun=false, runId=abc-123)
[ark:runtime] Running step "fetch-weather" (uses=@ark/cli-weather)...
[ark:runtime] Step "fetch-weather" completed.
[ark:runtime] Skipping step "review" (condition evaluated to false).
[ark:runtime] Running step "generate" (uses=@ark/cli-report)...
[ark:runtime] Step "generate" failed. Retrying (attempt 2/3)...
[ark:runtime] Step "generate" completed.
[ark:runtime] Pipeline completed successfully.
```

### 8.3 退出码

| 退出码 | 含义 |
|--------|------|
| `0` | 所有步骤成功完成 |
| `1` | 运行出错（步骤失败、YAML 解析错误、找不到工具等） |
| `2` | 用户在 human-review 步骤选择了 `n`（取消） |

---

## 第九章：用 AI Composer 自动生成 Wiring Plan

手写 wiring plan 有一定门槛。Ark 内置了一个 Composer，你只需要用自然语言描述"想做什么"，AI 帮你生成 wiring plan 草稿。

### 9.1 编写 ComposeRequest

创建一个 `compose-request.yaml`：

```yaml
apiVersion: ark/v1
kind: ComposeRequest

# 要生成的新 CLI 的基本信息
output:
  id: "@my-org/cli-weather-report"
  displayName: "Weather Daily Report"
  description: "获取天气并用 AI 生成中文日报"
  targetDirectory: "packages/cli-weather-report"

# 要组合哪些已有的工具
parents:
  - id: "@ark/cli-weather"
  - id: "@ark/cli-report"

# 用自然语言描述你想要的效果
intent: |
  创建一个 CLI，先获取指定城市的天气数据，然后用 AI 生成一份中文天气日报。
  支持 manual 模式（生成报告前人工审核天气数据）和 auto 模式（AI 自动选择城市和风格，全程无需人工干预）。

# 额外约束（可选）
constraints:
  - "manual 模式下，在生成报告前必须有 human-review 步骤"
  - "auto 模式下，AI 应自动选择一个有趣的中国城市"
  - "支持 --city 和 --style 两个命令行标志"
  - "失败时重试最多 3 次，启用 jitter"
```

### 9.2 组合流程

Composer 的工作流程：

```
你的 compose-request.yaml
        │
        ▼
Composer 读取所有父 CLI 的 ark-descriptor.yaml
（了解它们的输入、输出、命令、环境变量）
        │
        ▼
调用 Claude，生成 wiring plan 草稿
        │
        ▼
展示给你审核：
  "Here is the proposed wiring plan: ..."
  Accept? [y]es / [n]o (provide feedback)
        │
   ┌────┴────┐
   │         │
   y         n → 你输入修改意见 → 重新生成
   │
   ▼
脚手架生成新 package：
  packages/cli-weather-report/
  ├── ark-descriptor.yaml   （带完整 lineage）
  ├── ark-wiring.yaml        （AI 生成的接线图）
  ├── src/index.ts           （标准入口）
  ├── package.json
  └── tsconfig.json
```

### 9.3 生成后的文件结构

Composer 生成的 `ark-descriptor.yaml` 会包含完整的溯源信息：

```yaml
lineage:
  kind: composed
  createdAt: "2025-03-27T00:00:00+00:00"
  parents:
    - id: "@ark/cli-weather"
      version: "0.1.0"
      descriptorHash: "sha256:abc123..."   # 父工具 descriptor 的哈希，用于检测父工具是否有更新
    - id: "@ark/cli-report"
      version: "0.1.0"
      descriptorHash: "sha256:def456..."
  aiPrompt: |
    你写的 intent 和 constraints...
  aiProposal: |
    AI 对这个接线方案的说明...
  approvedWiringRef: "ark-wiring.yaml"
  humanEdits: ""    # 如果你后来手动改了 wiring plan，在这里记录改了什么
```

### 9.4 生成后手动调整

生成的 wiring plan 是草稿，你可以直接编辑 `ark-wiring.yaml`：

- 调整步骤顺序
- 修改模板表达式
- 添加 condition 条件
- 调整 errorPolicy
- 修改 autoMode 的 prompt

改完后建议在 `lineage.humanEdits` 字段记录改了什么，方便以后追溯。

---

## 附录：YAML 字段速查表

### ark-descriptor.yaml 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `apiVersion` | string | 是 | 固定 `ark/v1` |
| `kind` | string | 是 | 固定 `CliDescriptor` |
| `functional.id` | string | 是 | npm 包名，如 `@my-org/cli-name` |
| `functional.version` | string | 是 | semver，如 `0.1.0` |
| `functional.displayName` | string | 是 | 展示名称 |
| `functional.description` | string | 是 | 工具描述 |
| `functional.entrypoint` | string | 是 | 入口文件相对路径，如 `dist/index.js` |
| `functional.modes` | string[] | 是 | 支持的模式，可含 `auto`、`manual` |
| `functional.inputs` | Port[] | 否 | 输入端口定义 |
| `functional.outputs` | Port[] | 否 | 输出端口定义 |
| `functional.commands` | Command[] | 否 | 子命令定义 |
| `functional.env` | EnvVar[] | 否 | 环境变量声明 |
| `lineage.kind` | string | 是 | `leaf` 或 `composed` |
| `lineage.createdAt` | string | 是 | ISO 8601 时间戳 |
| `lineage.parents` | Parent[] | 否 | 父工具列表（composed 才有） |

### ark-wiring.yaml 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `apiVersion` | string | 是 | 固定 `ark/v1` |
| `kind` | string | 是 | 固定 `WiringPlan` |
| `pipeline.mode` | string | 是 | 目前只支持 `sequential` |
| `steps` | Step[] | 是 | 步骤列表 |
| `steps[].id` | string | 是 | 步骤唯一标识符 |
| `steps[].uses` | string | 是 | 工具包名或内置步骤 |
| `steps[].command` | string | 否 | 子命令名 |
| `steps[].condition` | string | 否 | 模板表达式，为假时跳过 |
| `steps[].inputs` | object | 否 | 输入键值对，值可用模板表达式 |
| `steps[].outputs.bind` | object | 否 | 输出绑定到上下文的映射 |
| `errorPolicy.onStepFailure` | string | 否 | `abort`、`continue`、`retry` |
| `errorPolicy.retryPolicy.maxAttempts` | number | 否 | 最大重试次数 |
| `errorPolicy.retryPolicy.backoffMs` | number | 否 | 基础等待毫秒数 |
| `errorPolicy.retryPolicy.jitter` | boolean | 否 | 是否加随机抖动 |
| `autoMode.decisionStep.before` | string | 否 | 在哪个步骤前插入 AI 决策 |
| `autoMode.decisionStep.prompt` | string | 否 | 发给 AI 的提示词 |
| `autoMode.decisionStep.outputBindings` | object | 否 | AI 输出 → ctx 路径映射 |
| `flags` | Flag[] | 否 | 这个 CLI 支持的命令行标志 |

### 内置步骤速查

| 步骤 | 必填输入 | 输出字段 | 说明 |
|------|----------|----------|------|
| `builtin/human-review` | `payload` | `approved` | 展示数据等待人工审核 |
| `builtin/log` | `message` | （无） | 打印消息到 stdout |
| `builtin/conditional` | `condition`, `value` | `value` | 条件传值 |

### ark 命令速查

| 命令 | 说明 |
|------|------|
| `ark list` | 列出所有 CLI |
| `ark describe <id>` | 查看 CLI 详情 |
| `ark validate <id>` | 验证 YAML schema |
| `ark lineage <id>` | 显示溯源树 |
| `ark run <id> [flags]` | 执行 Composed CLI |
| `ark run <id> --auto` | 自动模式 |
| `ark run <id> --dry-run` | 预览模式 |
