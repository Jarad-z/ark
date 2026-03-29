import { readInputPayload, writeOutput, loadDescriptor } from '@ark/core';
import { MultiCommandRunner } from './multi-command-runner.js';
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
export async function runComposedCli(options) {
    const { packageDir, composedCliId, monorepoRoot, bridge } = options;
    const payload = readInputPayload();
    if (payload !== undefined) {
        // ── Leaf mode ────────────────────────────────────────────────────────────
        //
        // Command resolution priority:
        //   1. process.argv[2]  — ChildCliRunner passes step.command as first arg
        //   2. descriptor.functional.defaultCommand
        //   3. undefined → MultiCommandRunner falls back to ark-wiring.yaml
        let command = process.argv[2] && !process.argv[2].startsWith('--')
            ? process.argv[2]
            : undefined;
        if (!command) {
            try {
                const desc = loadDescriptor(packageDir);
                command = desc.functional.defaultCommand;
            }
            catch {
                // descriptor missing or invalid — use fallback
            }
        }
        const argv = command ? [command] : [];
        const runner = new MultiCommandRunner({
            packageDir, composedCliId, monorepoRoot,
            ...(bridge !== undefined ? { bridge } : {}),
        });
        const result = await runner.run(argv);
        writeOutput(result.bindings);
        process.exit(result.success ? 0 : 1);
    }
    // ── Direct mode ─────────────────────────────────────────────────────────────
    const runner = new MultiCommandRunner({
        packageDir, composedCliId, monorepoRoot,
        ...(bridge !== undefined ? { bridge } : {}),
    });
    const argv = process.argv.slice(2);
    if (!argv[0] || argv[0] === '--help' || argv[0] === '-h') {
        runner.printHelp();
        process.exit(0);
    }
    const result = await runner.run(argv);
    process.exit(result.success ? 0 : 1);
}
//# sourceMappingURL=run-composed-cli.js.map