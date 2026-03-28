import type { AiBridge } from '@ark/ai-bridge';
import type { RunResult } from './pipeline-runner.js';
export interface MultiCommandRunnerOptions {
    /** Directory of the composed CLI package (contains ark-descriptor.yaml) */
    packageDir: string;
    composedCliId: string;
    monorepoRoot: string;
    bridge?: AiBridge;
}
/**
 * Routes argv[0] to the correct wiring plan for composed CLIs with multiple commands.
 *
 * Resolution order for a command "review-pr":
 *   1. wirings/review-pr.yaml          (multi-wiring directory)
 *   2. wiringRef from descriptor command definition
 *   3. ark-wiring.yaml                 (fallback for single-command CLIs)
 */
export declare class MultiCommandRunner {
    private options;
    constructor(options: MultiCommandRunnerOptions);
    run(argv: string[]): Promise<RunResult>;
    private resolveWiringPath;
    /** Print available commands from descriptor */
    printHelp(): void;
}
//# sourceMappingURL=multi-command-runner.d.ts.map