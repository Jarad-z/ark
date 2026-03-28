import type { WiringStep, PipelineContext } from '@ark/core'
import { StepExecutionError } from '@ark/core'
import { humanReview, log, conditional, parallelMap } from './builtin-steps.js'
import type { BuiltinStepResult } from './builtin-steps.js'
import type { ChildCliRunner } from './child-cli-runner.js'

export type StepExecutor = (
  inputs: Record<string, unknown>,
  ctx: PipelineContext
) => Promise<BuiltinStepResult>

const BUILTIN_MAP: Record<string, StepExecutor> = {
  'builtin/human-review': humanReview,
  'builtin/log': (inputs) => log(inputs),
  'builtin/conditional': (inputs) => conditional(inputs),
}

function parseTimeout(t: string): number {
  const match = t.match(/^(\d+)([sm])$/)
  if (!match) throw new Error(`Invalid timeout format: ${t}`)
  const n = match[1]!
  const unit = match[2]!
  return parseInt(n, 10) * (unit === 'm' ? 60000 : 1000)
}

function withTimeout(executor: StepExecutor, timeoutMs: number, outerSignal?: AbortSignal): StepExecutor {
  return async (inputs: Record<string, unknown>, ctx: PipelineContext) => {
    const ctrl = new AbortController()

    const forwardAbort = () => ctrl.abort()
    outerSignal?.addEventListener('abort', forwardAbort, { once: true })

    const timer = setTimeout(() => ctrl.abort(), timeoutMs)

    try {
      return await Promise.race([
        executor(inputs, ctx),
        new Promise<never>((_, reject) => {
          ctrl.signal.addEventListener(
            'abort',
            () => reject(new Error('Step timed out')),
            { once: true }
          )
        }),
      ])
    } finally {
      clearTimeout(timer)
      outerSignal?.removeEventListener('abort', forwardAbort)
    }
  }
}

export class StepResolver {
  constructor(
    private childRunner: ChildCliRunner,
    private monorepoRoot: string
  ) {}

  resolve(step: WiringStep, dryRun: boolean, parallelBehavior: 'failFast' | 'waitAll' = 'failFast', signal?: AbortSignal): StepExecutor {
    const executor = this.buildExecutor(step, dryRun, parallelBehavior)

    if (step.timeout) {
      const timeoutMs = parseTimeout(step.timeout)
      return withTimeout(executor, timeoutMs, signal)
    }

    return executor
  }

  private buildExecutor(step: WiringStep, dryRun: boolean, parallelBehavior: 'failFast' | 'waitAll'): StepExecutor {
    // builtin/parallel-map requires ChildCliRunner access
    if (step.uses === 'builtin/parallel-map') {
      const runner = this.childRunner
      const monorepoRoot = this.monorepoRoot
      return async (inputs: Record<string, unknown>, ctx: PipelineContext) => {
        const runChild = (
          packageId: string,
          command: string | undefined,
          childInputs: Record<string, unknown>,
          childSignal: AbortSignal
        ) =>
          runner
            .run({
              packageId,
              command,
              inputs: childInputs,
              monorepoRoot,
              dryRun: dryRun || ctx.dryRun,
              signal: childSignal,
            })
            .then(r => r.output)
        return parallelMap(inputs, ctx, runChild, parallelBehavior)
      }
    }

    // Other built-in steps
    const builtin = BUILTIN_MAP[step.uses]
    if (builtin) return builtin

    // External package step — delegate to ChildCliRunner
    const { uses: packageId, command, id: stepId } = step
    const runner = this.childRunner

    return async (inputs: Record<string, unknown>, ctx: PipelineContext) => {
      const result = await runner.run({
        packageId,
        command,
        inputs,
        monorepoRoot: this.monorepoRoot,
        dryRun: dryRun || ctx.dryRun,
        stepId,
      })
      return { output: result.output }
    }
  }

  isBuiltin(uses: string): boolean {
    return uses in BUILTIN_MAP || uses === 'builtin/parallel-map'
  }

  assertKnown(step: WiringStep): void {
    if (!this.isBuiltin(step.uses) && !step.uses.startsWith('@')) {
      throw new StepExecutionError(
        `Unknown step uses value: "${step.uses}". Expected a builtin/* or @scope/package.`,
        step.id
      )
    }
  }
}
