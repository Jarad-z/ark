import type { CliDescriptor, ComposeRequest } from '@ark/core';
/**
 * Builds the AI prompt for composition planning.
 * The quality of the generated WiringPlan depends entirely on this prompt.
 */
export declare class CompositionPromptBuilder {
    build(request: ComposeRequest, descriptors: Map<string, CliDescriptor>): string;
}
//# sourceMappingURL=composition-prompt-builder.d.ts.map