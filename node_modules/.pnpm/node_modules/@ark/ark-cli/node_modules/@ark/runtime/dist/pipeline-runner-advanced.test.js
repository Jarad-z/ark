/**
 * Advanced integration tests for PipelineRunner.
 *
 * Covers: DAG ordering, DAG failure handling, branch routing variants,
 * streaming stopOn / restartOnFailure / downstream error, retry policy,
 * errorPolicy: continue, and multi-hop output bindings.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { writeFileSync, mkdirSync, promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { PipelineRunner } from './pipeline-runner.js';
// ── helpers ──────────────────────────────────────────────────────────────────
function makeTmpDir() {
    const dir = join(tmpdir(), `ark-adv-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    return dir;
}
function writeWiring(dir, yaml) {
    const path = join(dir, 'ark-wiring.yaml');
    writeFileSync(path, yaml, 'utf8');
    return path;
}
/** Write a minimal fake CLI package that emits one ARK_OUTPUT line then exits. */
async function writeFakeCli(tmpDir, name, script) {
    const pkgDir = join(tmpDir, 'packages', name);
    await fs.mkdir(join(pkgDir, 'dist'), { recursive: true });
    await fs.writeFile(join(pkgDir, 'dist', 'index.js'), script);
    await fs.writeFile(join(pkgDir, 'package.json'), JSON.stringify({ name: `@ark/${name}`, version: '0.1.0', type: 'module', main: 'dist/index.js' }));
}
// ── suite ────────────────────────────────────────────────────────────────────
describe('PipelineRunner — DAG', () => {
    let tmpDir;
    beforeEach(() => { tmpDir = makeTmpDir(); });
    it('respects dependsOn: c runs only after a and b complete', async () => {
        /**
         * a ──┐
         *      ├──► c
         * b ──┘
         *
         * c writes ctx.bindings.fromA and ctx.bindings.fromB into its log.
         * If c ran before a or b, those bindings would be missing.
         */
        for (const [name, value] of [['cli-dep-a', 'AAA'], ['cli-dep-b', 'BBB']]) {
            await writeFakeCli(tmpDir, name, `process.stdout.write('ARK_OUTPUT:${JSON.stringify({ result: value })}\\n')\n`);
        }
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: dag
steps:
  - id: a
    uses: "@ark/cli-dep-a"
    outputs:
      bind:
        fromA: result
  - id: b
    uses: "@ark/cli-dep-b"
    outputs:
      bind:
        fromB: result
  - id: c
    uses: builtin/log
    dependsOn: [a, b]
    inputs:
      message: "{{ ctx.bindings.fromA }}-{{ ctx.bindings.fromB }}"
`);
        const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir });
        const result = await runner.run([]);
        expect(result.success).toBe(true);
        expect(result.bindings['fromA']).toBe('AAA');
        expect(result.bindings['fromB']).toBe('BBB');
        // c ran after both → its input was resolved correctly
        expect(result.stepOutputs['c']).toBeDefined();
    }, 10_000);
    it('DAG failFast: when a fails, dependent step b is not executed', async () => {
        /**
         * a (always fails) ──► b
         *
         * With parallelBehavior: failFast, b should be cancelled.
         */
        await writeFakeCli(tmpDir, 'cli-fail', `process.exit(1)\n`);
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: dag
errorPolicy:
  onStepFailure: abort
  parallelBehavior: failFast
steps:
  - id: a
    uses: "@ark/cli-fail"
  - id: b
    uses: builtin/log
    dependsOn: [a]
    inputs:
      message: "should not run"
`);
        const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir });
        const result = await runner.run([]);
        expect(result.success).toBe(false);
        expect(result.stepOutputs['b']).toBeUndefined();
    }, 10_000);
    it('DAG waitAll: independent b runs even when a fails', async () => {
        /**
         * a (fails)    b (independent, succeeds)
         *
         * With parallelBehavior: waitAll, b should still run to completion.
         */
        await writeFakeCli(tmpDir, 'cli-fail-a', `process.exit(1)\n`);
        await writeFakeCli(tmpDir, 'cli-ok-b', `process.stdout.write('ARK_OUTPUT:{"done":true}\\n')\n`);
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: dag
errorPolicy:
  onStepFailure: continue
  parallelBehavior: waitAll
steps:
  - id: a
    uses: "@ark/cli-fail-a"
  - id: b
    uses: "@ark/cli-ok-b"
    outputs:
      bind:
        bDone: done
`);
        const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir });
        const result = await runner.run([]);
        // a failed but pipeline continued (waitAll + continue)
        expect(result.bindings['bDone']).toBe(true);
    }, 10_000);
});
// ── branch ───────────────────────────────────────────────────────────────────
describe('PipelineRunner — builtin/branch', () => {
    let tmpDir;
    beforeEach(() => { tmpDir = makeTmpDir(); });
    it('routes dynamically using ctx.bindings value from a prior step', async () => {
        /**
         * score-step emits { score: 8 }
         * branch step: if score > 5 → high-path, else → low-path
         * score is 8 → high-path runs, low-path is skipped
         */
        await writeFakeCli(tmpDir, 'cli-score', `process.stdout.write('ARK_OUTPUT:{"score":8}\\n')\n`);
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
steps:
  - id: get-score
    uses: "@ark/cli-score"
    outputs:
      bind:
        score: score
  - id: route
    uses: builtin/branch
    inputs:
      routes:
        - condition: "{{ ctx.bindings.score > 5 }}"
          next: high-path
      default: low-path
  - id: high-path
    uses: builtin/log
    inputs:
      message: "high score!"
  - id: low-path
    uses: builtin/log
    inputs:
      message: "low score"
`);
        const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir });
        const result = await runner.run([]);
        expect(result.success).toBe(true);
        expect(result.stepOutputs['high-path']).toBeDefined();
        expect(result.stepOutputs['low-path']).toBeUndefined();
        expect(result.bindings['score']).toBe(8);
    }, 10_000);
    it('falls through to default when no route condition matches', async () => {
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
steps:
  - id: route
    uses: builtin/branch
    inputs:
      routes:
        - condition: false
          next: unreachable
      default: fallback
  - id: unreachable
    uses: builtin/log
    inputs:
      message: "should not run"
  - id: fallback
    uses: builtin/log
    inputs:
      message: "fell through to fallback"
`);
        const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir });
        const result = await runner.run([]);
        expect(result.success).toBe(true);
        expect(result.stepOutputs['unreachable']).toBeUndefined();
        expect(result.stepOutputs['fallback']).toBeDefined();
    });
    it('stops cleanly when no route matches and no default is set', async () => {
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
steps:
  - id: route
    uses: builtin/branch
    inputs:
      routes:
        - condition: false
          next: nowhere
  - id: unreachable
    uses: builtin/log
    inputs:
      message: "should not run"
`);
        const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir });
        const result = await runner.run([]);
        expect(result.success).toBe(true);
        expect(result.stepOutputs['unreachable']).toBeUndefined();
        // branch step itself ran and stored its output
        expect(result.stepOutputs['route']).toBeDefined();
    });
});
// ── streaming ─────────────────────────────────────────────────────────────────
describe('PipelineRunner — streaming lifecycle', () => {
    let tmpDir;
    beforeEach(() => { tmpDir = makeTmpDir(); });
    it('stopOn condition terminates pipeline mid-stream', async () => {
        /**
         * Source emits { count: 1, stop: false }, { count: 2, stop: true }, ...
         * stopOn: "{{ ctx.bindings.stop }}" — template engine resolves the boolean.
         * Pipeline should stop after the 2nd event; count binding should be 2.
         *
         * Each event is spaced 50ms apart; the source emits up to 10 but we stop at 2.
         */
        await writeFakeCli(tmpDir, 'cli-counter', [
            'for (let i = 1; i <= 10; i++) {',
            '  const stop = i >= 2',
            '  process.stdout.write("ARK_OUTPUT:" + JSON.stringify({ count: i, stop }) + "\\n")',
            '  await new Promise(r => setTimeout(r, 50))',
            '}',
            'process.exit(0)',
        ].join('\n'));
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
  lifecycle: streaming
streaming:
  stopOn: "{{ ctx.bindings.stop }}"
steps:
  - id: source
    uses: "@ark/cli-counter"
    outputs:
      bind:
        count: count
        stop: stop
  - id: logger
    uses: builtin/log
    inputs:
      message: "event {{ ctx.bindings.count }}"
`);
        const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir });
        const result = await runner.run([]);
        expect(result.success).toBe(true);
        // count should be 2 (stopped after 2nd event, not all 10)
        expect(result.bindings['count']).toBe(2);
    }, 10_000);
    it('streaming downstream failure propagates as success: false', async () => {
        /**
         * Source emits one event.
         * Downstream step uses a non-existent package → execution error.
         * Pipeline should return { success: false }.
         */
        await writeFakeCli(tmpDir, 'cli-single-event', `process.stdout.write('ARK_OUTPUT:{"value":1}\\n')\nprocess.exit(0)\n`);
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
  lifecycle: streaming
steps:
  - id: source
    uses: "@ark/cli-single-event"
  - id: downstream
    uses: "@ark/cli-does-not-exist"
`);
        const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir });
        const result = await runner.run([]);
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
    }, 10_000);
    it('restartOnFailure: source process is restarted after exit', async () => {
        /**
         * Source reads a counter file:
         *   - 1st run: emits { run: 1, done: false } then exits
         *   - 2nd run: emits { run: 2, done: true  } then exits
         *
         * restartOnFailure: true causes the runner to restart after the 1st exit.
         * stopOn: "{{ ctx.bindings.done }}" terminates after the 2nd event.
         */
        const counterFile = join(tmpDir, 'runs.txt');
        writeFileSync(counterFile, '0');
        await writeFakeCli(tmpDir, 'cli-one-shot', [
            `import { readFileSync, writeFileSync } from 'node:fs'`,
            `const n = parseInt(readFileSync(${JSON.stringify(counterFile)}, 'utf8'), 10) + 1`,
            `writeFileSync(${JSON.stringify(counterFile)}, String(n))`,
            `const done = n >= 2`,
            `process.stdout.write('ARK_OUTPUT:' + JSON.stringify({ run: n, done }) + '\\n')`,
            `process.exit(0)`,
        ].join('\n'));
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
  lifecycle: streaming
streaming:
  restartOnFailure: true
  stopOn: "{{ ctx.bindings.done }}"
steps:
  - id: source
    uses: "@ark/cli-one-shot"
    outputs:
      bind:
        run: run
        done: done
  - id: logger
    uses: builtin/log
    inputs:
      message: "run {{ ctx.bindings.run }}"
`);
        const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir });
        const result = await runner.run([]);
        expect(result.success).toBe(true);
        // Second run emitted done: true, so run should be 2
        expect(result.bindings['run']).toBe(2);
        expect(result.bindings['done']).toBe(true);
    }, 15_000);
});
// ── error policy ──────────────────────────────────────────────────────────────
describe('PipelineRunner — error policy', () => {
    let tmpDir;
    beforeEach(() => { tmpDir = makeTmpDir(); });
    it('errorPolicy: continue — failing step does not abort pipeline', async () => {
        await writeFakeCli(tmpDir, 'cli-always-fail', `process.exit(1)\n`);
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
errorPolicy:
  onStepFailure: continue
steps:
  - id: fail-step
    uses: "@ark/cli-always-fail"
  - id: after-fail
    uses: builtin/log
    inputs:
      message: "still running after failure"
`);
        const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir });
        const result = await runner.run([]);
        expect(result.success).toBe(true);
        // after-fail ran even though fail-step errored
        expect(result.stepOutputs['after-fail']).toBeDefined();
    }, 10_000);
    it('retry policy: step succeeds on 2nd attempt', async () => {
        /**
         * CLI increments a counter file. Exits 1 on first call, exits 0 on second.
         * With maxAttempts: 2, the pipeline should succeed.
         */
        const counterFile = join(tmpDir, 'counter.txt');
        writeFileSync(counterFile, '0');
        await writeFakeCli(tmpDir, 'cli-flaky', [
            `import { readFileSync, writeFileSync } from 'node:fs'`,
            `const n = parseInt(readFileSync(${JSON.stringify(counterFile)}, 'utf8'), 10)`,
            `writeFileSync(${JSON.stringify(counterFile)}, String(n + 1))`,
            `if (n === 0) { process.stderr.write('fail on attempt 1\\n'); process.exit(1) }`,
            `process.stdout.write('ARK_OUTPUT:{"ok":true}\\n')`,
            `process.exit(0)`,
        ].join('\n'));
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
errorPolicy:
  onStepFailure: retry
  retryPolicy:
    maxAttempts: 3
    backoffMs: 50
steps:
  - id: flaky
    uses: "@ark/cli-flaky"
    outputs:
      bind:
        ok: ok
`);
        const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir });
        const result = await runner.run([]);
        expect(result.success).toBe(true);
        expect(result.bindings['ok']).toBe(true);
    }, 15_000);
    it('retry policy: exhausted retries return success: false', async () => {
        await writeFakeCli(tmpDir, 'cli-always-fail2', `process.exit(1)\n`);
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
errorPolicy:
  onStepFailure: retry
  retryPolicy:
    maxAttempts: 2
    backoffMs: 50
steps:
  - id: permanent-fail
    uses: "@ark/cli-always-fail2"
`);
        const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir });
        const result = await runner.run([]);
        expect(result.success).toBe(false);
        expect(String(result.error)).toMatch(/2 attempts/);
    }, 10_000);
});
// ── output bindings ───────────────────────────────────────────────────────────
describe('PipelineRunner — multi-hop output bindings', () => {
    let tmpDir;
    beforeEach(() => { tmpDir = makeTmpDir(); });
    it('chains bindings across 3 steps: a → b → c each transforms the value', async () => {
        /**
         * a emits { raw: "hello" }   → binds rawText
         * b receives rawText, emits { upper: "HELLO" } → binds upperText
         * c receives upperText, logs it
         */
        await writeFakeCli(tmpDir, 'cli-raw', `process.stdout.write('ARK_OUTPUT:{"raw":"hello"}\\n')\n`);
        await writeFakeCli(tmpDir, 'cli-upper', [
            `const input = JSON.parse(process.env.ARK_INPUT_PAYLOAD ?? '{}')`,
            `const upper = String(input.text ?? '').toUpperCase()`,
            `process.stdout.write('ARK_OUTPUT:' + JSON.stringify({ upper }) + '\\n')`,
        ].join('\n'));
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
steps:
  - id: a
    uses: "@ark/cli-raw"
    outputs:
      bind:
        rawText: raw
  - id: b
    uses: "@ark/cli-upper"
    inputs:
      text: "{{ ctx.bindings.rawText }}"
    outputs:
      bind:
        upperText: upper
  - id: c
    uses: builtin/log
    inputs:
      message: "{{ ctx.bindings.upperText }}"
`);
        const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir });
        const result = await runner.run([]);
        expect(result.success).toBe(true);
        expect(result.bindings['rawText']).toBe('hello');
        expect(result.bindings['upperText']).toBe('HELLO');
    }, 10_000);
});
//# sourceMappingURL=pipeline-runner-advanced.test.js.map