# Parallel Execution & Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DAG-mode parallel pipeline execution, fan-out/fan-in via `builtin/parallel-map`, step timeouts, parallel error behavior, and a live TTY panel + structured log observability system to the Ark runtime.

**Architecture:** Extend `PipelineRunner` with a DAG inference pass that builds a dependency graph from `ctx.bindings.*` references and explicit `dependsOn` fields, then drives a concurrent scheduling loop. A new `display.ts` module selects TTY panel vs. structured log output at runtime based on `process.stdout.isTTY`. The Composer's `AiPlannerSession` gains a post-generation parallel-detection step that prompts the user for error behavior preference.

**Tech Stack:** TypeScript, Node.js `AbortController` (cancellation), `execa` (already in use), ANSI escape codes (TTY panel, no extra dep), `js-yaml` (already in use), `zod` (already in use).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/core/src/schemas.ts` | Add `timeout`, `dependsOn`, `concurrency`, `parallelBehavior` to Zod schemas |
| Create | `packages/runtime/src/dag.ts` | Dependency inference, topological sort, cycle detection |
| Create | `packages/runtime/src/display.ts` | TTY live panel + structured log emitter |
| Create | `packages/runtime/src/scheduler.ts` | Concurrent step scheduling loop with cancellation |
| Modify | `packages/runtime/src/pipeline-runner.ts` | Wire DAG + scheduler for `mode: dag`; keep sequential path unchanged |
| Modify | `packages/runtime/src/builtin-steps.ts` | Add `parallelMap` builtin |
| Modify | `packages/runtime/src/step-resolver.ts` | Register `builtin/parallel-map`; add timeout + cancellation to child execution |
| Modify | `packages/runtime/src/child-cli-runner.ts` | Accept `AbortSignal`; implement SIGTERM → SIGKILL on abort |
| Modify | `packages/runtime/src/index.ts` | Export `Display`, `buildDag` |
| Modify | `packages/composer/src/ai-planner-session.ts` | Detect parallelizable steps post-generation; prompt user |
| Create | `packages/runtime/src/dag.test.ts` | Unit tests for DAG inference and topo sort |
| Create | `packages/runtime/src/display.test.ts` | Unit tests for structured log emitter (non-TTY path) |
| Create | `packages/runtime/src/scheduler.test.ts` | Unit tests for scheduler concurrency and cancellation |
| Modify | `packages/runtime/src/pipeline-runner.test.ts` | Integration tests for DAG mode, timeout, parallelBehavior |

---

## Task 1: Schema Extensions

**Files:**
- Modify: `packages/core/src/schemas.ts`

- [ ] **Step 1: Write the failing type-check test**

Add to `packages/core/src/schemas.test.ts` (create file if absent):

```typescript
import { describe, it, expect } from 'vitest'
import { WiringPlanSchema, WiringStepSchema, ErrorPolicySchema } from './schemas.js'

