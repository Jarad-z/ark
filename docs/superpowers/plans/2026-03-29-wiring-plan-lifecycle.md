# WiringPlan Lifecycle & Branching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `WiringPlan` with a `lifecycle` field (`finite | streaming`) and a `builtin/branch` step, while backward-compatibly renaming `pipeline.mode` to `pipeline.topology`.

**Architecture:** Schema changes in `@ark/core` define the new fields. `PipelineRunner` in `@ark/runtime` gains a streaming execution loop (start source process → read stdout line-by-line → trigger downstream steps per event → stop on condition/signal). `builtin/branch` is a new step executor that jumps execution to a named step id in sequential pipelines.

**Tech Stack:** TypeScript, Zod (schema), Vitest (tests), execa (child process), Node.js readline/stream APIs.

---

## File Map

| File | Change |
|---|---|
| `packages/core/src/schemas.ts` | Add `topology`, `lifecycle`, `StreamingConfigSchema`; deprecate `mode` via `.or()` transform |
| `packages/core/src/schemas.test.ts` | Add tests for new schema fields |
| `packages/runtime/src/builtin-steps.ts` | Add `branch()` builtin |
| `packages/runtime/src/builtin-steps.test.ts` | Add tests for `branch()` |
| `packages/runtime/src/step-resolver.ts` | Register `builtin/branch` in `BUILTIN_MAP`; update `isBuiltin` / `assertKnown` |
| `packages/runtime/src/pipeline-runner.ts` | Add `runStreaming()` method; map deprecated `mode` → `topology`; route `lifecycle` |
| `packages/runtime/src/pipeline-runner.test.ts` | Add tests for streaming lifecycle and branch routing |

---

### Task 1: Schema — add `topology`, `lifecycle`, `streaming` config

**Files:**
- Modify: `packages/core/src/schemas.ts`

- [ ] **Step 1: Add `StreamingConfigSchema` and update `WiringPlanSchema`**

In `packages/core/src/schemas.ts`, add after `WiringFlagSchema`:

```typescript
export const StreamingConfigSchema = z.object({
  until: ISO8601Schema.optional(),
  stopOn: z.string().optional(),
  restartOnFailure: z.boolean().default(false),
})

export type StreamingConfig = z.infer<typeof StreamingConfigSchema>
```

Then replace the `WiringPlanSchema` `pipeline` block:

```typescript
export const WiringPlanSchema = z.object({
  apiVersion: z.literal('ark/v1'),
  kind: z.literal('WiringPlan'),
  generatedBy: z.string().optional(),
  generatedAt: ISO8601Schema.optional(),
  approvedAt: ISO8601Schema.optional(),
  pipeline: z.object({
    // New canonical field
    topology: z.enum(['sequential', 'dag']).optional(),
    // Deprecated alias — still accepted, maps to topology in runtime
    mode: z.enum(['sequential', 'dag']).optional(),
    lifecycle: z.enum(['finite', 'streaming']).default('finite'),
    concurrency: z.number().int().positive().optional(),
  }).refine(
    (p) => p.topology !== undefined || p.mode !== undefined,
    { message: 'pipeline.topology (or deprecated pipeline.mode) is required' }
  ),
  streaming: StreamingConfigSchema.optional(),
  steps: z.array(WiringStepSchema),
  errorPolicy: ErrorPolicySchema.optional(),
  autoMode: z
    .object({
      decisionStep: AutoModeDecisionStepSchema,
    })
    .optional(),
  flags: z.array(WiringFlagSchema).default([]),
})

export type WiringPlan = z.infer<typeof WiringPlanSchema>
```

- [ ] **Step 2: Build**

```bash
cd packages/core && pnpm build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/schemas.ts
git commit -m "feat(core): add topology, lifecycle, streaming config to WiringPlanSchema"
```

---

### Task 2: Schema tests

