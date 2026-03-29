# 并行执行与可观测性设计

**日期：** 2026-03-28  
**状态：** 已批准  
**范围：** DAG 执行、扇出/扇入、并发控制、步骤超时、并行错误策略、TTY 面板 + 结构化日志可观测性、Composer 对并行的感知

---

## 1. 目标

- 让无数据依赖的步骤可以并发运行（DAG 模式）
- 让单个步骤可以并发处理数组中的每一项（扇出/扇入）
- 让运维人员能控制每步的并发上限与超时
- 在终端（TTY）与结构化日志（非 TTY）中展示实时执行状态
- 在实时面板中展示血缘深度，便于看到哪些叶子 CLI 及其父级正在运行
- 让 Composer 识别可并行机会，并提示用户选择错误处理偏好

---

## 2. Schema 变更（`packages/core/src/schemas.ts`）

### 2.1 Pipeline 级别新增

```yaml
pipeline:
  mode: sequential | dag      # 移除 "parallel" —— 由 DAG 统一表达
  concurrency: 3              # 同时运行的最大步骤数（默认：不限制）
```

`concurrency` 对整个 pipeline 生效。`parallel-map` 有各自的每步并发（见 §2.3）。

### 2.2 Step 级别新增

```yaml
steps:
  - id: fetch-weather
    timeout: "30s"            # 可选；带单位的字符串（s、m）。默认：无
    dependsOn: [step-a]       # 可选；手动覆盖依赖关系
    # 其余现有字段不变
```

**`timeout`** — 接受的单位：`s`（秒）、`m`（分钟）。在加载时解析。步骤超时时会终止子进程（SIGTERM → 2 秒后 SIGKILL），该步骤视为失败，并受 `errorPolicy` 约束。

**`dependsOn`** — 步骤 ID 列表。与推断出的依赖合并（取并集，不替换）。用于表达没有数据绑定但仍需顺序的约束（例如副作用顺序）。

### 2.3 并行错误行为

```yaml
errorPolicy:
  onStepFailure: abort | continue | retry
  parallelBehavior: failFast | waitAll   # 默认：failFast
  retryPolicy:
    maxAttempts: 3
    backoffMs: 2000
    jitter: true
```

`parallelBehavior` 仅在两个及以上步骤并发运行时生效。

- **`failFast`** — 任一并发步骤一旦失败，立即向其余进行中的步骤发送取消信号（SIGTERM），再对 pipeline 应用 `onStepFailure`。
- **`waitAll`** — 等待所有并发步骤结束（成功或失败）后再汇总。若有失败且 `onStepFailure: abort`，则在全部结束后判定 pipeline 失败。

### 2.4 新内置步骤：`parallel-map`

```yaml
- id: fetch-all-cities
  uses: builtin/parallel-map
  inputs:
    items: "{{ ctx.flags.cities }}"   # 必须解析为数组
    step: "@ark/cli-weather"          # 每项要调用的 CLI
    command: fetch                    # 可选子命令
    inputKey: city                    # 每次调用注入的字段名
    concurrency: 5                    # 最大并行调用数（默认：不限制）
  outputs:
    bind:
      allWeather: results             # 各次调用输出的数组
```

`items` 中每一项通过标准 `ARK_INPUT_PAYLOAD` 协议以 `{ [inputKey]: item }` 传给指定 CLI。结果按顺序收集到 `results`。若某次调用失败，行为由 `parallelBehavior` 决定（与 pipeline 级别一致）。

---

## 3. DAG 依赖解析（`packages/runtime/src/pipeline-runner.ts`）

### 3.1 推断算法

在 pipeline 加载时（第一步运行之前）：

1. 对每个步骤，从其 `inputs` 的值中递归扫描模板，提取所有 `{{ ctx.bindings.<name> }}` 引用。
2. 对每个被引用的绑定名，找到声明了 `outputs.bind.<name>` 的步骤。
3. 该步骤成为推断依赖。
4. 与显式 `dependsOn` 合并。
5. 对所得图做拓扑排序。若存在环，在加载时抛出 `ValidationError`。

### 3.2 执行循环

```
ready_queue = 无未满足依赖的步骤
running = {}

while ready_queue 或 running 非空:
  在并发上限内从 ready_queue 填充 running
  等待任一 running 中的步骤结束
  将已结束的步骤标为完成/失败
  对每个 dependsOn 已全部完成的步骤 → 加入 ready_queue
  按 parallelBehavior 处理失败
```

`sequential` 模式保持不变 —— 仍为简单顺序循环，不使用 DAG 引擎。

### 3.3 上下文安全

`PipelineContext.bindings` 改为按 key 加锁的 `Map`。某步骤写入绑定 `foo` 时，会阻塞对 `foo` 的并发读，直到写完成。实践中 DAG 保证读者只在写者结束后启动，但锁可防止手动 `dependsOn` 配置错误导致的竞态。

---

## 4. 可观测性（`packages/runtime/src/display.ts`）

新文件。运行时根据 `process.stdout.isTTY` 选择展示方式。

### 4.1 TTY：实时面板

使用 ANSI 光标控制渲染（无外部依赖）。每 100ms 刷新一次。

```
Pipeline: @ark/cli-weather-report  [running]  12.3s

  ◆ fetch-weather      [running]  8.1s
    ◇ @ark/cli-weather [running]         GET wttr.in/Shanghai
      ◇ cli-wttr-base  [done]     0.3s  (lineage)
  ◆ fetch-news         [done]     2.3s  ✓
    ◇ @ark/cli-news    [done]     2.3s
  ◆ review             [waiting]        deps: fetch-weather
  ◆ generate           [pending]
```

