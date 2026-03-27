export interface CompositionPlanResult {
    rationale: string;
    wiringYaml: string;
}
export interface RuntimeDecisionResult {
    bindings: Record<string, unknown>;
    reasoning?: string;
}
export interface ContentGenerationResult {
    content: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
}
/**
 * AiBridge abstracts all AI provider interactions.
 * Swap providers by implementing this interface and setting ARK_AI_PROVIDER.
 */
export interface AiBridge {
    /**
     * Given serialized parent descriptors + user intent, produce a WiringPlan YAML.
     */
    planComposition(prompt: string): Promise<CompositionPlanResult>;
    /**
     * During --auto mode, make a runtime decision and return key/value bindings
     * to inject into the pipeline context.
     */
    makeRuntimeDecision(prompt: string, context: Record<string, unknown>): Promise<RuntimeDecisionResult>;
    /**
     * General-purpose content generation (used by cli-content and similar leaf CLIs).
     */
    generateContent(prompt: string): Promise<ContentGenerationResult>;
}
//# sourceMappingURL=types.d.ts.map