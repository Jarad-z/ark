export interface ChildRunOptions {
    /** npm package id, e.g. "@ark/cli-content" */
    packageId: string;
    /** command name to pass as first arg, e.g. "generate" */
    command: string | undefined;
    /** resolved input payload */
    inputs: Record<string, unknown>;
    /** monorepo root for resolving package entrypoints */
    monorepoRoot: string;
    /** if true, skip execution and return empty output */
    dryRun?: boolean;
    /** step id for error context */
    stepId: string;
}
export interface ChildRunResult {
    output: Record<string, unknown>;
    logs: string[];
}
/**
 * Runs a child CLI package as a subprocess using the JSON-over-stdio protocol.
 *
 * Input:  env ARK_INPUT_PAYLOAD = JSON.stringify(inputs)
 * Output: stdout line starting with "ARK_OUTPUT:" followed by JSON
 */
export declare class ChildCliRunner {
    run(options: ChildRunOptions): Promise<ChildRunResult>;
    private resolveEntrypoint;
}
//# sourceMappingURL=child-cli-runner.d.ts.map