import type { AiBridge } from '@ark/ai-bridge';
export interface RunComposedCliOptions {
    /** Absolute path to the package root (contains ark-descriptor.yaml) */
    packageDir: string;
    composedCliId: string;
    monorepoRoot: string;
    bridge?: AiBridge;
}
/**
 * Dual-mode entry point for composed CLIs.
 *
 * - **Leaf mode**: detected when ARK_INPUT_PAYLOAD env var is set.
 *   Runs the appropriate wiring plan for the given command and writes
 *   ARK_OUTPUT to stdout so the parent pipeline can read it.
 *
 * - **Direct mode**: normal CLI invocation via process.argv.
 *   Delegates to MultiCommandRunner.
 *
 * Command resolution when called as a leaf (in priority order):
 *   1. `command` field on the wiring step  →  wirings/<command>.yaml
 *   2. `defaultCommand` in ark-descriptor.yaml  →  wirings/<defaultCommand>.yaml
 *   3. ark-wiring.yaml
 */
export declare function runComposedCli(options: RunComposedCliOptions): Promise<void>;
//# sourceMappingURL=run-composed-cli.d.ts.map