describe('schema extensions', () => {
  it('accepts timeout on a step', () => {
    const step = {
      id: 'fetch',
      uses: '@ark/cli-weather',
      timeout: '30s',
    }
    expect(() => WiringStepSchema.parse(step)).not.toThrow()
  })

  it('accepts dependsOn on a step', () => {
    const step = { id: 'b', uses: '@ark/cli-weather', dependsOn: ['a'] }
    expect(() => WiringStepSchema.parse(step)).not.toThrow()
  })

  it('accepts pipeline concurrency', () => {
    const plan = {
      apiVersion: 'ark/v1',
      kind: 'WiringPlan',
      pipeline: { mode: 'dag', concurrency: 3 },
      steps: [],
    }
    expect(() => WiringPlanSchema.parse(plan)).not.toThrow()
  })

  it('accepts parallelBehavior in errorPolicy', () => {
    const policy = { onStepFailure: 'abort', parallelBehavior: 'waitAll' }
    expect(() => ErrorPolicySchema.parse(policy)).not.toThrow()
  })

  it('rejects invalid timeout format', () => {
    const step = { id: 'x', uses: '@ark/cli-weather', timeout: '30x' }
    expect(() => WiringStepSchema.parse(step)).toThrow()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | head -40
```

Expected: test file not found or schema fields missing → test failures.

- [ ] **Step 3: Add fields to schemas.ts**

Open `packages/core/src/schemas.ts`. Find `WiringStepSchema` and add:

```typescript
// Add after the existing fields in WiringStepSchema:
timeout: z.string().regex(/^\d+[sm]$/).optional(),
// e.g. "30s", "2m"
dependsOn: z.array(z.string()).optional(),
```

Find `PipelineModeSchema` (or inline `mode` field) and change it to:

```typescript
// Replace existing mode field:
mode: z.enum(['sequential', 'dag']).default('sequential'),
concurrency: z.number().int().positive().optional(),
```

Find `ErrorPolicySchema` and add:

```typescript
parallelBehavior: z.enum(['failFast', 'waitAll']).default('failFast').optional(),
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | head -40
```

Expected: all new tests pass.

- [ ] **Step 5: Rebuild core**

```bash
cd packages/core && pnpm build
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/schemas.ts packages/core/src/schemas.test.ts
git commit -m "feat(core): add timeout, dependsOn, concurrency, parallelBehavior to schemas"
```

---

## Task 2: DAG Inference Engine

**Files:**
- Create: `packages/runtime/src/dag.ts`
- Create: `packages/runtime/src/dag.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/runtime/src/dag.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildDag, topoSort } from './dag.js'
import type { WiringStep } from '@ark/core'

const step = (id: string, inputs: Record<string, string> = {}, dependsOn?: string[]): WiringStep =>
  ({ id, uses: '@ark/cli-test', inputs, dependsOn } as WiringStep)

describe('buildDag', () => {
  it('infers dependency from ctx.bindings reference', () => {
    const steps = [
      step('a', {}, undefined),
      step('b', { data: '{{ ctx.bindings.aOut }}' }),
    ]
    // step a must declare outputs.bind.aOut for inference to work
    const stepsWithBindings = [
      { ...steps[0], outputs: { bind: { aOut: '.' } } },
      steps[1],
    ]
    const dag = buildDag(stepsWithBindings as WiringStep[])
    expect(dag.get('b')).toContain('a')
  })

  it('merges explicit dependsOn with inferred deps', () => {
    const steps = [
      step('a'),
      step('b'),
      step('c', {}, ['a']),
    ]
    const dag = buildDag(steps)
    expect(dag.get('c')).toContain('a')
    expect(dag.get('b')).toEqual([])
  })

  it('steps with no deps have empty array', () => {
    const steps = [step('a'), step('b')]
    const dag = buildDag(steps)
    expect(dag.get('a')).toEqual([])
    expect(dag.get('b')).toEqual([])
  })
})

describe('topoSort', () => {
  it('sorts so dependencies come before dependents', () => {
    const dag = new Map([
      ['a', []],
      ['b', ['a']],
      ['c', ['a', 'b']],
    ])
    const order = topoSort(dag)
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'))
  })

  it('throws on circular dependency', () => {
    const dag = new Map([
      ['a', ['b']],
      ['b', ['a']],
    ])
    expect(() => topoSort(dag)).toThrow('Circular dependency detected')
  })

  it('handles independent steps in any order', () => {
    const dag = new Map([['a', []], ['b', []], ['c', []]])
    const order = topoSort(dag)
    expect(order).toHaveLength(3)
    expect(order).toContain('a')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd packages/runtime && pnpm test -- dag --reporter=verbose 2>&1 | head -40
```

Expected: `Cannot find module './dag.js'`

- [ ] **Step 3: Implement dag.ts**

Create `packages/runtime/src/dag.ts`:

```typescript
import type { WiringStep } from '@ark/core'

/**
 * Build a dependency map: stepId → [stepIds it depends on]
 * Infers deps from ctx.bindings.* references in inputs,
 * merged with explicit dependsOn declarations.
 */
export function buildDag(steps: WiringStep[]): Map<string, string[]> {
  // Map: bindingName → stepId that produces it
  const bindingProducer = new Map<string, string>()
  for (const step of steps) {
    for (const key of Object.keys(step.outputs?.bind ?? {})) {
      bindingProducer.set(key, step.id)
    }
  }

  const dag = new Map<string, string[]>()

  for (const step of steps) {
    const deps = new Set<string>(step.dependsOn ?? [])

    // Scan all input values for {{ ctx.bindings.<name> }} references
    for (const val of Object.values(step.inputs ?? {})) {
      if (typeof val !== 'string') continue
      const matches = val.matchAll(/\{\{\s*ctx\.bindings\.(\w+)/g)
      for (const [, bindingName] of matches) {
        const producer = bindingProducer.get(bindingName)
        if (producer && producer !== step.id) {
          deps.add(producer)
        }
      }
    }

    dag.set(step.id, [...deps])
  }

  return dag
}

/**
 * Topological sort of step IDs.
 * Throws ValidationError if a cycle is detected.
 */
export function topoSort(dag: Map<string, string[]>): string[] {
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const result: string[] = []

  function visit(id: string) {
    if (visited.has(id)) return
    if (visiting.has(id)) {
      throw new Error(`Circular dependency detected: step "${id}" is part of a cycle`)
    }
    visiting.add(id)
    for (const dep of dag.get(id) ?? []) {
      visit(dep)
    }
    visiting.delete(id)
    visited.add(id)
    result.push(id)
  }

  for (const id of dag.keys()) {
    visit(id)
  }

  return result
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/runtime && pnpm test -- dag --reporter=verbose 2>&1 | head -60
```

Expected: all DAG tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/dag.ts packages/runtime/src/dag.test.ts
git commit -m "feat(runtime): add DAG dependency inference and topological sort"
```

---

## Task 3: Display Module (Observability)

**Files:**
- Create: `packages/runtime/src/display.ts`
- Create: `packages/runtime/src/display.test.ts`

- [ ] **Step 1: Write failing tests (non-TTY path only — TTY panel uses ANSI and is tested manually)**

Create `packages/runtime/src/display.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Display } from './display.js'

describe('Display structured log (non-TTY)', () => {
  let lines: string[]
  let display: Display

  beforeEach(() => {
    lines = []
    // Force non-TTY mode by passing isTTY: false
    display = new Display({ isTTY: false, write: (line) => lines.push(line) })
  })

  it('emits pipeline start', () => {
    display.pipelineStart({ runId: 'abc', mode: 'dag', stepCount: 3 })
    expect(lines[0]).toContain('[ark][pipeline] start')
    expect(lines[0]).toContain('runId=abc')
    expect(lines[0]).toContain('mode=dag')
  })

  it('emits step start with deps', () => {
    display.stepStart('fetch', '@ark/cli-weather', ['a', 'b'])
    expect(lines[0]).toContain('[step:fetch] start')
    expect(lines[0]).toContain('uses=@ark/cli-weather')
    expect(lines[0]).toContain('deps=[a,b]')
  })

  it('emits step done with elapsed', () => {
    display.stepDone('fetch', 1200)
    expect(lines[0]).toContain('[step:fetch] done')
    expect(lines[0]).toContain('elapsed=1.2s')
  })

  it('emits step failed', () => {
    display.stepFailed('fetch', new Error('timeout'), 1200)
    expect(lines[0]).toContain('[step:fetch] failed')
    expect(lines[0]).toContain('timeout')
  })

  it('emits pipeline done with timing summary', () => {
    display.pipelineDone(15200, [
      { id: 'fetch', elapsedMs: 8100 },
      { id: 'generate', elapsedMs: 4100 },
    ], 12200)
    expect(lines.some(l => l.includes('fetch'))).toBe(true)
    expect(lines.some(l => l.includes('15.2s'))).toBe(true)
  })

  it('emits lineage step', () => {
    display.lineageStep('fetch', '@ark/cli-wttr-base', 'done', 300)
    expect(lines[0]).toContain('[step:fetch][lineage:@ark/cli-wttr-base] done')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd packages/runtime && pnpm test -- display --reporter=verbose 2>&1 | head -30
```

Expected: `Cannot find module './display.js'`

- [ ] **Step 3: Implement display.ts**

Create `packages/runtime/src/display.ts`:

```typescript
export interface StepTiming {
  id: string
  elapsedMs: number
}

export interface DisplayOptions {
  isTTY?: boolean
  write?: (line: string) => void
}

export type StepState = 'pending' | 'waiting' | 'running' | 'done' | 'failed' | 'skipped' | 'cancelled'

interface StepRow {
  id: string
  uses: string
  state: StepState
  startedAt?: number
  elapsedMs?: number
  detail?: string
  deps: string[]
  lineage: Array<{ id: string; state: StepState; elapsedMs?: number }>
}

const STATE_COLOR: Record<StepState, string> = {
  pending:   '\x1b[2m',    // dim
  waiting:   '\x1b[33m',   // yellow
  running:   '\x1b[36m',   // cyan
  done:      '\x1b[32m',   // green
  failed:    '\x1b[31m',   // red
  skipped:   '\x1b[2m',    // dim
  cancelled: '\x1b[33m',   // yellow
}
const RESET = '\x1b[0m'

export class Display {
  private isTTY: boolean
  private write: (line: string) => void
  private rows: Map<string, StepRow> = new Map()
  private pipelineRunId = ''
  private pipelineMode = ''
  private timer?: ReturnType<typeof setInterval>

  constructor(opts: DisplayOptions = {}) {
    this.isTTY = opts.isTTY ?? (process.stdout.isTTY === true)
    this.write = opts.write ?? ((line) => process.stderr.write(line + '\n'))
  }

  // ── Pipeline lifecycle ────────────────────────────────────────

  pipelineStart(opts: { runId: string; mode: string; stepCount: number }) {
    this.pipelineRunId = opts.runId
    this.pipelineMode = opts.mode
    if (this.isTTY) {
      this.startPanel()
    } else {
      this.write(`[ark][pipeline] start  runId=${opts.runId}  mode=${opts.mode}  steps=${opts.stepCount}`)
    }
  }

  pipelineDone(wallMs: number, timings: StepTiming[], sequentialMs: number) {
    if (this.isTTY) {
      this.stopPanel()
      this.printTimingSummary(wallMs, timings, sequentialMs)
    } else {
      this.write(`[ark][pipeline] done  elapsed=${fmtMs(wallMs)}`)
      this.printTimingSummary(wallMs, timings, sequentialMs)
    }
  }

  pipelineFailed(wallMs: number, err: Error) {
    if (this.isTTY) this.stopPanel()
    this.write(`[ark][pipeline] failed  elapsed=${fmtMs(wallMs)}  error=${err.message}`)
  }

  // ── Step lifecycle ────────────────────────────────────────────

  registerStep(id: string, uses: string, deps: string[]) {
    this.rows.set(id, { id, uses, state: 'pending', deps, lineage: [] })
  }

  stepWaiting(id: string) { this.setState(id, 'waiting') }

  stepStart(id: string, uses: string, deps: string[]) {
    const row = this.rows.get(id)
    if (row) {
      row.state = 'running'
      row.startedAt = Date.now()
    }
    if (!this.isTTY) {
      this.write(`[ark][step:${id}] start  uses=${uses}  deps=[${deps.join(',')}]`)
    }
  }

  stepDone(id: string, elapsedMs: number) {
    const row = this.rows.get(id)
    if (row) { row.state = 'done'; row.elapsedMs = elapsedMs }
    if (!this.isTTY) this.write(`[ark][step:${id}] done  elapsed=${fmtMs(elapsedMs)}`)
  }

  stepFailed(id: string, err: Error, elapsedMs: number) {
    const row = this.rows.get(id)
    if (row) { row.state = 'failed'; row.elapsedMs = elapsedMs; row.detail = err.message }
    if (!this.isTTY) this.write(`[ark][step:${id}] failed  elapsed=${fmtMs(elapsedMs)}  error=${err.message}`)
  }

  stepSkipped(id: string) { this.setState(id, 'skipped') }
  stepCancelled(id: string) { this.setState(id, 'cancelled') }

  // ── Lineage ───────────────────────────────────────────────────

  lineageStep(stepId: string, lineageId: string, state: StepState, elapsedMs?: number) {
    const row = this.rows.get(stepId)
    if (row) {
      const existing = row.lineage.find(l => l.id === lineageId)
      if (existing) { existing.state = state; existing.elapsedMs = elapsedMs }
      else row.lineage.push({ id: lineageId, state, elapsedMs })
    }
    if (!this.isTTY) {
      const suffix = elapsedMs != null ? `  elapsed=${fmtMs(elapsedMs)}` : ''
      this.write(`[ark][step:${stepId}][lineage:${lineageId}] ${state}${suffix}`)
    }
  }

  // ── TTY panel ─────────────────────────────────────────────────

  private startPanel() {
    this.render()
    this.timer = setInterval(() => this.render(), 100)
  }

  private stopPanel() {
    if (this.timer) clearInterval(this.timer)
    this.render() // final frame
  }

  private render() {
    const lines: string[] = []
    const allDone = [...this.rows.values()].every(r =>
      r.state === 'done' || r.state === 'skipped' || r.state === 'failed' || r.state === 'cancelled'
    )
    const wallElapsed = [...this.rows.values()]
      .filter(r => r.startedAt)
      .reduce((max, r) => Math.max(max, r.elapsedMs ?? Date.now() - r.startedAt!), 0)

    lines.push(`\x1b[1mPipeline:\x1b[0m ${this.pipelineRunId}  [${allDone ? 'done' : 'running'}]  ${fmtMs(wallElapsed)}`)
    lines.push('')

    for (const row of this.rows.values()) {
      const elapsed = row.elapsedMs != null
        ? fmtMs(row.elapsedMs)
        : row.startedAt ? fmtMs(Date.now() - row.startedAt) : ''
      const color = STATE_COLOR[row.state]
      const detail = row.state === 'waiting' && row.deps.length
        ? `deps: ${row.deps.join(', ')}`
        : (row.detail ?? '')
      lines.push(`  ◆ ${row.id.padEnd(20)} ${color}[${row.state}]${RESET}  ${elapsed.padEnd(6)}  ${detail}`)
      for (const lin of row.lineage) {
        const lColor = STATE_COLOR[lin.state]
        const lElapsed = lin.elapsedMs != null ? fmtMs(lin.elapsedMs) : ''
        lines.push(`    ◇ ${lin.id.padEnd(18)} ${lColor}[${lin.state}]${RESET}  ${lElapsed.padEnd(6)}  (lineage)`)
      }
    }

    // Move cursor to top of panel and overwrite
    if (this._lastLineCount > 0) {
      process.stderr.write(`\x1b[${this._lastLineCount}A`)
    }
    process.stderr.write(lines.join('\n') + '\n')
    this._lastLineCount = lines.length
  }

  private _lastLineCount = 0

  // ── Timing summary ────────────────────────────────────────────

  private printTimingSummary(wallMs: number, timings: StepTiming[], sequentialMs: number) {
    const lines = ['', 'Step timing summary:']
    const maxLen = Math.max(...timings.map(t => t.id.length))
    for (const t of timings) {
      lines.push(`  ${t.id.padEnd(maxLen)}  ${fmtMs(t.elapsedMs)}`)
    }
    lines.push(`  ${'─'.repeat(maxLen + 8)}`)
    lines.push(`  total wall time  ${fmtMs(wallMs)}  (sequential would have been ${fmtMs(sequentialMs)})`)
    lines.push('')
    for (const l of lines) this.write(l)
  }

  private setState(id: string, state: StepState) {
    const row = this.rows.get(id)
    if (row) row.state = state
  }
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/runtime && pnpm test -- display --reporter=verbose 2>&1 | head -60
```

Expected: all display tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/display.ts packages/runtime/src/display.test.ts
git commit -m "feat(runtime): add Display module for TTY panel and structured logs"
```

---

## Task 4: AbortSignal Support in ChildCliRunner

**Files:**
- Modify: `packages/runtime/src/child-cli-runner.ts`

- [ ] **Step 1: Write failing test**

Add to `packages/runtime/src/pipeline-runner.test.ts` (at the bottom, before closing `}`):

```typescript
it('aborts a step when AbortSignal fires', async () => {
  const controller = new AbortController()
  const runner = new ChildCliRunner({ monorepoRoot: tmpDir })

  // Write a slow leaf CLI
  const pkgDir = path.join(tmpDir, 'packages', 'cli-slow')
  await fs.mkdir(path.join(pkgDir, 'dist'), { recursive: true })
  await fs.writeFile(path.join(pkgDir, 'dist', 'index.js'), `
    await new Promise(r => setTimeout(r, 10000))
    process.exit(0)
  `)
  await fs.writeFile(path.join(pkgDir, 'package.json'), JSON.stringify({
    name: '@ark/cli-slow', version: '0.1.0', type: 'module'
  }))

  // Abort after 100ms
  setTimeout(() => controller.abort(), 100)

  await expect(runner.run({
    packageId: '@ark/cli-slow',
    command: undefined,
    inputs: {},
    signal: controller.signal,
  })).rejects.toThrow('cancelled')
}, 5000)
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd packages/runtime && pnpm test -- "aborts a step" --reporter=verbose 2>&1 | head -40
```

Expected: test fails because `ChildCliRunner.run()` doesn't accept `signal`.

- [ ] **Step 3: Modify child-cli-runner.ts**

Open `packages/runtime/src/child-cli-runner.ts`. Find `ChildRunOptions` interface and add:

```typescript
signal?: AbortSignal
```

Find the `execa()` call inside `run()` and change it to pass the signal and handle abort:

```typescript
// Replace the existing execa call with:
const proc = execa('node', [entrypoint, ...(command ? [command] : [])], {
  env: { ...process.env, ARK_INPUT_PAYLOAD: JSON.stringify(inputs) },
  reject: false,
})

// Wire abort → SIGTERM → SIGKILL
let abortHandler: (() => void) | undefined
if (options.signal) {
  abortHandler = () => {
    proc.kill('SIGTERM')
    setTimeout(() => { try { proc.kill('SIGKILL') } catch {} }, 2000)
  }
  options.signal.addEventListener('abort', abortHandler, { once: true })
}

const result = await proc

if (abortHandler) options.signal!.removeEventListener('abort', abortHandler)

if (options.signal?.aborted) {
  throw new Error(`Step cancelled`)
}

// rest of existing result handling unchanged...
```

- [ ] **Step 4: Run test**

```bash
cd packages/runtime && pnpm test -- "aborts a step" --reporter=verbose 2>&1 | head -40
```

Expected: test passes.

- [ ] **Step 5: Rebuild**

```bash
cd packages/runtime && pnpm build 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/child-cli-runner.ts packages/runtime/src/pipeline-runner.test.ts
git commit -m "feat(runtime): add AbortSignal support to ChildCliRunner"
```

---

## Task 5: Concurrent Scheduler

**Files:**
- Create: `packages/runtime/src/scheduler.ts`
- Create: `packages/runtime/src/scheduler.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/runtime/src/scheduler.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { Scheduler } from './scheduler.js'

describe('Scheduler', () => {
  it('runs independent steps concurrently', async () => {
    const order: string[] = []
    const delays: Record<string, number> = { a: 50, b: 10, c: 30 }

    const scheduler = new Scheduler({
      dag: new Map([['a', []], ['b', []], ['c', []]]),
      concurrency: Infinity,
      parallelBehavior: 'waitAll',
      runStep: async (id) => {
        await new Promise(r => setTimeout(r, delays[id]))
        order.push(id)
      },
    })

    await scheduler.run()
    // b finishes first (10ms), then c (30ms), then a (50ms)
    expect(order).toEqual(['b', 'c', 'a'])
  })

  it('respects concurrency limit', async () => {
    let concurrent = 0
    let maxConcurrent = 0

    const scheduler = new Scheduler({
      dag: new Map([['a', []], ['b', []], ['c', []], ['d', []]]),
      concurrency: 2,
      parallelBehavior: 'waitAll',
      runStep: async () => {
        concurrent++
        maxConcurrent = Math.max(maxConcurrent, concurrent)
        await new Promise(r => setTimeout(r, 20))
        concurrent--
      },
    })

    await scheduler.run()
    expect(maxConcurrent).toBe(2)
  })

  it('runs dependent step only after its dependency completes', async () => {
    const order: string[] = []

    const scheduler = new Scheduler({
      dag: new Map([['a', []], ['b', ['a']]]),
      concurrency: Infinity,
      parallelBehavior: 'failFast',
      runStep: async (id) => {
        await new Promise(r => setTimeout(r, 10))
        order.push(id)
      },
    })

    await scheduler.run()
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
  })

  it('failFast: cancels running steps when one fails', async () => {
    const cancelled: string[] = []

    const scheduler = new Scheduler({
      dag: new Map([['a', []], ['b', []]]),
      concurrency: Infinity,
      parallelBehavior: 'failFast',
      runStep: async (id, signal) => {
        if (id === 'a') throw new Error('step a failed')
        await new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            cancelled.push(id)
            reject(new Error('cancelled'))
          })
        })
      },
    })

    await expect(scheduler.run()).rejects.toThrow('step a failed')
    expect(cancelled).toContain('b')
  })

  it('waitAll: runs all steps despite one failure', async () => {
    const completed: string[] = []

    const scheduler = new Scheduler({
      dag: new Map([['a', []], ['b', []]]),
      concurrency: Infinity,
      parallelBehavior: 'waitAll',
      runStep: async (id) => {
        if (id === 'a') throw new Error('step a failed')
        await new Promise(r => setTimeout(r, 10))
        completed.push(id)
      },
    })

    await expect(scheduler.run()).rejects.toThrow()
    expect(completed).toContain('b')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd packages/runtime && pnpm test -- scheduler --reporter=verbose 2>&1 | head -30
```

Expected: `Cannot find module './scheduler.js'`

- [ ] **Step 3: Implement scheduler.ts**

Create `packages/runtime/src/scheduler.ts`:

```typescript
export interface SchedulerOptions {
  dag: Map<string, string[]>         // stepId → [dep stepIds]
  concurrency: number                // max simultaneous steps
  parallelBehavior: 'failFast' | 'waitAll'
  runStep: (id: string, signal: AbortSignal) => Promise<void>
}

export class Scheduler {
  private opts: SchedulerOptions
  private done = new Set<string>()
  private failed = new Set<string>()
  private running = new Set<string>()
  private controller = new AbortController()

  constructor(opts: SchedulerOptions) {
    this.opts = opts
  }

  async run(): Promise<void> {
    const { dag, concurrency, parallelBehavior, runStep } = this.opts
    const errors: Error[] = []
    const promises = new Map<string, Promise<void>>()

    const isReady = (id: string) =>
      !this.done.has(id) &&
      !this.running.has(id) &&
      !this.failed.has(id) &&
      (dag.get(id) ?? []).every(dep => this.done.has(dep))

    const startStep = (id: string) => {
      this.running.add(id)
      const p = runStep(id, this.controller.signal)
        .then(() => {
          this.running.delete(id)
          this.done.add(id)
        })
        .catch((err: Error) => {
          this.running.delete(id)
          this.failed.add(id)
          errors.push(err)
          if (parallelBehavior === 'failFast') {
            this.controller.abort()
          }
        })
      promises.set(id, p)
      return p
    }

    // Main scheduling loop
    while (this.done.size + this.failed.size < dag.size) {
      // Fill up to concurrency limit
      for (const id of dag.keys()) {
        if (this.running.size >= concurrency) break
        if (isReady(id)) startStep(id)
      }

      if (this.running.size === 0 && this.done.size + this.failed.size < dag.size) {
        // Deadlock: remaining steps can't run (all deps failed in waitAll)
        break
      }

      // Wait for at least one step to settle
      if (this.running.size > 0) {
        await Promise.race([...this.running].map(id => promises.get(id)!))
      }
    }

    // Wait for all remaining promises to settle (waitAll)
    if (parallelBehavior === 'waitAll') {
      await Promise.allSettled([...promises.values()])
    }

    if (errors.length > 0) throw errors[0]
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/runtime && pnpm test -- scheduler --reporter=verbose 2>&1 | head -60
```

Expected: all scheduler tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/scheduler.ts packages/runtime/src/scheduler.test.ts
git commit -m "feat(runtime): add concurrent Scheduler with failFast/waitAll and cancellation"
```

---

## Task 6: parallel-map Builtin Step

**Files:**
- Modify: `packages/runtime/src/builtin-steps.ts`
- Modify: `packages/runtime/src/step-resolver.ts`

- [ ] **Step 1: Write failing test**

Add to `packages/runtime/src/pipeline-runner.test.ts`:

```typescript
it('parallel-map fans out over an array and collects results', async () => {
  // Write a simple doubler leaf CLI
  const pkgDir = path.join(tmpDir, 'packages', 'cli-double')
  await fs.mkdir(path.join(pkgDir, 'dist'), { recursive: true })
  await fs.writeFile(path.join(pkgDir, 'dist', 'index.js'), `
    import { readInputPayload, writeOutput } from '@ark/core'
    const p = readInputPayload()
    writeOutput({ value: p.value * 2 })
    process.exit(0)
  `)
  await fs.writeFile(path.join(pkgDir, 'package.json'), JSON.stringify({
    name: '@ark/cli-double', version: '0.1.0', type: 'module',
    dependencies: { '@ark/core': 'workspace:*' }
  }))

  const wiringPath = writeWiring(tmpDir, {
    pipeline: { mode: 'sequential' },
    steps: [
      {
        id: 'fan',
        uses: 'builtin/parallel-map',
        inputs: {
          items: [1, 2, 3],
          step: '@ark/cli-double',
          inputKey: 'value',
          concurrency: 3,
        },
        outputs: { bind: { results: 'results' } },
      },
      {
        id: 'log',
        uses: 'builtin/log',
        inputs: { message: '{{ ctx.bindings.results }}' },
      },
    ],
  })

  const runner = new PipelineRunner({ wiringPlanPath: wiringPath, monorepoRoot: tmpDir })
  const result = await runner.run([])
  expect(result.success).toBe(true)
  const bound = result.context.bindings.get('results') as Array<{ value: number }>
  expect(bound.map(r => r.value).sort()).toEqual([2, 4, 6])
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd packages/runtime && pnpm test -- "parallel-map" --reporter=verbose 2>&1 | head -30
```

Expected: unknown builtin step error.

- [ ] **Step 3: Add parallelMap to builtin-steps.ts**

Open `packages/runtime/src/builtin-steps.ts`. Add at the bottom (before any exports):

```typescript
export async function parallelMap(
  inputs: Record<string, unknown>,
  _ctx: PipelineContext,
  runChild: (packageId: string, command: string | undefined, itemInputs: Record<string, unknown>, signal: AbortSignal) => Promise<Record<string, unknown>>
): Promise<BuiltinStepResult> {
  const items = inputs['items']
  const stepId = inputs['step'] as string
  const command = inputs['command'] as string | undefined
  const inputKey = inputs['inputKey'] as string
  const concurrency = (inputs['concurrency'] as number | undefined) ?? Infinity

  if (!Array.isArray(items)) {
    throw new Error('builtin/parallel-map: inputs.items must be an array')
  }

  const semaphore = new Semaphore(concurrency)
  const results = await Promise.all(
    items.map(item =>
      semaphore.run(() => {
        const ctrl = new AbortController()
        return runChild(stepId, command, { [inputKey]: item }, ctrl.signal)
      })
    )
  )

  return { output: { results } }
}

class Semaphore {
  private running = 0
  private queue: Array<() => void> = []
  constructor(private limit: number) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const attempt = () => {
        if (this.running >= this.limit) {
          this.queue.push(attempt)
          return
        }
        this.running++
        fn().then(resolve, reject).finally(() => {
          this.running--
          this.queue.shift()?.()
        })
      }
      attempt()
    })
  }
}
```

- [ ] **Step 4: Register in step-resolver.ts**

Open `packages/runtime/src/step-resolver.ts`. Find `BUILTIN_MAP` and add:

```typescript
'builtin/parallel-map': (inputs, ctx) =>
  parallelMap(inputs, ctx, (pkgId, cmd, itemInputs, signal) =>
    this.childRunner.run({ packageId: pkgId, command: cmd, inputs: itemInputs, signal })
      .then(r => r.output)
  ),
```

Also add `parallelMap` to the import from `./builtin-steps.js`.

- [ ] **Step 5: Run test**

```bash
cd packages/runtime && pnpm test -- "parallel-map" --reporter=verbose 2>&1 | head -40
```

Expected: test passes.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/builtin-steps.ts packages/runtime/src/step-resolver.ts
git commit -m "feat(runtime): add builtin/parallel-map step with concurrency control"
```

---

## Task 7: Timeout Support in StepResolver

**Files:**
- Modify: `packages/runtime/src/step-resolver.ts`

- [ ] **Step 1: Write failing test**

Add to `packages/runtime/src/pipeline-runner.test.ts`:

```typescript
it('aborts a step that exceeds its timeout', async () => {
  // Slow CLI from Task 4 already written at tmpDir/packages/cli-slow
  const wiringPath = writeWiring(tmpDir, {
    pipeline: { mode: 'sequential' },
    steps: [
      { id: 'slow', uses: '@ark/cli-slow', timeout: '1s' },
    ],
    errorPolicy: { onStepFailure: 'abort' },
  })

  const runner = new PipelineRunner({ wiringPlanPath: wiringPath, monorepoRoot: tmpDir })
  const result = await runner.run([])
  expect(result.success).toBe(false)
  expect(result.error).toMatch(/timeout|cancelled/)
}, 5000)
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd packages/runtime && pnpm test -- "exceeds its timeout" --reporter=verbose 2>&1 | head -30
```

Expected: test hangs or fails without timeout error.

- [ ] **Step 3: Add timeout wrapping in step-resolver.ts**

Open `packages/runtime/src/step-resolver.ts`. In the `resolve()` method, wrap the returned executor with a timeout if `step.timeout` is set:

```typescript
resolve(step: WiringStep, dryRun: boolean, signal?: AbortSignal): StepExecutor {
  const baseExecutor = this._resolveBase(step, dryRun, signal)

  if (!step.timeout) return baseExecutor

  const timeoutMs = parseTimeout(step.timeout)

  return async (inputs, ctx) => {
    const ctrl = new AbortController()
    // Forward external cancellation
    signal?.addEventListener('abort', () => ctrl.abort(), { once: true })

    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      return await baseExecutor(inputs, ctx)
    } finally {
      clearTimeout(timer)
    }
  }
}

function parseTimeout(t: string): number {
  const match = t.match(/^(\d+)([sm])$/)
  if (!match) throw new Error(`Invalid timeout format: ${t}`)
  const [, n, unit] = match
  return parseInt(n) * (unit === 'm' ? 60000 : 1000)
}
```

- [ ] **Step 4: Run test**

```bash
cd packages/runtime && pnpm test -- "exceeds its timeout" --reporter=verbose 2>&1 | head -30
```

Expected: test passes within 5s.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/step-resolver.ts
git commit -m "feat(runtime): add per-step timeout with SIGTERM/SIGKILL via AbortSignal"
```

---

## Task 8: DAG Mode in PipelineRunner

**Files:**
- Modify: `packages/runtime/src/pipeline-runner.ts`

- [ ] **Step 1: Write failing integration test**

Add to `packages/runtime/src/pipeline-runner.test.ts`:

```typescript
it('dag mode runs independent steps concurrently', async () => {
  const startTimes: Record<string, number> = {}

  // Two slow CLIs: cli-slow-a and cli-slow-b (200ms each)
  for (const name of ['cli-dag-a', 'cli-dag-b']) {
    const pkgDir = path.join(tmpDir, 'packages', name)
    await fs.mkdir(path.join(pkgDir, 'dist'), { recursive: true })
    await fs.writeFile(path.join(pkgDir, 'dist', 'index.js'), `
      import { writeOutput } from '@ark/core'
      await new Promise(r => setTimeout(r, 200))
      writeOutput({ done: true })
      process.exit(0)
    `)
    await fs.writeFile(path.join(pkgDir, 'package.json'), JSON.stringify({
      name: \`@ark/\${name}\`, version: '0.1.0', type: 'module',
      dependencies: { '@ark/core': 'workspace:*' }
    }))
  }

  const wiringPath = writeWiring(tmpDir, {
    pipeline: { mode: 'dag' },
    steps: [
      { id: 'a', uses: '@ark/cli-dag-a', outputs: { bind: { aOut: '.' } } },
      { id: 'b', uses: '@ark/cli-dag-b', outputs: { bind: { bOut: '.' } } },
      // c depends on both a and b
      {
        id: 'c',
        uses: 'builtin/log',
        inputs: {
          message: '{{ ctx.bindings.aOut }}',
          // also references bOut to create inferred dep on b
          extra: '{{ ctx.bindings.bOut }}',
        },
      },
    ],
  })

  const start = Date.now()
  const runner = new PipelineRunner({ wiringPlanPath: wiringPath, monorepoRoot: tmpDir })
  const result = await runner.run([])
  const elapsed = Date.now() - start

  expect(result.success).toBe(true)
  // If a and b ran sequentially: ~400ms. Concurrently: ~200ms.
  expect(elapsed).toBeLessThan(350)
}, 10000)
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd packages/runtime && pnpm test -- "dag mode" --reporter=verbose 2>&1 | head -30
```

Expected: test fails (elapsed > 350ms because still sequential).

- [ ] **Step 3: Add DAG execution path to pipeline-runner.ts**

Open `packages/runtime/src/pipeline-runner.ts`. In the `run()` method, after the plan is loaded and context is built, add a branch:

```typescript
if (plan.pipeline.mode === 'dag') {
  return this.runDag(plan, ctx)
}
// existing sequential path unchanged below
```

Add the `runDag` method to `PipelineRunner`:

```typescript
private async runDag(plan: WiringPlan, ctx: PipelineContext): Promise<RunResult> {
  const { buildDag } = await import('./dag.js')
  const { Scheduler } = await import('./scheduler.js')

  const dag = buildDag(plan.steps)
  const concurrency = plan.pipeline.concurrency ?? Infinity
  const parallelBehavior = plan.errorPolicy?.parallelBehavior ?? 'failFast'

  const display = this.display  // Display instance (set up in constructor)

  const scheduler = new Scheduler({
    dag,
    concurrency,
    parallelBehavior,
    runStep: async (id, signal) => {
      const step = plan.steps.find(s => s.id === id)!
      display.stepStart(id, step.uses, dag.get(id) ?? [])
      const startedAt = Date.now()
      try {
        await this.executeStep(step, ctx, signal)
        display.stepDone(id, Date.now() - startedAt)
      } catch (err) {
        display.stepFailed(id, err as Error, Date.now() - startedAt)
        throw err
      }
    },
  })

  const wallStart = Date.now()
  try {
    await scheduler.run()
    const wallMs = Date.now() - wallStart
    display.pipelineDone(wallMs, [], 0)
    return { success: true, context: ctx }
  } catch (err) {
    display.pipelineFailed(Date.now() - wallStart, err as Error)
    return { success: false, error: (err as Error).message, context: ctx }
  }
}
```

Also initialize `Display` in the constructor:

```typescript
import { Display } from './display.js'

// In constructor:
this.display = new Display()
```

Add `private display: Display` property.

- [ ] **Step 4: Run test**

```bash
cd packages/runtime && pnpm test -- "dag mode" --reporter=verbose 2>&1 | head -40
```

Expected: test passes, elapsed < 350ms.

- [ ] **Step 5: Run full test suite**

```bash
cd packages/runtime && pnpm test 2>&1 | tail -20
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/pipeline-runner.ts packages/runtime/src/index.ts
git commit -m "feat(runtime): wire DAG scheduler into PipelineRunner for mode: dag"
```

---

## Task 9: Composer Parallel Awareness

**Files:**
- Modify: `packages/composer/src/ai-planner-session.ts`

- [ ] **Step 1: Write failing test**

Create `packages/composer/src/ai-planner-session.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { AiPlannerSession } from './ai-planner-session.js'

const mockBridge = {
  planComposition: vi.fn().mockResolvedValue({
    wiringYaml: `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential
steps:
  - id: fetch-weather
    uses: "@ark/cli-weather"
    outputs:
      bind:
        weatherData: "."
  - id: fetch-news
    uses: "@ark/cli-news"
    outputs:
      bind:
        newsData: "."
  - id: generate
    uses: "@ark/cli-report"
    inputs:
      weather: "{{ ctx.bindings.weatherData }}"
      news: "{{ ctx.bindings.newsData }}"
`,
    rationale: 'test plan',
  }),
}

describe('AiPlannerSession parallel detection', () => {
  it('detects parallelizable steps and returns prompt text', async () => {
    const session = new AiPlannerSession(mockBridge as any)
    const result = await session.run(
      { apiVersion: 'ark/v1', kind: 'ComposeRequest', output: { id: 'test', targetDirectory: '.' }, parents: [], intent: 'test' } as any,
      new Map()
    )
    // Should detect that fetch-weather and fetch-news are independent
    expect(result.parallelSuggestion).toBeDefined()
    expect(result.parallelSuggestion?.stepIds).toContain('fetch-weather')
    expect(result.parallelSuggestion?.stepIds).toContain('fetch-news')
  })

  it('returns no suggestion when all steps are sequential', async () => {
    const sequentialBridge = {
      planComposition: vi.fn().mockResolvedValue({
        wiringYaml: `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential
steps:
  - id: a
    uses: "@ark/cli-a"
    outputs:
      bind:
        aOut: "."
  - id: b
    uses: "@ark/cli-b"
    inputs:
      data: "{{ ctx.bindings.aOut }}"
`,
        rationale: 'sequential',
      }),
    }
    const session = new AiPlannerSession(sequentialBridge as any)
    const result = await session.run(
      { apiVersion: 'ark/v1', kind: 'ComposeRequest', output: { id: 'test', targetDirectory: '.' }, parents: [], intent: 'test' } as any,
      new Map()
    )
    expect(result.parallelSuggestion).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd packages/composer && pnpm test -- "ai-planner" --reporter=verbose 2>&1 | head -30
```

Expected: `parallelSuggestion` not on result type.

- [ ] **Step 3: Extend PlannerSessionResult type and add detection**

Open `packages/composer/src/ai-planner-session.ts`. Add `parallelSuggestion` to the result type:

```typescript
export interface PlannerSessionResult {
  wiringYaml: string
  rationale: string
  parallelSuggestion?: {
    stepIds: string[]
    sequentialMs: number   // estimated; 0 if unknown
    recommendation: 'failFast' | 'waitAll'
    reason: string
  }
}
```

In the `run()` method, after receiving the AI result, add parallel detection:

```typescript
import { buildDag } from '@ark/runtime'
import { WiringPlanSchema } from '@ark/core'
import yaml from 'js-yaml'

// After getting wiringYaml from AI:
const parsedPlan = WiringPlanSchema.safeParse(yaml.load(result.wiringYaml))
let parallelSuggestion: PlannerSessionResult['parallelSuggestion']

if (parsedPlan.success) {
  const steps = parsedPlan.data.steps
  const dag = buildDag(steps)

  // Find groups of steps that could run in parallel
  // (steps that share no dependency chain between them)
  const independentSteps = steps.filter(s => {
    const deps = dag.get(s.id) ?? []
    return deps.length === 0
  })

  if (independentSteps.length >= 2) {
    // Check if all their outputs feed into a shared downstream step
    // Heuristic for recommendation: if all results are consumed downstream → failFast
    const allOutputsUsed = independentSteps.every(s =>
      Object.keys(s.outputs?.bind ?? {}).some(binding =>
        steps.some(other =>
          other.id !== s.id &&
          JSON.stringify(other.inputs ?? {}).includes(`ctx.bindings.${binding}`)
        )
      )
    )

    parallelSuggestion = {
      stepIds: independentSteps.map(s => s.id),
      sequentialMs: 0,
      recommendation: allOutputsUsed ? 'failFast' : 'waitAll',
      reason: allOutputsUsed
        ? 'All parallel results are required downstream — failFast avoids wasted work on failure.'
        : 'Not all results are required downstream — waitAll allows partial success.',
    }
  }
}

return { wiringYaml: result.wiringYaml, rationale: result.rationale, parallelSuggestion }
```

- [ ] **Step 4: Run tests**

```bash
cd packages/composer && pnpm test -- "ai-planner" --reporter=verbose 2>&1 | head -40
```

Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/composer/src/ai-planner-session.ts packages/composer/src/ai-planner-session.test.ts
git commit -m "feat(composer): detect parallelizable steps and surface recommendation to user"
```

---

## Task 10: Export Updates & Final Build

**Files:**
- Modify: `packages/runtime/src/index.ts`

- [ ] **Step 1: Update exports**

Open `packages/runtime/src/index.ts`. Add:

```typescript
export { Display } from './display.js'
export { buildDag, topoSort } from './dag.js'
export { Scheduler } from './scheduler.js'
```

- [ ] **Step 2: Full build**

```bash
cd D:/ark && pnpm build 2>&1 | tail -30
```

Expected: all packages build without errors.

- [ ] **Step 3: Full test suite**

```bash
cd D:/ark && pnpm test 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 4: Typecheck**

```bash
cd D:/ark && pnpm typecheck 2>&1 | tail -20
```

Expected: no type errors.

- [ ] **Step 5: Final commit**

```bash
git add packages/runtime/src/index.ts
git commit -m "feat(runtime): export Display, buildDag, topoSort, Scheduler from runtime index"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Task(s) |
|---|---|
| Schema: timeout, dependsOn, concurrency, parallelBehavior | Task 1 |
| DAG inference + topoSort + cycle detection | Task 2 |
| Display: TTY panel + structured log + lineage rows | Task 3 |
| AbortSignal in ChildCliRunner (SIGTERM/SIGKILL) | Task 4 |
| Concurrent scheduler (failFast/waitAll, concurrency limit) | Task 5 |
| builtin/parallel-map | Task 6 |
| Per-step timeout | Task 7 |
| PipelineRunner dag mode wiring | Task 8 |
| Composer parallel detection + recommendation | Task 9 |
| Export updates + final build | Task 10 |

**Type consistency check:**
- `StepExecutor` signature in step-resolver accepts `signal?: AbortSignal` — consistent through Tasks 4, 7, 8
- `buildDag` returns `Map<string, string[]>` — used consistently in Tasks 2, 8, 9
- `Display` methods (`stepStart`, `stepDone`, `stepFailed`) called consistently in Tasks 3, 8
- `Scheduler.runStep` callback signature `(id: string, signal: AbortSignal) => Promise<void>` — consistent Tasks 5, 8
- `PlannerSessionResult.parallelSuggestion` shape defined in Task 9, no downstream consumers yet (Composer UI not in scope)

**Placeholder scan:** No TBDs or TODOs found. All code blocks are complete.
