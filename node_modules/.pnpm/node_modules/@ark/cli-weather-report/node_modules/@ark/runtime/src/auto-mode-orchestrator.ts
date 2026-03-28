import type { WiringPlan, PipelineContext } from '@ark/core'
import type { AiBridge } from '@ark/ai-bridge'

/**
 * In --auto mode, fires an AI decision call before the configured step
 * and injects the returned bindings into the pipeline context flags.
 */
export class AutoModeOrchestrator {
  constructor(private bridge: AiBridge) {}

  /**
   * Returns true if the auto decision step should fire before the given stepId.
   */
  shouldFireBefore(plan: WiringPlan, stepId: string): boolean {
    return plan.autoMode?.decisionStep.before === stepId
  }

  async runDecision(
    plan: WiringPlan,
    ctx: PipelineContext
  ): Promise<void> {
    const decisionStep = plan.autoMode?.decisionStep
    if (!decisionStep) return

    process.stderr.write('[ark:runtime] [auto] Running AI decision step...\n')

    const result = await this.bridge.makeRuntimeDecision(
      decisionStep.prompt,
      { flags: ctx.flags, mode: ctx.mode }
    )

    // Apply outputBindings: { topic: "ctx.flags.topic" } → ctx.flags.topic = result.topic
    for (const [bindingKey, ctxPath] of Object.entries(decisionStep.outputBindings)) {
      const value = result.bindings[bindingKey]
      if (value === undefined) continue

      // Parse ctxPath like "ctx.flags.topic" → set ctx.flags.topic
      const cleanPath = ctxPath.startsWith('ctx.') ? ctxPath.slice(4) : ctxPath
      const parts = cleanPath.split('.')

      if (parts[0] === 'flags' && parts.length === 2 && parts[1]) {
        ;(ctx.flags as Record<string, unknown>)[parts[1]] = value
        process.stderr.write(`[ark:runtime] [auto] Set ctx.flags.${parts[1]} = ${JSON.stringify(value)}\n`)
      }
    }

    if (result.reasoning) {
      process.stderr.write(`[ark:runtime] [auto] AI reasoning: ${result.reasoning.slice(0, 200)}...\n`)
    }
  }
}
