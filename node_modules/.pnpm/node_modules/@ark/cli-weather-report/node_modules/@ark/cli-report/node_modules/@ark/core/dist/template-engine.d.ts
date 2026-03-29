/**
 * Minimal template engine supporting {{ ctx.x }} and {{ ctx.a ?? ctx.b }}
 * style interpolation over a flat or nested context object.
 *
 * Supported syntax:
 *   {{ path }}                     – resolve path in context
 *   {{ path | default: 'value' }}  – resolve with fallback string
 *   {{ a ? b : c }}                – ternary (paths resolved, no eval)
 */
export declare function interpolate(template: string, ctx: Record<string, unknown>): unknown;
/**
 * Resolve all input values in a step's inputs map against the pipeline context.
 */
export declare function resolveInputs(inputs: Record<string, unknown>, ctx: Record<string, unknown>): Record<string, unknown>;
/**
 * Apply output bindings from a step result to the pipeline context.
 * bind: { generatedPost: "post" } means ctx.bindings.generatedPost = stepOutput.post
 */
export declare function applyBindings(bind: Record<string, unknown>, stepOutput: Record<string, unknown>, ctx: Record<string, unknown>): void;
//# sourceMappingURL=template-engine.d.ts.map