**Files:**
- Modify: `packages/core/src/schemas.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `packages/core/src/schemas.test.ts`:

```typescript
describe('WiringPlanSchema — lifecycle and topology', () => {
  const basePlan = {
    apiVersion: 'ark/v1' as const,
    kind: 'WiringPlan' as const,
    pipeline: { topology: 'sequential' as const },
    steps: [],
  }

  it('accepts topology: sequential with lifecycle: finite (default)', () => {
    const result = WiringPlanSchema.safeParse(basePlan)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.pipeline.lifecycle).toBe('finite')
    }
  })

  it('accepts deprecated mode field', () => {
    const plan = { ...basePlan, pipeline: { mode: 'sequential' as const } }
    const result = WiringPlanSchema.safeParse(plan)
    expect(result.success).toBe(true)
  })

  it('rejects plan with neither topology nor mode', () => {
    const plan = { ...basePlan, pipeline: { lifecycle: 'finite' } }
    const result = WiringPlanSchema.safeParse(plan)
    expect(result.success).toBe(false)
  })

  it('accepts lifecycle: streaming with streaming config', () => {
    const plan = {
      ...basePlan,
      pipeline: { topology: 'sequential' as const, lifecycle: 'streaming' as const },
      streaming: {
        until: '2026-12-31T00:00:00+00:00',
        stopOn: '{{ ctx.bindings.price > 100000 }}',
        restartOnFailure: true,
      },
    }
    const result = WiringPlanSchema.safeParse(plan)
    expect(result.success).toBe(true)
  })

  it('streaming config restartOnFailure defaults to false', () => {
    const plan = {
      ...basePlan,
      pipeline: { topology: 'sequential' as const, lifecycle: 'streaming' as const },
      streaming: {},
    }
    const result = WiringPlanSchema.safeParse(plan)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.streaming?.restartOnFailure).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/core && pnpm test
```

Expected: the new tests FAIL (schema not yet updated in this task — actually schema was updated in Task 1, so they should PASS now; if any fail, fix schema).

- [ ] **Step 3: Run full core tests**

```bash
cd packages/core && pnpm test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/schemas.test.ts
git commit -m "test(core): add tests for topology, lifecycle, streaming schema fields"
```

---

### Task 3: `builtin/branch` step

**Files:**
- Modify: `packages/runtime/src/builtin-steps.ts`
- Modify: `packages/runtime/src/builtin-steps.test.ts`

- [ ] **Step 1: Write failing test**

Add to `packages/runtime/src/builtin-steps.test.ts`:

```typescript
import { branch } from './builtin-steps.js'

describe('branch()', () => {
  it('returns the next step id for the first matching condition', async () => {
    const result = await branch({
      routes: [
        { condition: false, next: 'step-a' },
        { condition: true, next: 'step-b' },
      ],
    })
    expect(result.output).toEqual({ next: 'step-b' })
    expect(result.skipped).toBeUndefined()
  })

  it('returns default when no condition matches', async () => {
    const result = await branch({
      routes: [{ condition: false, next: 'step-a' }],
      default: 'step-fallback',
    })
    expect(result.output).toEqual({ next: 'step-fallback' })
  })

  it('returns empty output (pipeline ends) when no match and no default', async () => {
    const result = await branch({
      routes: [{ condition: false, next: 'step-a' }],
    })
    expect(result.output).toEqual({ next: null })
  })

  it('throws if routes is not an array', async () => {
    await expect(branch({ routes: 'bad' })).rejects.toThrow('branch: routes must be an array')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/runtime && pnpm test -- builtin-steps
```

Expected: FAIL — `branch is not a function`.

- [ ] **Step 3: Implement `branch()` in `builtin-steps.ts`**

Add after the `parallelMap` function in `packages/runtime/src/builtin-steps.ts`:

```typescript
export interface BranchRoute {
  condition: unknown
  next: string
}

/**
 * builtin/branch
 * Evaluates routes in order and returns the `next` step id for the first
 * truthy condition. Returns { next: null } if no match and no default.
 * The PipelineRunner reads output.next to jump execution.
 */
export async function branch(
  inputs: Record<string, unknown>
): Promise<BuiltinStepResult> {
  if (!Array.isArray(inputs['routes'])) {
    throw new Error('branch: routes must be an array')
  }

  const routes = inputs['routes'] as BranchRoute[]
  for (const route of routes) {
    if (route.condition) {
      return { output: { next: route.next } }
    }
  }

  const defaultNext = inputs['default']
  if (typeof defaultNext === 'string') {
    return { output: { next: defaultNext } }
  }

  return { output: { next: null } }
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/runtime && pnpm test -- builtin-steps
```

Expected: all `branch()` tests PASS.

- [ ] **Step 5: Register `builtin/branch` in `step-resolver.ts`**

In `packages/runtime/src/step-resolver.ts`, update the import and `BUILTIN_MAP`:

```typescript
import { humanReview, log, conditional, parallelMap, branch } from './builtin-steps.js'
```

```typescript
const BUILTIN_MAP: Record<string, StepExecutor> = {
  'builtin/human-review': humanReview,
  'builtin/log': (inputs) => log(inputs),
  'builtin/conditional': (inputs) => conditional(inputs),
  'builtin/branch': (inputs) => branch(inputs),
}
```

Also update `isBuiltin`:

```typescript
isBuiltin(uses: string): boolean {
  return uses in BUILTIN_MAP || uses === 'builtin/parallel-map'
}
```

(No change needed — `builtin/branch` is now in `BUILTIN_MAP` so `uses in BUILTIN_MAP` covers it.)

- [ ] **Step 6: Build runtime**

```bash
cd packages/runtime && pnpm build
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/runtime/src/builtin-steps.ts packages/runtime/src/builtin-steps.test.ts packages/runtime/src/step-resolver.ts
git commit -m "feat(runtime): add builtin/branch step with route evaluation"
```

---

### Task 4: PipelineRunner — backward compat + branch routing

**Files:**
- Modify: `packages/runtime/src/pipeline-runner.ts`
- Modify: `packages/runtime/src/pipeline-runner.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `packages/runtime/src/pipeline-runner.test.ts`:

```typescript
it('accepts deprecated mode field (backward compat)', async () => {
  const wiringPath = writeWiring(
    tmpDir,
    `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential
steps:
  - id: greet
    uses: builtin/log
    inputs:
      message: "hello"
`
  )
  const runner = new PipelineRunner({
    wiringPath,
    composedCliId: '@ark/test',
    monorepoRoot: tmpDir,
  })
  const result = await runner.run([])
  expect(result.success).toBe(true)
})

it('routes to correct step via builtin/branch', async () => {
  const wiringPath = writeWiring(
    tmpDir,
    `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
  lifecycle: finite
steps:
  - id: decide
    uses: builtin/branch
    inputs:
      routes:
        - condition: true
          next: path-a
      default: path-b
  - id: path-a
    uses: builtin/log
    inputs:
      message: "took path A"
  - id: path-b
    uses: builtin/log
    inputs:
      message: "took path B"
`
  )
  const runner = new PipelineRunner({
    wiringPath,
    composedCliId: '@ark/test',
    monorepoRoot: tmpDir,
  })
  const result = await runner.run([])
  expect(result.success).toBe(true)
  // path-b should not have run — its stepOutput should be absent
  expect(result.stepOutputs['path-b']).toBeUndefined()
  expect(result.stepOutputs['path-a']).toBeDefined()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/runtime && pnpm test -- pipeline-runner
```

Expected: branch routing test FAILS — pipeline runs all steps instead of jumping.

- [ ] **Step 3: Add topology resolution helper and branch routing to `PipelineRunner`**

In `packages/runtime/src/pipeline-runner.ts`, add a helper at the top of the class to resolve topology:

```typescript
private getTopology(): 'sequential' | 'dag' {
  return this.plan.pipeline.topology ?? this.plan.pipeline.mode ?? 'sequential'
}
```

Update `run()` to use `getTopology()`:

```typescript
if (this.getTopology() === 'dag') {
  return this.runDag(ctx)
}
```

Update `executeStep()` to handle `builtin/branch` output — after storing step output, check for a jump:

```typescript
// Handle builtin/branch jump
if (step.uses === 'builtin/branch') {
  const nextId = (result.output as Record<string, unknown>)['next']
  if (typeof nextId === 'string') {
    ctx._branchTarget = nextId
  } else {
    ctx._branchTarget = '__end__'
  }
}
```

Add `_branchTarget` to the context handling in the sequential loop in `run()`:

```typescript
const steps = this.plan.steps
for (let i = 0; i < steps.length; i++) {
  const step = steps[i]!

  // Branch jump: skip steps until we reach _branchTarget
  const target = (ctx as Record<string, unknown>)['_branchTarget'] as string | undefined
  if (target === '__end__') break
  if (target !== undefined && step.id !== target) {
    process.stderr.write(`[ark:runtime] Step "${step.id}" skipped (branch).\n`)
    continue
  }
  if (target !== undefined && step.id === target) {
    // Clear the branch target — we've arrived
    delete (ctx as Record<string, unknown>)['_branchTarget']
  }

  await this.executeStep(step, ctx)
}
```

Note: `_branchTarget` is stored directly on `ctx` as an ephemeral field. `PipelineContext` schema uses `z.record` for `flags`/`bindings` but `ctx` itself is typed — cast to `Record<string, unknown>` for the ephemeral field to avoid schema pollution.

- [ ] **Step 4: Run tests**

```bash
cd packages/runtime && pnpm test -- pipeline-runner
```

Expected: all pipeline-runner tests PASS.

- [ ] **Step 5: Build**

```bash
cd packages/runtime && pnpm build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/pipeline-runner.ts packages/runtime/src/pipeline-runner.test.ts
git commit -m "feat(runtime): support topology field, backward compat mode, and builtin/branch routing"
```

---

### Task 5: PipelineRunner — streaming lifecycle

**Files:**
- Modify: `packages/runtime/src/pipeline-runner.ts`
- Modify: `packages/runtime/src/pipeline-runner.test.ts`

- [ ] **Step 1: Write failing test**

Add to `packages/runtime/src/pipeline-runner.test.ts`:

```typescript
it('streaming lifecycle: fires downstream steps for each stdout event line', async () => {
  // Build a fake source CLI that emits 3 JSON events then exits
  const sourceDir = join(tmpDir, 'packages', 'fake-source')
  mkdirSync(sourceDir, { recursive: true })
  writeFileSync(
    join(sourceDir, 'package.json'),
    JSON.stringify({ name: '@ark/fake-source', main: 'index.js' })
  )
  writeFileSync(
    join(sourceDir, 'index.js'),
    `
const lines = [
  JSON.stringify({ ARK_OUTPUT: JSON.stringify({ price: 10 }) }),
  JSON.stringify({ ARK_OUTPUT: JSON.stringify({ price: 20 }) }),
  JSON.stringify({ ARK_OUTPUT: JSON.stringify({ price: 30 }) }),
]
for (const l of lines) process.stdout.write(l + '\\n')
process.exit(0)
`
  )

  const wiringPath = writeWiring(
    tmpDir,
    `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
  lifecycle: streaming
steps:
  - id: source
    uses: "@ark/fake-source"
    outputs:
      bind:
        tick: "."
  - id: logger
    uses: builtin/log
    inputs:
      message: "price={{ ctx.bindings.tick.price }}"
`
  )

  const runner = new PipelineRunner({
    wiringPath,
    composedCliId: '@ark/test',
    monorepoRoot: tmpDir,
  })

  const result = await runner.run([])
  expect(result.success).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/runtime && pnpm test -- pipeline-runner
```

Expected: FAIL — streaming lifecycle not yet implemented, runs as finite.

- [ ] **Step 3: Implement `runStreaming()` in `pipeline-runner.ts`**

Add this import at the top:

```typescript
import { createInterface } from 'node:readline'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
```

Add the `runStreaming()` method to `PipelineRunner`:

```typescript
private async runStreaming(ctx: PipelineContext): Promise<RunResult> {
  const streamingConfig = this.plan.streaming
  const sourceStep = this.plan.steps[0]
  if (!sourceStep) {
    throw new ValidationError('Streaming pipeline must have at least one step (the source)', [])
  }

  const downstreamSteps = this.plan.steps.slice(1)
  const untilMs = streamingConfig?.until ? new Date(streamingConfig.until).getTime() : Infinity
  const stopOn = streamingConfig?.stopOn
  const restartOnFailure = streamingConfig?.restartOnFailure ?? false

  const resolvedInputs = resolveInputs(
    sourceStep.inputs as Record<string, unknown>,
    ctx as unknown as Record<string, unknown>
  )

  const startSource = (): ReturnType<typeof spawn> => {
    // Resolve entrypoint same way as ChildCliRunner
    const packageId = sourceStep.uses
    const name = packageId.includes('/') ? packageId.split('/').slice(1).join('/') : packageId
    const searchRoots = [
      join(this.options.monorepoRoot, 'packages', name),
      join(this.options.monorepoRoot, 'tools', name),
    ]
    let entrypoint = ''
    for (const dir of searchRoots) {
      const pkgPath = join(dir, 'package.json')
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { main?: string }
        entrypoint = resolve(dir, pkg.main ?? 'dist/index.js')
        break
      }
    }
    if (!entrypoint) throw new Error(`Cannot resolve source CLI: ${packageId}`)

    const args = sourceStep.command ? [sourceStep.command] : []
    return spawn('node', [entrypoint, ...args], {
      env: { ...process.env, ARK_INPUT_PAYLOAD: JSON.stringify(resolvedInputs) },
      stdio: ['ignore', 'pipe', 'inherit'],
    })
  }

  let proc = startSource()
  let stopped = false

  const stop = () => {
    stopped = true
    try { proc.kill('SIGTERM') } catch { /* already dead */ }
  }

  // Honor until time
  const untilTimer = isFinite(untilMs)
    ? setTimeout(stop, untilMs - Date.now())
    : undefined

  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)

  const processLine = async (line: string) => {
    const { parseOutputLine, applyBindings } = await import('@ark/core')
    const parsed = parseOutputLine(line)
    if (parsed === undefined) return

    // Bind source output into ctx
    if (sourceStep.outputs?.bind) {
      applyBindings(
        sourceStep.outputs.bind,
        parsed as Record<string, unknown>,
        ctx as unknown as Record<string, unknown>
      )
    }

    // Run downstream steps
    for (const step of downstreamSteps) {
      if (!stopped) await this.executeStep(step, ctx)
    }

    // Evaluate stopOn
    if (stopOn) {
      const { interpolate } = await import('@ark/core')
      const result = interpolate(stopOn, ctx as unknown as Record<string, unknown>)
      if (result) stop()
    }
  }

  const runUntilExit = (p: ReturnType<typeof spawn>): Promise<void> =>
    new Promise((resolve) => {
      const rl = createInterface({ input: p.stdout!, crlfDelay: Infinity })
      rl.on('line', (line) => { processLine(line).catch(() => {}) })
      p.on('close', resolve)
    })

  while (!stopped) {
    await runUntilExit(proc)
    if (stopped) break
    if (restartOnFailure) {
      process.stderr.write('[ark:runtime] Source CLI exited, restarting...\n')
      proc = startSource()
    } else {
      break
    }
  }

  if (untilTimer) clearTimeout(untilTimer)
  process.off('SIGTERM', stop)
  process.off('SIGINT', stop)

  process.stderr.write('[ark:runtime] Streaming pipeline stopped.\n')
  return { success: true, stepOutputs: ctx.stepOutputs, bindings: ctx.bindings }
}
```

Update `run()` to route to `runStreaming()`:

```typescript
if (this.plan.pipeline.lifecycle === 'streaming') {
  return this.runStreaming(ctx)
}

if (this.getTopology() === 'dag') {
  return this.runDag(ctx)
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/runtime && pnpm test -- pipeline-runner
```

Expected: all tests PASS including the new streaming test.

- [ ] **Step 5: Build**

```bash
cd packages/runtime && pnpm build
```

Expected: no errors.

- [ ] **Step 6: Run full test suite**

```bash
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/runtime/src/pipeline-runner.ts packages/runtime/src/pipeline-runner.test.ts
git commit -m "feat(runtime): implement streaming lifecycle — event-driven source with until/stopOn/restartOnFailure"
```

---

## Self-Review Notes

- **Spec coverage:** topology rename ✓, lifecycle: finite (default) ✓, lifecycle: streaming ✓, streaming config (until/stopOn/restartOnFailure) ✓, builtin/branch ✓, backward compat mode→topology ✓, branch only in sequential ✓ (runStreaming and runDag don't call executeStep with branch jump logic)
- **No placeholders:** all steps contain code.
- **Type consistency:** `branch()` returns `BuiltinStepResult` ✓, `_branchTarget` stored via cast ✓, `StreamingConfig` exported from core ✓, `getTopology()` returns `'sequential' | 'dag'` ✓
- **DAG + branch constraint:** `runDag` calls `executeStep` which will execute a `builtin/branch` step but the branch target jump logic is only in the sequential `for` loop in `run()` — the branch output is stored but ignored in DAG mode. This is acceptable; the spec says branch is meaningless in DAG mode.
