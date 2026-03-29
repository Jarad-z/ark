import { createInterface } from 'node:readline'
import type { PipelineContext } from '@ark/core'
import { Scheduler } from './scheduler.js'

export interface BuiltinStepResult {
  output: Record<string, unknown>
  skipped?: boolean
}

/**
 * builtin/human-review
 * Presents the payload to the user and waits for approval or inline edit.
 * In --dry-run mode, auto-approves without prompting.
 */
export async function humanReview(
  inputs: Record<string, unknown>,
  ctx: PipelineContext
): Promise<BuiltinStepResult> {
  if (ctx.dryRun) {
    process.stdout.write('[ark:runtime] [dry-run] Skipping human-review step.\n')
    return { output: { approved: inputs['payload'] } }
  }

  const payload = inputs['payload']
  process.stdout.write('\n' + '─'.repeat(60) + '\n')
  process.stdout.write('REVIEW REQUIRED:\n\n')
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n')
  process.stdout.write('─'.repeat(60) + '\n')

  const choice = await promptLine('[ark:runtime] Approve? [y]es / [e]dit (as JSON) / [n]o cancel: ')

  if (choice === 'n' || choice === 'no') {
    process.exit(2) // EXIT_CODE_CANCELLED
  }

  if (choice === 'e' || choice === 'edit') {
    const raw = await promptLine('Enter edited JSON (single line): ')
    try {
      const edited = JSON.parse(raw) as unknown
      return { output: { approved: edited } }
    } catch {
      process.stderr.write('[ark:runtime] Invalid JSON, using original payload.\n')
    }
  }

  return { output: { approved: payload } }
}

/**
 * builtin/log
 * Writes a message to stdout.
 */
export async function log(
  inputs: Record<string, unknown>
): Promise<BuiltinStepResult> {
  const message = typeof inputs['message'] === 'string' ? inputs['message'] : JSON.stringify(inputs['message'])
  process.stdout.write(message + '\n')
  return { output: {} }
}

/**
 * builtin/conditional
 * Passes `value` through if `condition` is truthy, otherwise skips.
 */
export async function conditional(
  inputs: Record<string, unknown>
): Promise<BuiltinStepResult> {
  if (inputs['condition']) {
    return { output: { value: inputs['value'] } }
  }
  return { output: {}, skipped: true }
}

/**
 * builtin/parallel-map
 * Runs a CLI step once per item in an array, collecting results in order.
 */
export async function parallelMap(
  inputs: Record<string, unknown>,
  ctx: PipelineContext,
  runChild: (
    packageId: string,
    command: string | undefined,
    inputs: Record<string, unknown>,
    signal: AbortSignal
  ) => Promise<Record<string, unknown>>,
  parallelBehavior: 'failFast' | 'waitAll'
): Promise<BuiltinStepResult> {
  if (!Array.isArray(inputs['items'])) {
    throw new Error('parallel-map: items must be an array')
  }
  if (typeof inputs['step'] !== 'string') {
    throw new Error('parallel-map: step must be a string')
  }

  const items = inputs['items'] as unknown[]
  const packageId = inputs['step'] as string
  const command = typeof inputs['command'] === 'string' ? inputs['command'] : undefined
  const inputKey = typeof inputs['inputKey'] === 'string' ? inputs['inputKey'] : 'item'
  const concurrency =
    typeof inputs['concurrency'] === 'number' ? inputs['concurrency'] : Infinity

  // Use Scheduler for both modes to respect concurrency limit
  const results: Array<Record<string, unknown> | null> = new Array(items.length).fill(null)
  const dag = new Map(items.map((_, i) => [`item-${i}`, [] as string[]]))

  const scheduler = new Scheduler({
    dag,
    concurrency,
    parallelBehavior,
    runStep: async (id, signal) => {
      const idx = parseInt(id.replace('item-', ''), 10)
      const item = items[idx]
      const output = await runChild(packageId, command, { [inputKey]: item }, signal)
      results[idx] = output
    },
  })

  if (parallelBehavior === 'waitAll') {
    // Swallow the error — failures are represented as null in results
    await scheduler.run().catch(() => undefined)
  } else {
    await scheduler.run()
  }

  return { output: { results } }
}

export interface BranchRoute {
  condition: unknown
  next: string
}

/**
 * builtin/branch
 * Evaluates routes in order and returns the `next` step id for the first
 * truthy condition. Returns { next: null } if no match and no default.
 * The PipelineRunner reads output.next to jump execution.
 */
export async function branch(
  inputs: Record<string, unknown>
): Promise<BuiltinStepResult> {
  if (!Array.isArray(inputs['routes'])) {
    throw new Error('branch: routes must be an array')
  }

  const routes = inputs['routes'] as BranchRoute[]
  for (const route of routes) {
    if (route.condition) {
      return { output: { next: route.next } }
    }
  }

  const defaultNext = inputs['default']
  if (typeof defaultNext === 'string') {
    return { output: { next: defaultNext } }
  }

  return { output: { next: null } }
}

function promptLine(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false })
    process.stdout.write(question)
    rl.once('line', (line) => {
      rl.close()
      resolve(line.trim().toLowerCase())
    })
  })
}
