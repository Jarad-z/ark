import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createInterface } from 'node:readline'
import { spawn } from 'node:child_process'
import * as yaml from 'js-yaml'
import { randomUUID } from 'node:crypto'
import {
  WiringPlanSchema,
  ValidationError,
  StepExecutionError,
  resolveInputs,
  applyBindings,
  interpolate,
  parseOutputLine,
} from '@ark/core'
import type { WiringPlan, PipelineContext, WiringStep } from '@ark/core'
import { createAiBridge } from '@ark/ai-bridge'
import type { AiBridge } from '@ark/ai-bridge'
import { ChildCliRunner } from './child-cli-runner.js'
import { StepResolver } from './step-resolver.js'
import { AutoModeOrchestrator } from './auto-mode-orchestrator.js'
import { buildDag } from './dag.js'
import { Scheduler } from './scheduler.js'
import { Display } from './display.js'
import type { StepTiming } from './display.js'

export interface PipelineRunnerOptions {
  wiringPath: string
  composedCliId: string
  monorepoRoot: string
  bridge?: AiBridge
}

export interface RunResult {
  success: boolean
  stepOutputs: Record<string, unknown>
  bindings: Record<string, unknown>
  error?: unknown
}

/**
 * Loads a WiringPlan and executes its steps, managing context, bindings,
 * auto-mode AI decisions, error policy, and dry-run interception.
 */
export class PipelineRunner {
  private plan: WiringPlan
  private resolver: StepResolver
  private orchestrator: AutoModeOrchestrator | undefined
  private display: Display

  constructor(private options: PipelineRunnerOptions) {
    this.plan = this.loadPlan(options.wiringPath)
    const childRunner = new ChildCliRunner()
    this.resolver = new StepResolver(childRunner, options.monorepoRoot)
    this.display = new Display()
  }

  /**
   * Returns the effective topology for this pipeline.
   * Prefers `topology` (new field) over `mode` (deprecated) for backward compat.
   */
  private getTopology(): 'sequential' | 'dag' {
    return this.plan.pipeline.topology ?? this.plan.pipeline.mode ?? 'sequential'
  }

  async run(argv: string[]): Promise<RunResult> {
    const { flags, dryRun, mode } = this.parseArgv(argv)

    const ctx: PipelineContext = {
      mode,
      flags,
      stepOutputs: {},
      bindings: {},
      dryRun,
      meta: {
        composedCliId: this.options.composedCliId,
        runId: randomUUID(),
        startedAt: new Date().toISOString(),
      },
    }

    if (mode === 'auto') {
      const bridge = this.options.bridge ?? createAiBridge()
      this.orchestrator = new AutoModeOrchestrator(bridge)
    }

    const steps = this.plan.steps
    const topology = this.getTopology()
    this.display.pipelineStart({
      runId: ctx.meta.runId,
      mode: topology,
      stepCount: steps.length,
    })

    // Pre-register all steps so the panel shows them from the start
    const dag = topology === 'dag' ? buildDag(steps) : new Map(steps.map(s => [s.id, [] as string[]]))
    for (const step of steps) {
      this.display.registerStep(step.id, step.uses, dag.get(step.id) ?? [])
    }

    if (this.plan.pipeline.lifecycle === 'streaming') {
      return this.runStreaming(ctx)
    }

    if (topology === 'dag') {
      return this.runDag(ctx, dag)
    }

    const wallStart = Date.now()
    const timings: StepTiming[] = []
    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]!

        // Branch jump: skip steps until we reach _branchTarget
        const target = (ctx as unknown as Record<string, unknown>)['_branchTarget'] as string | undefined
        if (target === '__end__') break
        if (target !== undefined && step.id !== target) {
          process.stderr.write(`[ark:runtime] Step "${step.id}" skipped (branch).\n`)
          continue
        }
        if (target !== undefined && step.id === target) {
          // Arrived at branch target — execute it, then stop
          await this.executeStep(step, ctx, undefined, timings)
          ;(ctx as unknown as Record<string, unknown>)['_branchTarget'] = '__end__'
          continue
        }

