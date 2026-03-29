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
/**
 * builtin/parallel-map
 * Runs a CLI step once per item in an array, collecting results in order.
 */
export declare function parallelMap(inputs: Record<string, unknown>, ctx: PipelineContext, runChild: (packageId: string, command: string | undefined, inputs: Record<string, unknown>, signal: AbortSignal) => Promise<Record<string, unknown>>, parallelBehavior: 'failFast' | 'waitAll'): Promise<BuiltinStepResult>;
export interface BranchRoute {
    condition: unknown;
    next: string;
}
/**
 * builtin/branch
 * Evaluates routes in order and returns the `next` step id for the first
 * truthy condition. Returns { next: null } if no match and no default.
 * The PipelineRunner reads output.next to jump execution.
 */
export declare function branch(inputs: Record<string, unknown>): Promise<BuiltinStepResult>;
//# sourceMappingURL=builtin-steps.d.ts.map