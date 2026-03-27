import type { AiBridge, CompositionPlanResult } from '@ark/ai-bridge'
import type { CliDescriptor, ComposeRequest } from '@ark/core'
import { CompositionPromptBuilder } from './composition-prompt-builder.js'

export interface PlannerSessionResult extends CompositionPlanResult {
  prompt: string
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

    return { ...result, prompt }
  }
}