        await this.executeStep(step, ctx, undefined, timings)
      }
    } catch (err) {
      this.display.pipelineFailed(Date.now() - wallStart, err instanceof Error ? err : new Error(String(err)))
      return {
        success: false,
        stepOutputs: ctx.stepOutputs,
        bindings: ctx.bindings,
        error: err instanceof Error ? err.message : String(err),
      }
    }

    const wallMs = Date.now() - wallStart
    const sequentialMs = timings.reduce((sum, t) => sum + t.elapsedMs, 0)
    this.display.pipelineDone(wallMs, timings, sequentialMs)

    return {
      success: true,
      stepOutputs: ctx.stepOutputs,
      bindings: ctx.bindings,
    }
  }

  private async runDag(ctx: PipelineContext, dag: Map<string, string[]>): Promise<RunResult> {
    const concurrency = this.plan.pipeline.concurrency ?? Infinity
    const parallelBehavior = this.plan.errorPolicy?.parallelBehavior ?? 'failFast'
    const timings: StepTiming[] = []
    const wallStart = Date.now()

    const scheduler = new Scheduler({
      dag,
      concurrency,
      parallelBehavior,
      runStep: async (id: string, signal: AbortSignal) => {
        const step = this.plan.steps.find(s => s.id === id)!
        await this.executeStep(step, ctx, signal, timings, dag.get(id) ?? [])
      },
    })

    try {
      await scheduler.run()
      const wallMs = Date.now() - wallStart
      const sequentialMs = timings.reduce((sum, t) => sum + t.elapsedMs, 0)
      this.display.pipelineDone(wallMs, timings, sequentialMs)
      return {
        success: true,
        stepOutputs: ctx.stepOutputs,
        bindings: ctx.bindings,
      }
    } catch (err) {
      this.display.pipelineFailed(
        Date.now() - wallStart,
        err instanceof Error ? err : new Error(String(err))
      )
      return {
        success: false,
        stepOutputs: ctx.stepOutputs,
        bindings: ctx.bindings,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

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

    // Use an object so stop() always kills the *current* proc even after restarts
    const state = { proc: startSource(), stopped: false, error: undefined as unknown }

    const stop = () => {
      state.stopped = true
      try { state.proc.kill('SIGTERM') } catch { /* already dead */ }
    }

    const untilDelayMs = untilMs - Date.now()
    const untilTimer = isFinite(untilMs) && untilDelayMs > 0
      ? setTimeout(stop, untilDelayMs)
      : undefined

    // If until is already elapsed, stop immediately
    if (isFinite(untilMs) && untilDelayMs <= 0) stop()

    const sigTermHandler = () => stop()
    const sigIntHandler = () => stop()
    process.on('SIGTERM', sigTermHandler)
    process.on('SIGINT', sigIntHandler)

    const processLine = async (line: string) => {
      const parsed = parseOutputLine(line)
      if (parsed === undefined) return

      if (sourceStep.outputs?.bind) {
        applyBindings(
          sourceStep.outputs.bind,
          parsed as Record<string, unknown>,
          ctx as unknown as Record<string, unknown>
        )
      }

      for (const step of downstreamSteps) {
        if (!state.stopped) {
          try {
            await this.executeStep(step, ctx, undefined, [])
          } catch (err) {
            state.error = err
            stop()
            return
          }
        }
      }

      if (stopOn) {
        const result = interpolate(stopOn, ctx as unknown as Record<string, unknown>)
        if (result) stop()
      }
    }

    const runUntilExit = (p: ReturnType<typeof spawn>): Promise<void> =>
      new Promise((res) => {
        const rl = createInterface({ input: p.stdout!, crlfDelay: Infinity })
        rl.on('line', (line) => { processLine(line).catch((err) => { state.error = err; stop() }) })
        p.on('close', res)
      })

    while (!state.stopped) {
      await runUntilExit(state.proc)
      if (state.stopped) break
      if (restartOnFailure) {
        process.stderr.write('[ark:runtime] Source CLI exited, restarting...\n')
        state.proc = startSource()
      } else {
        break
      }
    }

    if (untilTimer) clearTimeout(untilTimer)
    process.off('SIGTERM', sigTermHandler)
    process.off('SIGINT', sigIntHandler)

    process.stderr.write('[ark:runtime] Streaming pipeline stopped.\n')

    if (state.error !== undefined) {
      return {
        success: false,
        stepOutputs: ctx.stepOutputs,
        bindings: ctx.bindings,
        error: state.error instanceof Error ? state.error.message : String(state.error),
      }
    }

    return { success: true, stepOutputs: ctx.stepOutputs, bindings: ctx.bindings }
  }

  private async executeStep(
    step: WiringStep,
    ctx: PipelineContext,
    signal?: AbortSignal,
    timings?: StepTiming[],
    deps: string[] = []
  ): Promise<void> {
    // Auto-mode: fire AI decision before this step if configured
    if (ctx.mode === 'auto' && this.orchestrator?.shouldFireBefore(this.plan, step.id)) {
      await this.orchestrator.runDecision(this.plan, ctx)
    }

    // Evaluate condition
    if (step.condition !== undefined) {
      const { interpolate } = await import('@ark/core')
      const condResult = interpolate(step.condition, ctx as unknown as Record<string, unknown>)
      if (!condResult) {
        this.display.stepSkipped(step.id)
        return
      }
    }

    this.display.stepStart(step.id, step.uses, deps)
    const stepStart = Date.now()

    // Resolve inputs against current context
    const resolvedInputs = resolveInputs(
      step.inputs as Record<string, unknown>,
      ctx as unknown as Record<string, unknown>
    )

    // Get executor and run
    const parallelBehavior = this.plan.errorPolicy?.parallelBehavior ?? 'failFast'
    const executor = this.resolver.resolve(step, ctx.dryRun, parallelBehavior, signal)

    let result: { output: Record<string, unknown>; skipped?: boolean }
    try {
      result = await this.runWithRetry(step, executor, resolvedInputs, ctx)
    } catch (err) {
      const elapsedMs = Date.now() - stepStart
      this.display.stepFailed(step.id, err instanceof Error ? err : new Error(String(err)), elapsedMs)
      timings?.push({ id: step.id, elapsedMs })
      throw err
    }

    const elapsedMs = Date.now() - stepStart

    if (result.skipped) {
      this.display.stepSkipped(step.id)
      return
    }

    this.display.stepDone(step.id, elapsedMs)
    timings?.push({ id: step.id, elapsedMs })

    // Store raw step output
    ;(ctx.stepOutputs as Record<string, unknown>)[step.id] = result.output

    // Handle builtin/branch jump
    if (step.uses === 'builtin/branch') {
      const nextId = (result.output as Record<string, unknown>)['next']
      if (typeof nextId === 'string') {
        ;(ctx as unknown as Record<string, unknown>)['_branchTarget'] = nextId
      } else {
        ;(ctx as unknown as Record<string, unknown>)['_branchTarget'] = '__end__'
      }
    }

    // Apply output bindings to ctx.bindings (skip in dry-run — output is empty)
    if (step.outputs?.bind && !ctx.dryRun) {
      applyBindings(
        step.outputs.bind,
        result.output,
        ctx as unknown as Record<string, unknown>
      )
    }
  }

  private async runWithRetry(
    step: WiringStep,
    executor: (inputs: Record<string, unknown>, ctx: PipelineContext) => Promise<{ output: Record<string, unknown>; skipped?: boolean }>,
    inputs: Record<string, unknown>,
    ctx: PipelineContext
  ): Promise<{ output: Record<string, unknown>; skipped?: boolean }> {
    const errorPolicy = this.plan.errorPolicy
    const maxAttempts = errorPolicy?.retryPolicy?.maxAttempts ?? 1
    const backoffMs = errorPolicy?.retryPolicy?.backoffMs ?? 1000
    const onFailure = errorPolicy?.onStepFailure ?? 'abort'

    let lastError: unknown
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await executor(inputs, ctx)
      } catch (err) {
        lastError = err
        if (onFailure === 'abort') {
          throw new StepExecutionError(
            `Step "${step.id}" failed: ${String(err)}`,
            step.id,
            err
          )
        }
        if (onFailure === 'continue') {
          return { output: {} }
        }
        // retry
        if (attempt < maxAttempts) {
          const delay = backoffMs * attempt
          await sleep(delay)
        }
      }
    }

    throw new StepExecutionError(
      `Step "${step.id}" failed after ${maxAttempts} attempts: ${String(lastError)}`,
      step.id,
      lastError
    )
  }

  private loadPlan(wiringPath: string): WiringPlan {
    const absPath = resolve(wiringPath)
    let raw: unknown
    try {
      raw = yaml.load(readFileSync(absPath, 'utf8'))
    } catch (err) {
      throw new ValidationError(`Failed to read ark-wiring.yaml at ${absPath}: ${String(err)}`, [])
    }

    const result = WiringPlanSchema.safeParse(raw)
    if (!result.success) {
      const issues = result.error.issues.map(
        (i: { path: (string | number)[]; message: string }) => `${i.path.join('.')}: ${i.message}`
      )
      throw new ValidationError('Invalid ark-wiring.yaml', issues)
    }
    return result.data
  }

  private parseArgv(argv: string[]): {
    flags: Record<string, unknown>
    dryRun: boolean
    mode: 'auto' | 'manual'
  } {
    const flags: Record<string, unknown> = {}
    let dryRun = false
    let mode: 'auto' | 'manual' = 'manual'

    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i]!
      if (arg === '--auto') {
        mode = 'auto'
      } else if (arg === '--dry-run') {
        dryRun = true
      } else if (arg.startsWith('--')) {
        const key = arg.slice(2)
        const next = argv[i + 1]
        if (next && !next.startsWith('--')) {
          flags[key] = next
          i++
        } else {
          flags[key] = true
        }
      }
    }

    return { flags, dryRun, mode }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
