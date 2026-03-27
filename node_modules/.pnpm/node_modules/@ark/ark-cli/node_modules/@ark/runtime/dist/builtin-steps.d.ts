import type { PipelineContext } from '@ark/core';
export interface BuiltinStepResult {
    output: Record<string, unknown>;
    skipped?: boolean;
}
/**
 * builtin/human-review
 * Presents the payload to the user and waits for approval or inline edit.
 * In --dry-run mode, auto-approves without prompting.
 */
export declare function humanReview(inputs: Record<string, unknown>, ctx: PipelineContext): Promise<BuiltinStepResult>;
/**
 * builtin/log
 * Writes a message to stdout.
 */
export declare function log(inputs: Record<string, unknown>): Promise<BuiltinStepResult>;
/**
 * builtin/conditional
 * Passes `value` through if `condition` is truthy, otherwise skips.
 */
export declare function conditional(inputs: Record<string, unknown>): Promise<BuiltinStepResult>;
//# sourceMappingURL=builtin-steps.d.ts.map