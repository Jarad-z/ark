import { describe, it, expect, vi, beforeEach } from 'vitest'
import { writeFileSync, mkdirSync, promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { PipelineRunner } from './pipeline-runner.js'
import { ChildCliRunner } from './child-cli-runner.js'

function makeTmpDir(): string {
  const dir = join(tmpdir(), `ark-test-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function writeWiring(dir: string, wiringYaml: string): string {
  const path = join(dir, 'ark-wiring.yaml')
  writeFileSync(path, wiringYaml, 'utf8')
  return path
}

describe('PipelineRunner', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  it('executes a log-only pipeline without errors', async () => {
    const wiringPath = writeWiring(
      tmpDir,
      `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential
steps:
  - id: greet
    uses: builtin/log
    inputs:
      message: "Hello from Ark!"
`
    )

    const runner = new PipelineRunner({
      wiringPath,
      composedCliId: '@ark/test',
      monorepoRoot: tmpDir,
    })

    const result = await runner.run([])
    expect(result.success).toBe(true)
  })

  it('skips a step with a false condition', async () => {
    const wiringPath = writeWiring(
      tmpDir,
      `
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
`
    )

    const runner = new PipelineRunner({
      wiringPath,
      composedCliId: '@ark/test',
      monorepoRoot: tmpDir,
    })

    // --auto means mode=auto, condition ctx.mode == 'manual' is false → step skipped
    const result = await runner.run(['--auto'])
    expect(result.success).toBe(true)
  })

  it('applies output bindings across two builtin steps', async () => {
    const wiringPath = writeWiring(
      tmpDir,
      `
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
`
    )

    const runner = new PipelineRunner({
      wiringPath,
      composedCliId: '@ark/test',
      monorepoRoot: tmpDir,
    })

    const result = await runner.run([])
    expect(result.success).toBe(true)
    expect((result.bindings as Record<string, unknown>)['myValue']).toBe('hello')
  })

  it('dry-run mode completes without spawning child processes', async () => {
    const wiringPath = writeWiring(
      tmpDir,
      `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential
steps:
  - id: log
    uses: builtin/log
    inputs:
      message: "dry run test"
`
    )

    const runner = new PipelineRunner({
      wiringPath,
      composedCliId: '@ark/test',
      monorepoRoot: tmpDir,
    })

    const result = await runner.run(['--dry-run'])
    expect(result.success).toBe(true)
  })

  it('throws ValidationError on invalid wiring YAML', () => {
    const wiringPath = writeWiring(tmpDir, `not: valid: wiring`)
    expect(
      () =>
        new PipelineRunner({
          wiringPath,
          composedCliId: '@ark/test',
          monorepoRoot: tmpDir,
        })
    ).toThrow()
  })

  it('parses --flag value from argv into ctx.flags', async () => {
    const wiringPath = writeWiring(
      tmpDir,
      `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential
steps:
  - id: log
    uses: builtin/log
    inputs:
      message: "{{ ctx.flags.topic }}"
`
    )

    const runner = new PipelineRunner({
      wiringPath,
      composedCliId: '@ark/test',
      monorepoRoot: tmpDir,
    })

    const result = await runner.run(['--topic', '秋季护肤'])
    expect(result.success).toBe(true)
  })

  it('ChildCliRunner cancels a running process when AbortSignal fires', async () => {
    const pkgDir = join(tmpDir, 'packages', 'cli-slow')
    await fs.mkdir(join(pkgDir, 'dist'), { recursive: true })
    await fs.writeFile(
      join(pkgDir, 'dist', 'index.js'),
      `await new Promise(r => setTimeout(r, 10_000))\nprocess.exit(0)\n`
    )
    await fs.writeFile(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: '@ark/cli-slow', version: '0.1.0', type: 'module' })
    )

    const controller = new AbortController()
    const runner = new ChildCliRunner()
    setTimeout(() => controller.abort(), 100)

    await expect(
      runner.run({
        packageId: '@ark/cli-slow',
        command: undefined,
        inputs: {},
        monorepoRoot: tmpDir,
        stepId: 'slow-step',
        signal: controller.signal,
      })
    ).rejects.toThrow()
  }, 5000)
})
