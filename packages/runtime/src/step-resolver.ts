import type { WiringStep, PipelineContext } from '@ark/core'
import { StepExecutionError } from '@ark/core'
import { humanReview, log, conditional } from './builtin-steps.js'
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

export class StepResolver {
  constructor(
    private childRunner: ChildCliRunner,
    private monorepoRoot: string
  ) {}

  resolve(step: WiringStep, dryRun: boolean): StepExecutor {
    // Built-in step
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
    return uses in BUILTIN_MAP
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
