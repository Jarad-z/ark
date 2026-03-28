import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execa } from 'execa'
import {
  ARK_INPUT_ENV,
  parseOutputLine,
  StepExecutionError,
  DescriptorNotFoundError,
} from '@ark/core'

export interface ChildRunOptions {
  /** npm package id, e.g. "@ark/cli-content" */
  packageId: string
  /** command name to pass as first arg, e.g. "generate" */
  command: string | undefined
  /** resolved input payload */
  inputs: Record<string, unknown>
  /** monorepo root for resolving package entrypoints */
  monorepoRoot: string
  /** if true, skip execution and return empty output */
  dryRun?: boolean
  /** step id for error context */
  stepId?: string
  /** optional AbortSignal to cancel the child process (SIGTERM then SIGKILL after 2 s) */
  signal?: AbortSignal
}

export interface ChildRunResult {
  output: Record<string, unknown>
  logs: string[]
}

/**
 * Runs a child CLI package as a subprocess using the JSON-over-stdio protocol.
 *
 * Input:  env ARK_INPUT_PAYLOAD = JSON.stringify(inputs)
 * Output: stdout line starting with "ARK_OUTPUT:" followed by JSON
 */
export class ChildCliRunner {
  async run(options: ChildRunOptions): Promise<ChildRunResult> {
    const { packageId, command, inputs, monorepoRoot, dryRun, stepId, signal } = options

    if (dryRun) {
      process.stdout.write(`[ark:runtime] [dry-run] Would run ${packageId}${command ? ` ${command}` : ''}\n`)
      process.stdout.write(`[ark:runtime] [dry-run] Inputs: ${JSON.stringify(inputs)}\n`)
      return { output: {}, logs: [] }
    }

    const entrypoint = this.resolveEntrypoint(packageId, monorepoRoot)
    const args = command ? [command] : []

    const logs: string[] = []
    let arkOutput: Record<string, unknown> | undefined

    const proc = execa('node', [entrypoint, ...args], {
      env: {
        ...process.env,
        [ARK_INPUT_ENV]: JSON.stringify(inputs),
      },
      reject: false,
      all: false,
    })

    let abortHandler: (() => void) | undefined
    if (signal) {
      abortHandler = () => {
        proc.kill('SIGTERM')
        setTimeout(() => {
          try { proc.kill('SIGKILL') } catch { /* already exited */ }
        }, 2000)
      }
      signal.addEventListener('abort', abortHandler, { once: true })
    }

    const result = await proc

    if (abortHandler && signal) {
      signal.removeEventListener('abort', abortHandler)
    }

    if (signal?.aborted) {
      throw new Error('Step cancelled')
    }

    // Process stdout line by line
    for (const line of (result.stdout ?? '').split('\n')) {
      const parsed = parseOutputLine(line)
      if (parsed !== undefined) {
        arkOutput = parsed as Record<string, unknown>
      } else if (line.trim()) {
        // Forward non-ARK lines to terminal
        process.stdout.write(line + '\n')
        logs.push(line)
      }
    }

    // Forward stderr
    if (result.stderr) {
      process.stderr.write(result.stderr)
    }

    if (result.exitCode !== 0) {
      throw new StepExecutionError(
        `Child CLI "${packageId}" exited with code ${result.exitCode}`,
        stepId ?? packageId,
        result.stderr
      )
    }

    if (arkOutput === undefined) {
      // No ARK_OUTPUT line — treat as empty output (leaf CLIs may not emit one)
      return { output: {}, logs }
    }

    return { output: arkOutput, logs }
  }

  private resolveEntrypoint(packageId: string, monorepoRoot: string): string {
    // Strip scope: @ark/cli-xhs → cli-xhs
    const name = packageId.includes('/') ? packageId.split('/').slice(1).join('/') : packageId

    const searchRoots = [
      join(monorepoRoot, 'packages', name),
      join(monorepoRoot, 'tools', name),
    ]

    for (const dir of searchRoots) {
      // Read package.json to find main/entrypoint
      const pkgPath = join(dir, 'package.json')
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
          main?: string
        }
        const entrypoint = resolve(dir, pkg.main ?? 'dist/index.js')
        if (existsSync(entrypoint)) {
          return entrypoint
        }
        throw new StepExecutionError(
          `Entrypoint not found for "${packageId}": ${entrypoint}. Did you run build?`,
          packageId
        )
      }
    }

    throw new DescriptorNotFoundError(packageId)
  }
}
