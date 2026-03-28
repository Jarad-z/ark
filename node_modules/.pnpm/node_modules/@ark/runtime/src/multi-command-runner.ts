import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { loadDescriptor } from '@ark/core'
import type { AiBridge } from '@ark/ai-bridge'
import { PipelineRunner } from './pipeline-runner.js'
import type { RunResult } from './pipeline-runner.js'

export interface MultiCommandRunnerOptions {
  /** Directory of the composed CLI package (contains ark-descriptor.yaml) */
  packageDir: string
  composedCliId: string
  monorepoRoot: string
  bridge?: AiBridge
}

/**
 * Routes argv[0] to the correct wiring plan for composed CLIs with multiple commands.
 *
 * Resolution order for a command "review-pr":
 *   1. wirings/review-pr.yaml          (multi-wiring directory)
 *   2. wiringRef from descriptor command definition
 *   3. ark-wiring.yaml                 (fallback for single-command CLIs)
 */
export class MultiCommandRunner {
  constructor(private options: MultiCommandRunnerOptions) {}

  async run(argv: string[]): Promise<RunResult> {
    const { packageDir, composedCliId, monorepoRoot, bridge } = this.options

    const command = argv[0]
    const restArgv = argv.slice(1)

    const wiringPath = this.resolveWiringPath(packageDir, command)

    const runner = new PipelineRunner({
      wiringPath,
      composedCliId,
      monorepoRoot,
      ...(bridge !== undefined ? { bridge } : {}),
    })

    return runner.run(restArgv)
  }

  private resolveWiringPath(packageDir: string, command: string | undefined): string {
    // 1. Multi-wiring directory: wirings/<command>.yaml
    if (command && !command.startsWith('--')) {
      const candidate = resolve(packageDir, 'wirings', `${command}.yaml`)
      if (existsSync(candidate)) return candidate
    }

    // 2. wiringRef declared in descriptor command
    if (command && !command.startsWith('--')) {
      try {
        const desc = loadDescriptor(packageDir)
        const cmdDef = desc.functional.commands.find((c) => c.name === command)
        if (cmdDef?.wiringRef) {
          const candidate = resolve(packageDir, cmdDef.wiringRef)
          if (existsSync(candidate)) return candidate
        }
      } catch {
        // descriptor not found or invalid — fall through
      }
    }

    // 3. Default ark-wiring.yaml
    const defaultWiring = resolve(packageDir, 'ark-wiring.yaml')
    if (existsSync(defaultWiring)) return defaultWiring

    throw new Error(
      `No wiring plan found for command "${command ?? '(default)'}"\n` +
        `Looked in: wirings/${command}.yaml, ark-wiring.yaml\n` +
        `Package dir: ${packageDir}`
    )
  }

  /** Print available commands from descriptor */
  printHelp(): void {
    try {
      const desc = loadDescriptor(this.options.packageDir)
      const { displayName, commands } = desc.functional
      process.stdout.write(`\n${displayName}\n\n`)
      process.stdout.write('COMMANDS\n')
      for (const cmd of commands) {
        process.stdout.write(`  ${cmd.name.padEnd(20)} ${cmd.description}\n`)
      }
      process.stdout.write('\n')
    } catch {
      process.stdout.write('Usage: <command> [flags]\n')
    }
  }
}
