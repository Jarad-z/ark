import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as yaml from 'js-yaml'
import { randomUUID } from 'node:crypto'
import {
  WiringPlanSchema,
  ValidationError,
  StepExecutionError,
  resolveInputs,
  applyBindings,
} from '@ark/core'
import type { WiringPlan, PipelineContext, WiringStep } from '@ark/core'
import { createAiBridge } from '@ark/ai-bridge'
import type { AiBridge } from '@ark/ai-bridge'
import { ChildCliRunner } from './child-cli-runner.js'
import { StepResolver } from './step-resolver.js'
import { AutoModeOrchestrator } from './auto-mode-orchestrator.js'
import { buildDag } from './dag.js'
import { Scheduler } from './scheduler.js'

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

  constructor(private options: PipelineRunnerOptions) {
    this.plan = this.loadPlan(options.wiringPath)
    const childRunner = new ChildCliRunner()
    this.resolver = new StepResolver(childRunner, options.monorepoRoot)
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

    process.stderr.write(
      `[ark:runtime] Starting pipeline "${this.options.composedCliId}" ` +
        `(mode=${mode}, dryRun=${dryRun}, runId=${ctx.meta.runId})\n`
    )

    if (this.plan.pipeline.mode === 'dag') {
      return this.runDag(ctx)
    }

    const steps = this.plan.steps
    for (const step of steps) {
      await this.executeStep(step, ctx)
    }

    process.stderr.write(`[ark:runtime] Pipeline completed successfully.\n`)

    return {
      success: true,
      stepOutputs: ctx.stepOutputs,
      bindings: ctx.bindings,
    }
  }

  private async runDag(ctx: PipelineContext): Promise<RunResult> {
    const dag = buildDag(this.plan.steps)
    const concurrency = this.plan.pipeline.concurrency ?? Infinity
    const parallelBehavior = this.plan.errorPolicy?.parallelBehavior ?? 'failFast'

    const scheduler = new Scheduler({
      dag,
      concurrency,
      parallelBehavior,
      runStep: async (id: string, signal: AbortSignal) => {
        const step = this.plan.steps.find(s => s.id === id)!
        await this.executeStep(step, ctx, signal)
      },
    })

    try {
      await scheduler.run()
      process.stderr.write(`[ark:runtime] Pipeline completed successfully.\n`)
      return {
        success: true,
        stepOutputs: ctx.stepOutputs,
        bindings: ctx.bindings,
      }
    } catch (err) {
      return {
        success: false,
        stepOutputs: ctx.stepOutputs,
        bindings: ctx.bindings,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  private async executeStep(step: WiringStep, ctx: PipelineContext, signal?: AbortSignal): Promise<void> {
    // Auto-mode: fire AI decision before this step if configured
    if (ctx.mode === 'auto' && this.orchestrator?.shouldFireBefore(this.plan, step.id)) {
      await this.orchestrator.runDecision(this.plan, ctx)
    }

    // Evaluate condition
    if (step.condition !== undefined) {
      const { interpolate } = await import('@ark/core')
      const condResult = interpolate(step.condition, ctx as unknown as Record<string, unknown>)
      if (!condResult) {
        process.stderr.write(`[ark:runtime] Step "${step.id}" skipped (condition false).\n`)
        return
      }
    }

    process.stderr.write(`[ark:runtime] Running step "${step.id}" (uses=${step.uses})...\n`)

    // Resolve inputs against current context
    const resolvedInputs = resolveInputs(
      step.inputs as Record<string, unknown>,
      ctx as unknown as Record<string, unknown>
    )

    // Get executor and run
    const parallelBehavior = this.plan.errorPolicy?.parallelBehavior ?? 'failFast'
    const executor = this.resolver.resolve(step, ctx.dryRun, parallelBehavior, signal)
    const result = await this.runWithRetry(step, executor, resolvedInputs, ctx)

    if (result.skipped) {
      process.stderr.write(`[ark:runtime] Step "${step.id}" skipped (builtin conditional).\n`)
      return
    }

    // Store raw step output
    ;(ctx.stepOutputs as Record<string, unknown>)[step.id] = result.output

    // Apply output bindings to ctx.bindings (skip in dry-run — output is empty)
    if (step.outputs?.bind && !ctx.dryRun) {
      applyBindings(
        step.outputs.bind,
        result.output,
        ctx as unknown as Record<string, unknown>
      )
    }

    process.stderr.write(`[ark:runtime] Step "${step.id}" completed.\n`)
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
          process.stderr.write(`[ark:runtime] Step "${step.id}" failed (continuing): ${String(err)}\n`)
          return { output: {} }
        }
        // retry
        if (attempt < maxAttempts) {
          const delay = backoffMs * attempt
          process.stderr.write(
            `[ark:runtime] Step "${step.id}" failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms...\n`
          )
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
