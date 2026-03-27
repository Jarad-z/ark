import type { AiBridge } from './types.js'
import { AnthropicBridge } from './anthropic-bridge.js'

/**
 * Create an AiBridge instance based on environment configuration.
 * ARK_AI_PROVIDER: 'anthropic' (default)
 * ARK_AI_MODEL: model ID override
 * ANTHROPIC_API_KEY: required for anthropic provider
 */
export function createAiBridge(): AiBridge {
  const provider = process.env['ARK_AI_PROVIDER'] ?? 'anthropic'

  switch (provider) {
    case 'anthropic':
      return new AnthropicBridge()
    default:
      throw new Error(
        `Unknown AI provider: "${provider}". Set ARK_AI_PROVIDER to a supported value (anthropic).`
      )
  }
}
