# Parallel Execution & Observability Design

**Date:** 2026-03-28
**Status:** Approved
**Scope:** DAG execution, fan-out/fan-in, concurrency control, step timeout, parallel error policy, TTY panel + structured log observability, Composer parallel awareness

---

## 1. Goals

- Enable steps with no data dependency to run concurrently (DAG mode)
- Enable a single step to process an array of items concurrently (fan-out/fan-in)
- Give operators control over concurrency limits and timeout per step
- Surface real-time execution state in terminal (TTY) and structured logs (non-TTY)
- Show lineage depth in the live panel so operators can see which leaf CLIs and their parents are active
- Make Composer aware of parallelism opportunities and prompt the user for error behavior preference

---

## 2. Schema Changes (`packages/core/src/schemas.ts`)

### 2.1 Pipeline-level additions

```yaml
pipeline:
  mode: sequential | dag      # "parallel" removed — DAG subsumes it
  concurrency: 3              # max steps running at once (default: unlimited)
```

`concurrency` applies globally to the pipeline. `parallel-map` has its own per-step concurrency (see §2.3).

### 2.2 Step-level additions

```yaml
steps:
  - id: fetch-weather
    timeout: "30s"            # optional; string with unit (s, m). default: none
    dependsOn: [step-a]       # optional; manual dependency override
    # all existing fields unchanged
```

**`timeout`** — accepted units: `s` (seconds), `m` (minutes). Parsed at load time. When a step exceeds its timeout, its child process is killed (SIGTERM → SIGKILL after 2s), and the step is treated as failed, subject to `errorPolicy`.

**`dependsOn`** — list of step IDs. Merged with inferred dependencies (union, not replacement). Allows expressing ordering constraints that have no data binding (e.g., side-effect ordering).

### 2.3 Parallel error behavior

```yaml
errorPolicy:
  onStepFailure: abort | continue | retry
  parallelBehavior: failFast | waitAll   # default: failFast
  retryPolicy:
    maxAttempts: 3
    backoffMs: 2000
    jitter: true
```

`parallelBehavior` only applies when two or more steps are running concurrently.

- **`failFast`** — as soon as any concurrent step fails, signal cancellation to all other in-flight steps (SIGTERM), then apply `onStepFailure` to the pipeline.
- **`waitAll`** — wait for all concurrent steps to settle (success or failure), then report. If any failed and `onStepFailure: abort`, the pipeline fails after all have settled.

### 2.4 New builtin step: `parallel-map`

```yaml
- id: fetch-all-cities
  uses: builtin/parallel-map
  inputs:
    items: "{{ ctx.flags.cities }}"   # must resolve to an array
    step: "@ark/cli-weather"          # CLI to invoke per item
    command: fetch                    # optional subcommand
    inputKey: city                    # field name injected into each invocation
    concurrency: 5                    # max parallel invocations (default: unlimited)
  outputs:
    bind:
      allWeather: results             # array of each invocation's output
```

Each item in `items` is passed to the named CLI as `{ [inputKey]: item }` via the standard `ARK_INPUT_PAYLOAD` protocol. Results are collected in order into `results`. If any invocation fails, `parallelBehavior` governs behavior (same as pipeline-level).

---

## 3. DAG Dependency Resolution (`packages/runtime/src/pipeline-runner.ts`)

### 3.1 Inference algorithm

At pipeline load time (before first step runs):

1. For each step, extract all `{{ ctx.bindings.<name> }}` references from its `inputs` values (recursive template scan).
2. For each referenced binding name, find the step that declares `outputs.bind.<name>`.
3. That step becomes an inferred dependency.
4. Merge with any explicit `dependsOn` entries.
5. Topological sort the resulting graph. Cycle detection throws `ValidationError` at load time.

### 3.2 Execution loop

```
ready_queue = steps with no unmet dependencies
running = {}

while ready_queue or running:
  fill running from ready_queue up to concurrency limit
  wait for any running step to settle
  mark settled step done/failed
  for each step whose dependsOn are now all done → add to ready_queue
  handle failure per parallelBehavior
```

`sequential` mode is unchanged — it remains a simple ordered loop and does not use the DAG engine.

### 3.3 Context safety

`PipelineContext.bindings` becomes a `Map` guarded by a per-key lock. A step writing binding `foo` blocks any concurrent reader of `foo` until the write completes. In practice, the DAG ensures readers only start after writers finish, but the lock prevents races from manual `dependsOn` misconfiguration.

---

## 4. Observability (`packages/runtime/src/display.ts`)

New file. Selected at runtime by `process.stdout.isTTY`.

### 4.1 TTY: live panel

