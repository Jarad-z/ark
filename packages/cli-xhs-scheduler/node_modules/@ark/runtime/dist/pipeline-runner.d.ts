import type { AiBridge } from '@ark/ai-bridge';
export interface PipelineRunnerOptions {
    wiringPath: string;
    composedCliId: string;
    monorepoRoot: string;
    bridge?: AiBridge;
}
export interface RunResult {
    success: boolean;
    stepOutputs: Record<string, unknown>;
    bindings: Record<string, unknown>;
    error?: unknown;
}
/**
 * Loads a WiringPlan and executes its steps, managing context, bindings,
 * auto-mode AI decisions, error policy, and dry-run interception.
 */
export declare class PipelineRunner {
    private options;
    private plan;
    private resolver;
    private orchestrator;
    private display;
    constructor(options: PipelineRunnerOptions);
    /**
     * Returns the effective topology for this pipeline.
     * Prefers `topology` (new field) over `mode` (deprecated) for backward compat.
     */
    private getTopology;
    run(argv: string[]): Promise<RunResult>;
    private runDag;
    private runStreaming;
    private executeStep;
    private runWithRetry;
    private loadPlan;
    private parseArgv;
}
//# sourceMappingURL=pipeline-runner.d.ts.map