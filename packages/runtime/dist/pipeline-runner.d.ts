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
    constructor(options: PipelineRunnerOptions);
    run(argv: string[]): Promise<RunResult>;
    private executeStep;
    private runWithRetry;
    private loadPlan;
    private parseArgv;
}
//# sourceMappingURL=pipeline-runner.d.ts.map