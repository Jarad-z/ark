import { describe, it, expect, beforeEach } from 'vitest';
import { writeFileSync, mkdirSync, existsSync, promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { PipelineRunner } from './pipeline-runner.js';
import { ChildCliRunner } from './child-cli-runner.js';
function makeTmpDir() {
    const dir = join(tmpdir(), `ark-test-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    return dir;
}
function writeWiring(dir, wiringYaml) {
    const path = join(dir, 'ark-wiring.yaml');
    writeFileSync(path, wiringYaml, 'utf8');
    return path;
}
describe('PipelineRunner', () => {
    let tmpDir;
    beforeEach(() => {
        tmpDir = makeTmpDir();
    });
    it('executes a log-only pipeline without errors', async () => {
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential
steps:
  - id: greet
    uses: builtin/log
    inputs:
      message: "Hello from Ark!"
`);
        const runner = new PipelineRunner({
            wiringPath,
            composedCliId: '@ark/test',
            monorepoRoot: tmpDir,
        });
        const result = await runner.run([]);
        expect(result.success).toBe(true);
    });
    it('skips a step with a false condition', async () => {
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential
steps:
  - id: optional
    uses: builtin/log
    condition: "{{ ctx.mode == 'manual' }}"
    inputs:
      message: "Should be skipped in auto mode"
`);
        const runner = new PipelineRunner({
            wiringPath,
            composedCliId: '@ark/test',
            monorepoRoot: tmpDir,
        });
        // --auto means mode=auto, condition ctx.mode == 'manual' is false → step skipped
        const result = await runner.run(['--auto']);
        expect(result.success).toBe(true);
    });
    it('applies output bindings across two builtin steps', async () => {
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential
steps:
  - id: decide
    uses: builtin/conditional
    inputs:
      condition: true
      value: "hello"
    outputs:
      bind:
        myValue: value
  - id: show
    uses: builtin/log
    inputs:
      message: "{{ ctx.bindings.myValue }}"
`);
        const runner = new PipelineRunner({
            wiringPath,
            composedCliId: '@ark/test',
            monorepoRoot: tmpDir,
        });
        const result = await runner.run([]);
        expect(result.success).toBe(true);
        expect(result.bindings['myValue']).toBe('hello');
    });
    it('dry-run mode completes without spawning child processes', async () => {
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential
steps:
  - id: log
    uses: builtin/log
    inputs:
      message: "dry run test"
`);
        const runner = new PipelineRunner({
            wiringPath,
            composedCliId: '@ark/test',
            monorepoRoot: tmpDir,
        });
        const result = await runner.run(['--dry-run']);
        expect(result.success).toBe(true);
    });
    it('throws ValidationError on invalid wiring YAML', () => {
        const wiringPath = writeWiring(tmpDir, `not: valid: wiring`);
        expect(() => new PipelineRunner({
            wiringPath,
            composedCliId: '@ark/test',
            monorepoRoot: tmpDir,
        })).toThrow();
    });
    it('parses --flag value from argv into ctx.flags', async () => {
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential
steps:
  - id: log
    uses: builtin/log
    inputs:
      message: "{{ ctx.flags.topic }}"
`);
        const runner = new PipelineRunner({
            wiringPath,
            composedCliId: '@ark/test',
            monorepoRoot: tmpDir,
        });
        const result = await runner.run(['--topic', '秋季护肤']);
        expect(result.success).toBe(true);
    });
    it('aborts a step that exceeds its timeout', async () => {
        const pkgDir = join(tmpDir, 'packages', 'cli-slow');
        if (!existsSync(pkgDir)) {
            await fs.mkdir(join(pkgDir, 'dist'), { recursive: true });
            await fs.writeFile(join(pkgDir, 'dist', 'index.js'), `await new Promise(r => setTimeout(r, 10_000))\nprocess.exit(0)\n`);
            await fs.writeFile(join(pkgDir, 'package.json'), JSON.stringify({ name: '@ark/cli-slow', version: '0.1.0', type: 'module' }));
        }
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential
steps:
  - id: slow
    uses: "@ark/cli-slow"
    timeout: "1s"
errorPolicy:
  onStepFailure: abort
`);
        const runner = new PipelineRunner({
            wiringPath,
            composedCliId: '@ark/test',
            monorepoRoot: tmpDir,
        });
        const result = await runner.run([]);
        expect(result.success).toBe(false);
        expect(String(result.error)).toMatch(/timed out|cancelled/i);
    }, 5000);
    it('dag mode runs independent steps concurrently', async () => {
        // Two slow CLIs that each take 200ms
        for (const name of ['cli-dag-a', 'cli-dag-b']) {
            const pkgDir = join(tmpDir, 'packages', name);
            await fs.mkdir(join(pkgDir, 'dist'), { recursive: true });
            await fs.writeFile(join(pkgDir, 'dist', 'index.js'), `await new Promise(r => setTimeout(r, 200))\nprocess.stdout.write('ARK_OUTPUT:{"done":true}\\n')\nprocess.exit(0)\n`);
            await fs.writeFile(join(pkgDir, 'package.json'), JSON.stringify({
                name: `@ark/${name}`,
                version: '0.1.0',
                type: 'module',
                dependencies: { '@ark/core': 'workspace:*' },
            }));
        }
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: dag
steps:
  - id: a
    uses: "@ark/cli-dag-a"
    outputs:
      bind:
        aOut: done
  - id: b
    uses: "@ark/cli-dag-b"
    outputs:
      bind:
        bOut: done
  - id: c
    uses: builtin/log
    inputs:
      message: "{{ ctx.bindings.aOut }}"
    dependsOn: ["b"]
`);
        const start = Date.now();
        const runner = new PipelineRunner({
            wiringPath,
            composedCliId: '@ark/test',
            monorepoRoot: tmpDir,
        });
        const result = await runner.run([]);
        const elapsed = Date.now() - start;
        expect(result.success).toBe(true);
        // Sequential would be ~400ms. Concurrent should be ~200ms.
        expect(elapsed).toBeLessThan(350);
    }, 10000);
    it('ChildCliRunner cancels a running process when AbortSignal fires', async () => {
        const pkgDir = join(tmpDir, 'packages', 'cli-slow');
        await fs.mkdir(join(pkgDir, 'dist'), { recursive: true });
        await fs.writeFile(join(pkgDir, 'dist', 'index.js'), `await new Promise(r => setTimeout(r, 10_000))\nprocess.exit(0)\n`);
        await fs.writeFile(join(pkgDir, 'package.json'), JSON.stringify({ name: '@ark/cli-slow', version: '0.1.0', type: 'module' }));
        const controller = new AbortController();
        const runner = new ChildCliRunner();
        setTimeout(() => controller.abort(), 100);
        await expect(runner.run({
            packageId: '@ark/cli-slow',
            command: undefined,
            inputs: {},
            monorepoRoot: tmpDir,
            stepId: 'slow-step',
            signal: controller.signal,
        })).rejects.toThrow('Step cancelled');
    }, 5000);
    it('accepts deprecated mode field (backward compat)', async () => {
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential
steps:
  - id: greet
    uses: builtin/log
    inputs:
      message: "hello"
`);
        const runner = new PipelineRunner({
            wiringPath,
            composedCliId: '@ark/test',
            monorepoRoot: tmpDir,
        });
        const result = await runner.run([]);
        expect(result.success).toBe(true);
    });
    it('streaming lifecycle: runs downstream steps for each stdout event line', async () => {
        // Build a fake source CLI that emits 3 JSON events then exits
        const sourceDir = join(tmpDir, 'packages', 'fake-source');
        mkdirSync(sourceDir, { recursive: true });
        writeFileSync(join(sourceDir, 'package.json'), JSON.stringify({ name: '@ark/fake-source', main: 'index.js' }));
        writeFileSync(join(sourceDir, 'index.js'), [
            'const events = [',
            '  { price: 10 },',
            '  { price: 20 },',
            '  { price: 30 },',
            ']',
            'for (const e of events) {',
            '  process.stdout.write("ARK_OUTPUT:" + JSON.stringify(e) + "\\n")',
            '}',
            'process.exit(0)',
        ].join('\n'));
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
  lifecycle: streaming
steps:
  - id: source
    uses: "@ark/fake-source"
    outputs:
      bind:
        tick: "."
  - id: logger
    uses: builtin/log
    inputs:
      message: "tick"
`);
        const runner = new PipelineRunner({
            wiringPath,
            composedCliId: '@ark/test',
            monorepoRoot: tmpDir,
        });
        const result = await runner.run([]);
        expect(result.success).toBe(true);
    });
    it('routes to correct step via builtin/branch', async () => {
        const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
  lifecycle: finite
steps:
  - id: decide
    uses: builtin/branch
    inputs:
      routes:
        - condition: true
          next: path-a
      default: path-b
  - id: path-a
    uses: builtin/log
    inputs:
      message: "took path A"
  - id: path-b
    uses: builtin/log
    inputs:
      message: "took path B"
`);
        const runner = new PipelineRunner({
            wiringPath,
            composedCliId: '@ark/test',
            monorepoRoot: tmpDir,
        });
        const result = await runner.run([]);
        expect(result.success).toBe(true);
        expect(result.stepOutputs['path-b']).toBeUndefined();
        expect(result.stepOutputs['path-a']).toBeDefined();
    });
});
//# sourceMappingURL=pipeline-runner.test.js.map