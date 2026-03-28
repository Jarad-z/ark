import type { AiBridge, CompositionPlanResult } from '@ark/ai-bridge'
import type { CliDescriptor, ComposeRequest, WiringStep } from '@ark/core'
import { WiringPlanSchema } from '@ark/core'
import * as yaml from 'js-yaml'
import { CompositionPromptBuilder } from './composition-prompt-builder.js'

export interface ParallelSuggestion {
  stepIds: string[]
  sequentialMs: number
  recommendation: 'failFast' | 'waitAll'
  reason: string
}

export interface PlannerSessionResult extends CompositionPlanResult {
  prompt: string
  parallelSuggestion?: ParallelSuggestion
}

/**
 * Returns true if stepB depends on an output binding produced by stepA.
 */
function hasDataDependency(stepA: WiringStep, stepB: WiringStep): boolean {
  const aBindings = new Set(Object.keys(stepA.outputs?.bind ?? {}))
  const bInputValues = Object.values(stepB.inputs ?? {})
  return bInputValues.some(
    v => typeof v === 'string' && [...aBindings].some(b => v.includes(`ctx.bindings.${b}`))
  )
}

/**
 * Returns steps that do not consume any output binding from any other step
 * in the plan (i.e. steps with no inferred data dependencies).
 */
function findIndependentSteps(steps: WiringStep[]): WiringStep[] {
  return steps.filter(step =>
    !steps.some(other => other.id !== step.id && hasDataDependency(other, step))
  )
}

function detectParallelSuggestion(wiringYaml: string): ParallelSuggestion | undefined {
  const parsed = WiringPlanSchema.safeParse(yaml.load(wiringYaml))
  if (!parsed.success) {
    return undefined
  }

  const steps = parsed.data.steps
  const independentSteps = findIndependentSteps(steps)

  if (independentSteps.length < 2) {
    return undefined
  }

  // If all independent steps produce bindings that are consumed downstream → failFast
  const allOutputsUsed = independentSteps.every(s =>
    Object.keys(s.outputs?.bind ?? {}).some(binding =>
      steps.some(
        other =>
          other.id !== s.id &&
          JSON.stringify(other.inputs ?? {}).includes(`ctx.bindings.${binding}`)
      )
    )
  )

  return {
    stepIds: independentSteps.map(s => s.id),
    sequentialMs: 0,
    recommendation: allOutputsUsed ? 'failFast' : 'waitAll',
    reason: allOutputsUsed
      ? 'All parallel results are required downstream — failFast avoids wasted work on failure.'
      : 'Not all results are required downstream — waitAll allows partial success.',
  }
}

export class AiPlannerSession {
  private builder = new CompositionPromptBuilder()

  constructor(private bridge: AiBridge) {}

  async run(
    request: ComposeRequest,
    descriptors: Map<string, CliDescriptor>
  ): Promise<PlannerSessionResult> {
    const prompt = this.builder.build(request, descriptors)

    process.stderr.write('[ark:composer] Calling AI to generate wiring plan...\n')
    const result = await this.bridge.planComposition(prompt)
    process.stderr.write('[ark:composer] AI response received.\n')

    const parallelSuggestion = detectParallelSuggestion(result.wiringYaml)

    return {
      ...result,
      prompt,
      ...(parallelSuggestion !== undefined ? { parallelSuggestion } : {}),
    }
  }
}
