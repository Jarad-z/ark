import type { AiBridge, CompositionPlanResult, ContentGenerationResult, RuntimeDecisionResult } from './types.js';
export declare class AnthropicBridge implements AiBridge {
    private client;
    private model;
    constructor(options?: {
        apiKey?: string;
        model?: string;
    });
    planComposition(prompt: string): Promise<CompositionPlanResult>;
    makeRuntimeDecision(prompt: string, context: Record<string, unknown>): Promise<RuntimeDecisionResult>;
    generateContent(prompt: string): Promise<ContentGenerationResult>;
}
//# sourceMappingURL=anthropic-bridge.d.ts.map