Rendered using ANSI cursor control (no external dependency). Refreshes at 100ms intervals.

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

**Lineage rows** — when a leaf CLI has `lineage.parents`, each parent is shown indented one level deeper with a `(lineage)` label and its own status/elapsed. Parents are resolved from their local `ark-descriptor.yaml` at panel init time. If a parent is not found locally, the row is omitted silently.

**Step states and colors:**

| State | Color | Meaning |
|-------|-------|---------|
| `pending` | dim | Not yet started |
| `waiting` | yellow | Dependencies not yet met |
| `running` | cyan | Actively executing |
| `done` | green | Completed successfully |
| `failed` | red | Failed (with error summary) |
| `skipped` | dim | Condition evaluated false |
| `cancelled` | yellow | Cancelled due to failFast |

**On completion**, the panel freezes and the cursor is restored below it. No cleanup on SIGINT — the partial state is left visible.

### 4.2 Non-TTY: structured log stream

One JSON-ish line per event, written to stderr. Format:

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

Filtering examples:
```bash
ark run ... 2>&1 | grep "\[step:fetch-weather\]"
ark run ... 2>&1 | grep "failed"
```

### 4.3 Step timing

Every step records `startedAt` and `endedAt` (Unix ms). On pipeline completion, a summary line is emitted in both modes:

```
Step timing summary:
  fetch-weather   8.1s
  fetch-news      2.3s
  review          3.0s  (human input)
  generate        4.1s
  ─────────────────────
  total wall time 15.2s  (sequential would have been 17.5s)
```

The "sequential would have been" figure is sum of all step durations, for comparison.

---

## 5. Composer Parallel Awareness (`packages/composer/src/ai-planner-session.ts`)

After the AI returns a wiring plan draft, before showing it to the user for review:

1. Run the same DAG inference algorithm on the draft plan.
2. If two or more steps have no dependency between them (would run concurrently in DAG mode), and the plan's `pipeline.mode` is not already `dag`:
   - Inject a structured prompt asking the user about parallelism.
   - Present the recommendation based on whether all results are required.

```
I noticed these steps have no data dependency and could run in parallel:
  - fetch-weather
  - fetch-news
  - fetch-stock-price

Running them concurrently would reduce wall time from ~18s to ~8s.

Recommendation: failFast — all three results are used downstream,
so if any fails the pipeline can't continue anyway.

Would you like to enable parallel execution for these steps?
  [1] Yes, use DAG mode with failFast (recommended)
  [2] Yes, use DAG mode with waitAll
  [3] No, keep sequential
```

If the user selects 1 or 2, the scaffolded `ark-wiring.yaml` will include:
```yaml
pipeline:
  mode: dag
errorPolicy:
  parallelBehavior: failFast   # or waitAll
```

---

## 6. Error Handling Details

### Timeout flow
1. Step starts, timer begins.
2. Timeout fires → send SIGTERM to child process.
3. Wait 2s for graceful exit.
4. If still running → send SIGKILL.
5. Step recorded as failed with `reason: timeout`.
6. Apply `errorPolicy.onStepFailure`.

### failFast cancellation flow
1. Step A fails while steps B and C are running.
2. Send SIGTERM to B and C.
3. Wait up to 5s for graceful exit; SIGKILL remainder.
4. Mark B and C as `cancelled`.
5. Apply `onStepFailure` to the pipeline (abort/continue/retry applies to step A's failure).

### parallel-map partial failure
- `failFast`: first item failure cancels remaining in-flight invocations.
- `waitAll`: all items run to completion; `results` array contains `null` for failed items; step itself is marked failed if any item failed.

---

## 7. Files Changed

| File | Change |
|------|--------|
| `packages/core/src/schemas.ts` | Add `concurrency`, `timeout`, `dependsOn`, `parallelBehavior` to schemas |
| `packages/runtime/src/pipeline-runner.ts` | DAG inference, concurrent scheduling loop, context locking |
| `packages/runtime/src/builtin-steps.ts` | Add `parallel-map` |
| `packages/runtime/src/step-resolver.ts` | Timeout support (SIGTERM/SIGKILL), cancellation signal |
| `packages/runtime/src/display.ts` | **New file** — TTY panel + structured log, lineage resolution |
| `packages/runtime/src/index.ts` | Export display utilities |
| `packages/composer/src/ai-planner-session.ts` | Post-generation parallel detection + user prompt |

---

## 8. Out of Scope

- Streaming step output (requires I/O protocol change)
- Remote/distributed execution
- Step-level error policy override (global policy only)
- Web UI or external dashboard
- Metrics export (Prometheus, OpenTelemetry)
