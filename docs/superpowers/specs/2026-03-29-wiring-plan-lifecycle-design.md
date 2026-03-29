# WiringPlan Lifecycle & Branching Extension — Design Spec

**Date:** 2026-03-29
**Status:** Approved

---

## Problem

`WiringPlan.pipeline.mode` currently accepts only `sequential` and `dag`. Both are **finite** execution models — the pipeline exits when all steps complete. This leaves two important task patterns unrepresented:

1. **Streaming** — a leaf CLI runs indefinitely (or until a condition), emitting events that trigger downstream steps on each event (e.g. exchange trade feed).
2. **Conditional routing** — within a sequential pipeline, the result of one step determines which subsequent steps execute (if/else between leaf CLIs).

---

## Design

### 1. Schema Changes

`pipeline.mode` is **renamed** to `pipeline.topology` and **separated** from a new `pipeline.lifecycle` field. These are orthogonal dimensions:

| Field | Values | Meaning |
|---|---|---|
| `topology` | `sequential \| dag` | How steps depend on each other |
| `lifecycle` | `finite \| streaming` | How long the pipeline runs |

**Backward compatibility:** The old `mode` field remains valid. Runtime maps `mode → topology` automatically and emits a deprecation warning. `lifecycle` defaults to `finite`.

```yaml
pipeline:
  topology: sequential | dag      # replaces "mode"
  lifecycle: finite | streaming   # new, defaults to finite
  concurrency: 4                  # unchanged
```

---

### 2. Streaming Lifecycle

When `lifecycle: streaming`, the first step's leaf CLI is treated as a **long-running event source**. Runtime holds the process open and reads its stdout line by line (each line must be a valid JSON object). Each received line triggers one execution cycle of the remaining steps.

**Configuration block** (only read when `lifecycle: streaming`):

```yaml
streaming:
  until: "2026-12-31T00:00:00Z"             # optional ISO8601; omit = run forever
  stopOn: "{{ ctx.bindings.tick.price > 100000 }}"  # optional template expression
  restartOnFailure: true                    # optional, default false
```

**Termination conditions** (evaluated in order, first match wins):
1. `until` datetime reached
2. `stopOn` expression evaluates to true after an event cycle
3. SIGTERM / SIGINT received by the ark process

**`restartOnFailure`**: if the source CLI process crashes, runtime restarts it. Without this, a crash terminates the pipeline.

**Output binding**: the source step's `outputs.bind` maps each event's fields into `ctx.bindings`, available to all downstream steps in that cycle.

**`errorPolicy` in streaming context**: `onStepFailure: continue` is recommended — a bad event should not kill the whole pipeline.

---

### 3. `builtin/branch` Step

A new builtin step type for **conditional routing within sequential pipelines**.

```yaml
- id: route
  uses: builtin/branch
  inputs:
    routes:
      - condition: "{{ ctx.bindings.score > 0.8 }}"
        next: publish
      - condition: "{{ ctx.bindings.score <= 0.8 }}"
        next: review
    default: review   # optional; if omitted and no condition matches, pipeline ends normally
```

**Runtime behavior:**
- Routes are evaluated in order; first matching `condition` wins.
- Execution jumps to the `next` step id; all steps between the branch and `next` are skipped silently.
- `next` must be a step id within the same wiring plan.
- If no condition matches and `default` is absent, pipeline ends normally (not an error).

**Constraint:** `builtin/branch` is only meaningful under `topology: sequential`. In `dag` mode, conditional execution is handled per-step via the existing `condition` field — there is no linear order to jump within.

---

### 4. Complete Examples

#### Example A — Streaming exchange feed

```yaml
apiVersion: ark/v1
kind: WiringPlan

pipeline:
  topology: sequential
  lifecycle: streaming
  streaming:
    until: "2026-12-31T00:00:00Z"
    stopOn: "{{ ctx.bindings.tick.price > 100000 }}"
    restartOnFailure: true

steps:
  - id: feed
    uses: "@ark/cli-exchange"
    command: watch
    outputs:
      bind:
        tick: "."

  - id: store
    uses: "@ark/cli-db-writer"
    inputs:
      record: "{{ ctx.bindings.tick }}"

  - id: alert
    uses: builtin/log
    condition: "{{ ctx.bindings.tick.price > 50000 }}"
    inputs:
      message: "Price alert: {{ ctx.bindings.tick.price }}"

errorPolicy:
  onStepFailure: continue
```

#### Example B — Content moderation routing

```yaml
apiVersion: ark/v1
kind: WiringPlan

pipeline:
  topology: sequential
  lifecycle: finite

steps:
  - id: analyze
    uses: "@ark/cli-analyzer"
    outputs:
      bind:
        score: result.score

  - id: route
    uses: builtin/branch
    inputs:
      routes:
        - condition: "{{ ctx.bindings.score > 0.8 }}"
          next: publish
        - condition: "{{ ctx.bindings.score <= 0.8 }}"
          next: review
      default: review

  - id: publish
    uses: "@ark/cli-publisher"
    inputs:
      content: "{{ ctx.bindings.content }}"

  - id: review
    uses: builtin/human-review
    inputs:
      payload: "{{ ctx.bindings.content }}"
```

---

## Out of Scope

- **Multi-round interactive steps** — encapsulated inside the leaf CLI itself; ark does not model the conversation loop.
- **External sub-pipeline refs in branching** — `next` points to a step id in the same file, not an external wiring yaml.
- **`builtin/branch` in DAG mode** — not supported; use per-step `condition` instead.
- **Cron/scheduled lifecycle** — not part of this iteration.

---

## Affected Files

| File | Change |
|---|---|
| `packages/core/src/schemas.ts` | Add `topology`, `lifecycle`, `streaming` to `WiringPlanSchema`; deprecate `mode` |
| `packages/runtime/src/pipeline-runner.ts` | Handle `lifecycle: streaming` execution loop; map deprecated `mode` |
| `packages/runtime/src/builtin-steps.ts` | Add `branch()` builtin |
| `packages/runtime/src/step-resolver.ts` | Route `builtin/branch` to new handler |
