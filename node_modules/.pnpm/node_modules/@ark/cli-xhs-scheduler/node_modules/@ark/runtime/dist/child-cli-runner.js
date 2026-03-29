import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execa } from 'execa';
import { ARK_INPUT_ENV, parseOutputLine, StepExecutionError, DescriptorNotFoundError, } from '@ark/core';
/**
 * Runs a child CLI package as a subprocess using the JSON-over-stdio protocol.
 *
 * Input:  env ARK_INPUT_PAYLOAD = JSON.stringify(inputs)
 * Output: stdout line starting with "ARK_OUTPUT:" followed by JSON
 */
export class ChildCliRunner {
    async run(options) {
        const { packageId, command, inputs, monorepoRoot, dryRun, stepId, signal } = options;
        if (dryRun) {
            process.stdout.write(`[ark:runtime] [dry-run] Would run ${packageId}${command ? ` ${command}` : ''}\n`);
            process.stdout.write(`[ark:runtime] [dry-run] Inputs: ${JSON.stringify(inputs)}\n`);
            return { output: {}, logs: [] };
        }
        const entrypoint = this.resolveEntrypoint(packageId, monorepoRoot);
        const args = command ? [command] : [];
        const logs = [];
        let arkOutput;
        const proc = execa('node', [entrypoint, ...args], {
            env: {
                ...process.env,
                [ARK_INPUT_ENV]: JSON.stringify(inputs),
            },
            reject: false,
            all: false,
        });
        let abortHandler;
        if (signal) {
            abortHandler = () => {
                proc.kill('SIGTERM');
                const killTimer = setTimeout(() => {
                    try {
                        proc.kill('SIGKILL');
                    }
                    catch { /* already exited */ }
                }, 2000);
                proc.then(() => clearTimeout(killTimer)).catch(() => clearTimeout(killTimer));
            };
            signal.addEventListener('abort', abortHandler, { once: true });
        }
        const result = await proc;
        if (abortHandler && signal) {
            signal.removeEventListener('abort', abortHandler);
        }
        if (signal?.aborted) {
            throw new Error('Step cancelled');
        }
        // Process stdout line by line
        for (const line of (result.stdout ?? '').split('\n')) {
            const parsed = parseOutputLine(line);
            if (parsed !== undefined) {
                arkOutput = parsed;
            }
            else if (line.trim()) {
                // Forward non-ARK lines to terminal
                process.stdout.write(line + '\n');
                logs.push(line);
            }
        }
        // Forward stderr
        if (result.stderr) {
            process.stderr.write(result.stderr);
        }
        if (result.exitCode !== 0) {
            throw new StepExecutionError(`Child CLI "${packageId}" exited with code ${result.exitCode}`, stepId ?? packageId, result.stderr);
        }
        if (arkOutput === undefined) {
            // No ARK_OUTPUT line — treat as empty output (leaf CLIs may not emit one)
            return { output: {}, logs };
        }
        return { output: arkOutput, logs };
    }
    resolveEntrypoint(packageId, monorepoRoot) {
        // Strip scope: @ark/cli-xhs → cli-xhs
        const name = packageId.includes('/') ? packageId.split('/').slice(1).join('/') : packageId;
        const searchRoots = [
            join(monorepoRoot, 'packages', name),
            join(monorepoRoot, 'tools', name),
        ];
        for (const dir of searchRoots) {
            // Read package.json to find main/entrypoint
            const pkgPath = join(dir, 'package.json');
            if (existsSync(pkgPath)) {
                const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
                const entrypoint = resolve(dir, pkg.main ?? 'dist/index.js');
                if (existsSync(entrypoint)) {
                    return entrypoint;
                }
                throw new StepExecutionError(`Entrypoint not found for "${packageId}": ${entrypoint}. Did you run build?`, packageId);
            }
        }
        throw new DescriptorNotFoundError(packageId);
    }
}
//# sourceMappingURL=child-cli-runner.js.map