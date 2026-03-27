"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAiBridge = createAiBridge;
const anthropic_bridge_js_1 = require("./anthropic-bridge.js");
/**
 * Create an AiBridge instance based on environment configuration.
 * ARK_AI_PROVIDER: 'anthropic' (default)
 * ARK_AI_MODEL: model ID override
 * ANTHROPIC_API_KEY: required for anthropic provider
 */
function createAiBridge() {
    const provider = process.env['ARK_AI_PROVIDER'] ?? 'anthropic';
    switch (provider) {
        case 'anthropic':
            return new anthropic_bridge_js_1.AnthropicBridge();
        default:
            throw new Error(`Unknown AI provider: "${provider}". Set ARK_AI_PROVIDER to a supported value (anthropic).`);
    }
}
//# sourceMappingURL=factory.js.map