**血缘行** — 当叶子 CLI 带有 `lineage.parents` 时，每个父级再缩进一层，显示 `(lineage)` 标签及各自状态/耗时。父级在面板初始化时从本地 `ark-descriptor.yaml` 解析。若本地找不到父级，静默省略该行。

**步骤状态与颜色：**

| 状态 | 颜色 | 含义 |
|------|------|------|
| `pending` | 暗淡 | 尚未开始 |
| `waiting` | 黄色 | 依赖未满足 |
| `running` | 青色 | 正在执行 |
| `done` | 绿色 | 成功结束 |
| `failed` | 红色 | 失败（含错误摘要） |
| `skipped` | 暗淡 | 条件为假被跳过 |
| `cancelled` | 黄色 | 因 failFast 被取消 |

**结束时**，面板定格，光标恢复到面板下方。SIGINT 不做清理 —— 保留部分状态可见。

### 4.2 非 TTY：结构化日志流

每个事件一行类 JSON 文本，写入 stderr。格式示例：

```
[ark][pipeline] start  runId=abc-123  mode=dag  steps=4
[ark][step:fetch-weather] start  uses=@ark/cli-weather  deps=[]
[ark][step:fetch-news] start  uses=@ark/cli-news  deps=[]
[ark][step:fetch-weather][lineage:cli-wttr-base] start
[ark][step:fetch-weather][lineage:cli-wttr-base] done  elapsed=0.3s
[ark][step:fetch-weather] done  elapsed=8.1s
[ark][step:fetch-news] done  elapsed=2.3s
[ark][step:review] start  uses=builtin/human-review  deps=[fetch-weather,fetch-news]
[ark][step:generate] start  uses=@ark/cli-report
[ark][step:generate] done  elapsed=4.1s
[ark][pipeline] done  elapsed=15.2s
```

过滤示例：

```bash
ark run ... 2>&1 | grep "\[step:fetch-weather\]"
ark run ... 2>&1 | grep "failed"
```

### 4.3 步骤耗时

每个步骤记录 `startedAt` 与 `endedAt`（Unix 毫秒）。Pipeline 结束时，两种模式都会输出一行汇总：

```
Step timing summary:
  fetch-weather   8.1s
  fetch-news      2.3s
  review          3.0s  (human input)
  generate        4.1s
  ─────────────────────
  total wall time 15.2s  (sequential would have been 17.5s)
```

「若顺序执行约需」的数值为各步骤耗时之和，用于对比。

---

## 5. Composer 对并行的感知（`packages/composer/src/ai-planner-session.ts`）

在 AI 返回 wiring plan 草稿之后、展示给用户审阅之前：

1. 对草稿运行相同的 DAG 推断算法。
2. 若有两个及以上步骤彼此无依赖（在 DAG 模式下会并发），且计划的 `pipeline.mode` 尚不是 `dag`：
   - 注入结构化提示，询问用户关于并行的选择。
   - 根据下游是否都需要全部结果给出建议。

```
以下步骤之间没有数据依赖，可以并行执行：
  - fetch-weather
  - fetch-news
  - fetch-stock-price

并发运行可将墙钟时间从约 18s 降至约 8s。

建议：failFast —— 下游会用到这三个结果，
任一步失败则 pipeline 本身也无法继续。

是否要为这些步骤启用并行执行？
  [1] 是，使用 DAG 模式 + failFast（推荐）
  [2] 是，使用 DAG 模式 + waitAll
  [3] 否，保持顺序执行
```

若用户选择 1 或 2，脚手架生成的 `ark-wiring.yaml` 将包含：

```yaml
pipeline:
  mode: dag
errorPolicy:
  parallelBehavior: failFast   # 或 waitAll
```

---

## 6. 错误处理细节

### 超时流程

1. 步骤开始，计时启动。
2. 超时触发 → 向子进程发送 SIGTERM。
3. 等待 2s 优雅退出。
4. 若仍在运行 → 发送 SIGKILL。
5. 步骤记为失败，`reason: timeout`。
6. 应用 `errorPolicy.onStepFailure`。

### failFast 取消流程

1. 步骤 A 失败时，步骤 B、C 仍在运行。
2. 向 B、C 发送 SIGTERM。
3. 最多等待 5s 优雅退出；其余 SIGKILL。
4. 将 B、C 标为 `cancelled`。
5. 对 pipeline 应用 `onStepFailure`（abort/continue/retry 针对步骤 A 的失败）。

### parallel-map 部分失败

- `failFast`：首个条目失败会取消其余进行中的调用。
- `waitAll`：所有条目跑完；`results` 中失败项为 `null`；若有任一失败，步骤整体标为失败。

---

## 7. 涉及文件

| 文件 | 变更 |
|------|------|
| `packages/core/src/schemas.ts` | 在 schema 中增加 `concurrency`、`timeout`、`dependsOn`、`parallelBehavior` |
| `packages/runtime/src/pipeline-runner.ts` | DAG 推断、并发调度循环、上下文加锁 |
| `packages/runtime/src/builtin-steps.ts` | 新增 `parallel-map` |
| `packages/runtime/src/step-resolver.ts` | 超时（SIGTERM/SIGKILL）、取消信号 |
| `packages/runtime/src/display.ts` | **新文件** — TTY 面板 + 结构化日志、血缘解析 |
| `packages/runtime/src/index.ts` | 导出 display 工具 |
| `packages/composer/src/ai-planner-session.ts` | 生成后并行检测 + 用户提示 |

---

## 8. 非目标

- 流式步骤输出（需改 I/O 协议）
- 远程/分布式执行
- 步骤级错误策略覆盖（仅全局策略）
- Web UI 或外部仪表盘
- 指标导出（Prometheus、OpenTelemetry）
