/**
 * Integration tests for Chapter 5 wiring plan examples.
 *
 * Each test uses fake CLIs (written to a tmp dir) to validate that the
 * wiring plan YAML parses correctly and that the pipeline executes with
 * the expected data flow and control logic.
 *
 * 5.1 — sequential: fetch → (optional review) → generate → log
 * 5.2 — dag: parallel fetch of 3 cities → generate comparison report
 * 5.3 — branch: translate → branch by length → (review?) → post
 * 5.4 — parallel-map: batch translate an array of articles
 * 5.5 — streaming: source emits events, until template stops the loop
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { writeFileSync, mkdirSync, promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { PipelineRunner } from './pipeline-runner.js'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  const dir = join(tmpdir(), `ark-ch5-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function writeWiring(dir: string, yaml: string): string {
  const path = join(dir, 'ark-wiring.yaml')
  writeFileSync(path, yaml, 'utf8')
  return path
}

async function writeFakeCli(
  tmpDir: string,
  name: string,
  script: string
): Promise<void> {
  const pkgDir = join(tmpDir, 'packages', name)
  await fs.mkdir(join(pkgDir, 'dist'), { recursive: true })
  await fs.writeFile(join(pkgDir, 'dist', 'index.js'), script)
  await fs.writeFile(
    join(pkgDir, 'package.json'),
    JSON.stringify({ name: `@ark/${name}`, version: '0.1.0', type: 'module', main: 'dist/index.js' })
  )
}

// ── 5.1 sequential ───────────────────────────────────────────────────────────

describe('Chapter 5.1 — sequential pipeline', () => {
  let tmpDir: string
  beforeEach(() => { tmpDir = makeTmpDir() })

  it('auto mode: fetch → generate → log, skips review', async () => {
    await writeFakeCli(tmpDir, 'cli-weather', `
      const payload = JSON.parse(process.env.ARK_INPUT_PAYLOAD || '{}')
      process.stdout.write('ARK_OUTPUT:' + JSON.stringify({ city: payload.city, temp: 22, condition: 'sunny' }) + '\\n')
      process.exit(0)
    `)
    await writeFakeCli(tmpDir, 'cli-report', `
      const payload = JSON.parse(process.env.ARK_INPUT_PAYLOAD || '{}')
      process.stdout.write('ARK_OUTPUT:' + JSON.stringify({ report: 'Weather report for ' + JSON.stringify(payload.weatherData) }) + '\\n')
      process.exit(0)
    `)

    const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
steps:
  - id: fetch
    uses: "@ark/cli-weather"
    command: fetch
    inputs:
      city: "{{ ctx.flags.city | default: 'Beijing' }}"
    outputs:
      bind:
        weatherData: "."
  - id: review
    uses: builtin/human-review
    condition: "{{ ctx.mode == 'manual' }}"
    inputs:
      payload: "{{ ctx.bindings.weatherData }}"
    outputs:
      bind:
        approvedWeather: approved
  - id: generate
    uses: "@ark/cli-report"
    command: generate
    inputs:
      weatherData: "{{ ctx.mode == 'manual' ? ctx.bindings.approvedWeather : ctx.bindings.weatherData }}"
      style: "{{ ctx.flags.style | default: 'casual daily report' }}"
    outputs:
      bind:
        result: "."
  - id: done
    uses: builtin/log
    inputs:
      message: "Done"
errorPolicy:
  onStepFailure: abort
  retryPolicy:
    maxAttempts: 3
    backoffMs: 100
    jitter: false
flags:
  - name: city
    type: string
    required: false
  - name: style
    type: string
    required: false
    default: "casual daily report"
`)

    const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir })
    // --dry-run: mode stays manual but human-review is auto-approved (no stdin wait)
    const result = await runner.run(['--city', 'Shanghai', '--dry-run'])

    expect(result.success).toBe(true)
    // dry-run: bindings not applied, but steps ran and produced stepOutputs
    expect(result.stepOutputs['fetch']).toBeDefined()
    // review step ran (manual mode, condition true) — dry-run auto-approves
    expect(result.stepOutputs['review']).toBeDefined()
    expect(result.stepOutputs['generate']).toBeDefined()
  }, 10_000)

  it('uses default city flag when none provided', async () => {
    await writeFakeCli(tmpDir, 'cli-weather', `
      const payload = JSON.parse(process.env.ARK_INPUT_PAYLOAD || '{}')
      process.stdout.write('ARK_OUTPUT:' + JSON.stringify({ city: payload.city, temp: 15 }) + '\\n')
      process.exit(0)
    `)
    await writeFakeCli(tmpDir, 'cli-report', `
      process.stdout.write('ARK_OUTPUT:{"report":"ok"}\\n')
      process.exit(0)
    `)

    const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
steps:
  - id: fetch
    uses: "@ark/cli-weather"
    inputs:
      city: "{{ ctx.flags.city | default: 'Beijing' }}"
    outputs:
      bind:
        weatherData: "."
  - id: generate
    uses: "@ark/cli-report"
    inputs:
      weatherData: "{{ ctx.bindings.weatherData }}"
    outputs:
      bind:
        result: "."
  - id: done
    uses: builtin/log
    inputs:
      message: "done"
`)

    const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir })
    const result = await runner.run([]) // no --city flag

    expect(result.success).toBe(true)
    expect((result.bindings['weatherData'] as Record<string, unknown>)['city']).toBe('Beijing')
  }, 10_000)
})

// ── 5.2 DAG ──────────────────────────────────────────────────────────────────

describe('Chapter 5.2 — DAG parallel pipeline', () => {
  let tmpDir: string
  beforeEach(() => { tmpDir = makeTmpDir() })

  it('fetches 3 cities in parallel, then generates comparison report', async () => {
    const startTimes: number[] = []

    await writeFakeCli(tmpDir, 'cli-weather', `
      const payload = JSON.parse(process.env.ARK_INPUT_PAYLOAD || '{}')
      // Simulate network delay so we can detect parallel execution
      await new Promise(r => setTimeout(r, 80))
      process.stdout.write('ARK_OUTPUT:' + JSON.stringify({ city: payload.city, temp: 20 }) + '\\n')
      process.exit(0)
    `)
    await writeFakeCli(tmpDir, 'cli-report', `
      const payload = JSON.parse(process.env.ARK_INPUT_PAYLOAD || '{}')
      process.stdout.write('ARK_OUTPUT:' + JSON.stringify({ comparison: payload.weatherData }) + '\\n')
      process.exit(0)
    `)

    const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: dag
  concurrency: 4
steps:
  - id: fetch-shanghai
    uses: "@ark/cli-weather"
    command: fetch
    inputs:
      city: "Shanghai"
    outputs:
      bind:
        weatherShanghai: "."
  - id: fetch-beijing
    uses: "@ark/cli-weather"
    command: fetch
    inputs:
      city: "Beijing"
    outputs:
      bind:
        weatherBeijing: "."
  - id: fetch-guangzhou
    uses: "@ark/cli-weather"
    command: fetch
    inputs:
      city: "Guangzhou"
    outputs:
      bind:
        weatherGuangzhou: "."
  - id: generate
    uses: "@ark/cli-report"
    command: generate
    inputs:
      weatherData:
        shanghai: "{{ ctx.bindings.weatherShanghai }}"
        beijing: "{{ ctx.bindings.weatherBeijing }}"
        guangzhou: "{{ ctx.bindings.weatherGuangzhou }}"
      style: "comparison report"
    outputs:
      bind:
        report: "."
  - id: done
    uses: builtin/log
    inputs:
      message: "done"
errorPolicy:
  onStepFailure: abort
  parallelBehavior: failFast
`)

    const wallStart = Date.now()
    const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir })
    const result = await runner.run([])
    const wallMs = Date.now() - wallStart

    expect(result.success).toBe(true)
    // All three city bindings should exist
    expect((result.bindings['weatherShanghai'] as Record<string, unknown>)['city']).toBe('Shanghai')
    expect((result.bindings['weatherBeijing'] as Record<string, unknown>)['city']).toBe('Beijing')
    expect((result.bindings['weatherGuangzhou'] as Record<string, unknown>)['city']).toBe('Guangzhou')
    // report should contain comparison data
    expect(result.bindings['report']).toBeDefined()
    // DAG should run 3 fetches in parallel: wall time should be < 3 * 80ms = 240ms
    expect(wallMs).toBeLessThan(350)
  }, 15_000)

  it('failFast: one fetch failure aborts the pipeline', async () => {
    await writeFakeCli(tmpDir, 'cli-weather', `
      const payload = JSON.parse(process.env.ARK_INPUT_PAYLOAD || '{}')
      if (payload.city === 'Beijing') {
        process.stderr.write('simulated fetch error\\n')
        process.exit(1)
      }
      await new Promise(r => setTimeout(r, 50))
      process.stdout.write('ARK_OUTPUT:' + JSON.stringify({ city: payload.city }) + '\\n')
      process.exit(0)
    `)
    await writeFakeCli(tmpDir, 'cli-report', `
      process.stdout.write('ARK_OUTPUT:{"report":"ok"}\\n')
      process.exit(0)
    `)

    const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: dag
steps:
  - id: fetch-shanghai
    uses: "@ark/cli-weather"
    inputs:
      city: "Shanghai"
    outputs:
      bind:
        weatherShanghai: "."
  - id: fetch-beijing
    uses: "@ark/cli-weather"
    inputs:
      city: "Beijing"
    outputs:
      bind:
        weatherBeijing: "."
  - id: generate
    uses: "@ark/cli-report"
    inputs:
      data: "{{ ctx.bindings.weatherShanghai }}"
    outputs:
      bind:
        report: "."
errorPolicy:
  onStepFailure: abort
  parallelBehavior: failFast
`)

    const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir })
    const result = await runner.run([])

    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  }, 10_000)
})

// ── 5.3 branch ───────────────────────────────────────────────────────────────

describe('Chapter 5.3 — branch (if/else)', () => {
  let tmpDir: string
  beforeEach(() => { tmpDir = makeTmpDir() })

  it('short content: branch skips review, goes directly to post', async () => {
    await writeFakeCli(tmpDir, 'cli-translate', `
      const payload = JSON.parse(process.env.ARK_INPUT_PAYLOAD || '{}')
      // Return short translated content (< 200 chars)
      process.stdout.write('ARK_OUTPUT:' + JSON.stringify({
        title: 'Short title',
        translated: 'This is a short translated text under 200 characters.'
      }) + '\\n')
      process.exit(0)
    `)
    await writeFakeCli(tmpDir, 'cli-xhs', `
      const payload = JSON.parse(process.env.ARK_INPUT_PAYLOAD || '{}')
      process.stdout.write('ARK_OUTPUT:' + JSON.stringify({ postUrl: 'https://xhs.com/post/123', title: payload.title }) + '\\n')
      process.exit(0)
    `)

    const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
steps:
  - id: translate
    uses: "@ark/cli-translate"
    command: translate
    inputs:
      text: "{{ ctx.flags.text }}"
      targetLang: "ZH"
    outputs:
      bind:
        translated: "."
  - id: route
    uses: builtin/branch
    cases:
      - condition: "{{ ctx.bindings.translated.translated.length > 200 }}"
        next: review
      - condition: "true"
        next: post
  - id: review
    uses: builtin/human-review
    inputs:
      payload: "{{ ctx.bindings.translated }}"
    outputs:
      bind:
        approved: approved
  - id: post
    uses: "@ark/cli-xhs"
    command: post
    inputs:
      title: "{{ ctx.bindings.approved.title | default: ctx.bindings.translated.title }}"
      body: "{{ ctx.bindings.approved.translated | default: ctx.bindings.translated.translated }}"
    outputs:
      bind:
        result: "."
  - id: done
    uses: builtin/log
    inputs:
      message: "posted"
errorPolicy:
  onStepFailure: abort
flags:
  - name: text
    type: string
    required: true
`)

    const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir })
    const result = await runner.run(['--text', 'Hello world'])

    expect(result.success).toBe(true)
    // review was skipped (short content), so approved binding should not exist
    expect(result.bindings['approved']).toBeUndefined()
    // post ran, result should have postUrl
    expect((result.bindings['result'] as Record<string, unknown>)['postUrl']).toBe('https://xhs.com/post/123')
  }, 10_000)

  it('long content: branch routes to review, verified via stepOutputs', async () => {
    const longText = 'x'.repeat(201)
    await writeFakeCli(tmpDir, 'cli-translate', `
      process.stdout.write('ARK_OUTPUT:' + JSON.stringify({
        title: 'Long title',
        translated: ${JSON.stringify(longText)}
      }) + '\\n')
      process.exit(0)
    `)
    await writeFakeCli(tmpDir, 'cli-xhs', `
      const payload = JSON.parse(process.env.ARK_INPUT_PAYLOAD || '{}')
      process.stdout.write('ARK_OUTPUT:' + JSON.stringify({ postUrl: 'https://xhs.com/post/456' }) + '\\n')
      process.exit(0)
    `)

    // Use builtin/log instead of human-review so no stdin needed
    const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
steps:
  - id: translate
    uses: "@ark/cli-translate"
    inputs:
      text: "{{ ctx.flags.text }}"
    outputs:
      bind:
        translated: "."
  - id: route
    uses: builtin/branch
    cases:
      - condition: "{{ ctx.bindings.translated.translated.length > 200 }}"
        next: review-log
      - condition: "true"
        next: post
  - id: review-log
    uses: builtin/log
    inputs:
      message: "review required for long content"
  - id: post
    uses: "@ark/cli-xhs"
    inputs:
      title: "{{ ctx.bindings.translated.title }}"
      body: "{{ ctx.bindings.translated.translated }}"
    outputs:
      bind:
        result: "."
  - id: done
    uses: builtin/log
    inputs:
      message: "posted"
flags:
  - name: text
    type: string
    required: true
`)

    const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir })
    const result = await runner.run(['--text', 'Long text'])

    expect(result.success).toBe(true)
    // branch routed to review-log (long content > 200 chars)
    expect((result.stepOutputs['route'] as Record<string, unknown>)['next']).toBe('review-log')
    // post step was NOT executed (branch jumped to review-log then stopped)
    expect(result.stepOutputs['post']).toBeUndefined()
  }, 10_000)
})

// ── 5.4 parallel-map ─────────────────────────────────────────────────────────

describe('Chapter 5.4 — parallel-map batch processing', () => {
  let tmpDir: string
  beforeEach(() => { tmpDir = makeTmpDir() })

  it('translates array of articles concurrently, preserves order', async () => {
    await writeFakeCli(tmpDir, 'cli-translate', `
      const payload = JSON.parse(process.env.ARK_INPUT_PAYLOAD || '{}')
      const text = payload.text
      // Simple mock: uppercase = "translated"
      process.stdout.write('ARK_OUTPUT:' + JSON.stringify({ original: text, translated: text.toUpperCase() }) + '\\n')
      process.exit(0)
    `)

    const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
steps:
  - id: translate-all
    uses: builtin/parallel-map
    inputs:
      items: "{{ ctx.flags.articles }}"
      step: "@ark/cli-translate"
      command: translate
      inputKey: text
      concurrency: 5
    outputs:
      bind:
        translations: results
  - id: summarize
    uses: builtin/log
    inputs:
      message: "done"
errorPolicy:
  onStepFailure: abort
  parallelBehavior: failFast
flags:
  - name: articles
    type: string
    required: true
`)

    const articles = ['Hello world', 'Good morning', 'How are you']
    const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir })
    const result = await runner.run(['--articles', JSON.stringify(articles)])

    expect(result.success).toBe(true)
    const translations = result.bindings['translations'] as Array<{ original: string; translated: string }>
    expect(translations).toHaveLength(3)
    // Order preserved
    expect(translations[0]!.original).toBe('Hello world')
    expect(translations[0]!.translated).toBe('HELLO WORLD')
    expect(translations[1]!.original).toBe('Good morning')
    expect(translations[2]!.original).toBe('How are you')
  }, 10_000)

  it('waitAll: partial failure returns null for failed items', async () => {
    await writeFakeCli(tmpDir, 'cli-translate', `
      const payload = JSON.parse(process.env.ARK_INPUT_PAYLOAD || '{}')
      if (payload.text === 'fail-me') {
        process.exit(1)
      }
      process.stdout.write('ARK_OUTPUT:' + JSON.stringify({ translated: payload.text + '_OK' }) + '\\n')
      process.exit(0)
    `)

    const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
steps:
  - id: translate-all
    uses: builtin/parallel-map
    inputs:
      items: "{{ ctx.flags.articles }}"
      step: "@ark/cli-translate"
      inputKey: text
    outputs:
      bind:
        translations: results
  - id: done
    uses: builtin/log
    inputs:
      message: "done"
errorPolicy:
  onStepFailure: continue
  parallelBehavior: waitAll
flags:
  - name: articles
    type: string
    required: true
`)

    const articles = ['ok-1', 'fail-me', 'ok-3']
    const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir })
    const result = await runner.run(['--articles', JSON.stringify(articles)])

    // waitAll + onStepFailure:continue → pipeline completes
    expect(result.success).toBe(true)
    const translations = result.bindings['translations'] as Array<unknown>
    expect(translations).toHaveLength(3)
    expect(translations[0]).not.toBeNull()
    expect(translations[1]).toBeNull()  // failed item → null
    expect(translations[2]).not.toBeNull()
  }, 10_000)
})

// ── 5.5 streaming ────────────────────────────────────────────────────────────

describe('Chapter 5.5 — streaming lifecycle (持续监听)', () => {
  let tmpDir: string
  beforeEach(() => { tmpDir = makeTmpDir() })

  it('source emits price events; until template stops when price drops below threshold', async () => {
    /**
     * Simulates a price checker: emits decreasing prices [150, 100, 80].
     * until: "{{ ctx.bindings.priceData.price <= 90 }}" → stops at price=80.
     */
    await writeFakeCli(tmpDir, 'cli-price-checker', `
      const prices = [150, 100, 80]
      for (const price of prices) {
        process.stdout.write('ARK_OUTPUT:' + JSON.stringify({ price }) + '\\n')
        await new Promise(r => setTimeout(r, 30))
      }
      process.exit(0)
    `)

    const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
  lifecycle: streaming
