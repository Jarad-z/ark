#!/usr/bin/env node
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PipelineRunner } from '@ark/runtime'
import { listClis } from './commands/list.js'
import { describeCli } from './commands/describe.js'
import { validateCli } from './commands/validate.js'
import { showLineage } from './commands/lineage.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const MONOREPO_ROOT = join(__dirname, '..', '..', '..')

const [, , command, ...rest] = process.argv

function usage(): void {
  process.stdout.write(`
ark — CLI composition framework

USAGE
  ark <command> [options]

COMMANDS
  list                          List all Ark CLIs in this monorepo
  describe <id>                 Show full descriptor for a CLI
  validate <id>                 Validate descriptor and wiring plan
  lineage  <id>                 Show parent composition tree
  run      <id> [flags...]      Run a composed CLI pipeline

EXAMPLES
  ark list
  ark describe @ark/cli-weather-report
  ark validate @ark/cli-weather-report
  ark lineage  @ark/cli-weather-report
  ark run @ark/cli-weather-report --city Shanghai
  ark run @ark/cli-weather-report --auto
  ark run @ark/cli-weather-report --city Beijing --dry-run
`)
}

async function main(): Promise<void> {
  switch (command) {
    case 'list':
      listClis(MONOREPO_ROOT)
      break

    case 'describe': {
      const id = rest[0]
      if (!id) { process.stderr.write('Usage: ark describe <id>\n'); process.exit(1) }
      describeCli(id, MONOREPO_ROOT)
      break
    }

    case 'validate': {
      const id = rest[0]
      if (!id) { process.stderr.write('Usage: ark validate <id>\n'); process.exit(1) }
      process.stdout.write(`\nValidating ${id}...\n`)
      validateCli(id, MONOREPO_ROOT)
      break
    }

    case 'lineage': {
      const id = rest[0]
      if (!id) { process.stderr.write('Usage: ark lineage <id>\n'); process.exit(1) }
      showLineage(id, MONOREPO_ROOT)
      break
    }

    case 'run': {
      const id = rest[0]
      if (!id) { process.stderr.write('Usage: ark run <id> [flags...]\n'); process.exit(1) }

      const name = id.includes('/') ? id.split('/').slice(1).join('/') : id
      const wiringPath = join(MONOREPO_ROOT, 'packages', name, 'ark-wiring.yaml')

      const runner = new PipelineRunner({
        wiringPath,
        composedCliId: id,
        monorepoRoot: MONOREPO_ROOT,
      })

      const result = await runner.run(rest.slice(1))
      if (!result.success) process.exit(1)
      break
    }

    default:
      usage()
  }
}

main().catch((err) => {
  process.stderr.write(`ark: ${String(err)}\n`)
  process.exit(1)
})