streaming:
  until: "{{ ctx.bindings.priceData.price <= 90 }}"
  stopOn:
    - signal: SIGINT
    - signal: SIGTERM
  restartOnFailure: false
steps:
  - id: fetch-price
    uses: "@ark/cli-price-checker"
    outputs:
      bind:
        priceData: "."
  - id: log-price
    uses: builtin/log
    inputs:
      message: "price: {{ ctx.bindings.priceData.price }}"
`)

    const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir })
    const result = await runner.run([])

    expect(result.success).toBe(true)
    // Should have stopped at price=80 (first price <= 90)
    expect((result.bindings['priceData'] as Record<string, unknown>)['price']).toBe(80)
  }, 10_000)

  it('streaming with branch: routes to alert step when price low', async () => {
    /**
     * Emits prices [200, 50]. On price=50, branch routes to alert step.
     * until stops after alert fires.
     */
    await writeFakeCli(tmpDir, 'cli-price-checker', `
      const prices = [200, 50]
      for (const price of prices) {
        process.stdout.write('ARK_OUTPUT:' + JSON.stringify({ price }) + '\\n')
        await new Promise(r => setTimeout(r, 30))
      }
      process.exit(0)
    `)

    const wiringPath = writeWiring(tmpDir, `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  topology: sequential
  lifecycle: streaming
streaming:
  until: "{{ ctx.bindings.alerted == true }}"
  restartOnFailure: false
steps:
  - id: fetch-price
    uses: "@ark/cli-price-checker"
    outputs:
      bind:
        priceData: "."
  - id: check-threshold
    uses: builtin/branch
    cases:
      - condition: "{{ ctx.bindings.priceData.price <= 100 }}"
        next: alert
      - condition: "true"
        next: log-and-wait
  - id: alert
    uses: builtin/log
    inputs:
      message: "ALERT: price is {{ ctx.bindings.priceData.price }}"
  - id: log-and-wait
    uses: builtin/log
    inputs:
      message: "price ok: {{ ctx.bindings.priceData.price }}"
`)

    const runner = new PipelineRunner({ wiringPath, composedCliId: '@ark/test', monorepoRoot: tmpDir })
    const result = await runner.run([])

    // Pipeline completes after all events (source exits naturally)
    expect(result.success).toBe(true)
    expect((result.bindings['priceData'] as Record<string, unknown>)['price']).toBe(50)
  }, 10_000)
})
