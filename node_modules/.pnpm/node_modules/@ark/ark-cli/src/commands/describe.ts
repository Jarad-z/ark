import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadDescriptor } from '@ark/core'
import { DescriptorNotFoundError } from '@ark/core'

export function describeCli(id: string, monorepoRoot: string): void {
  const name = id.includes('/') ? id.split('/').slice(1).join('/') : id
  const searchDirs = [
    join(monorepoRoot, 'packages', name),
    join(monorepoRoot, 'tools', name),
  ]

  let desc = null
  for (const dir of searchDirs) {
    if (existsSync(join(dir, 'ark-descriptor.yaml'))) {
      desc = loadDescriptor(dir)
      break
    }
  }

  if (!desc) throw new DescriptorNotFoundError(id)

  const { functional: f, lineage: l } = desc

  process.stdout.write(`\n${'─'.repeat(70)}\n`)
  process.stdout.write(`${f.displayName} (${f.id} v${f.version})\n`)
  process.stdout.write(`${'─'.repeat(70)}\n\n`)
  process.stdout.write(`DESCRIPTION\n  ${f.description.trim()}\n\n`)
  process.stdout.write(`MODES      ${f.modes.join(', ')}\n\n`)

  if (f.inputs.length > 0) {
    process.stdout.write(`INPUTS\n`)
    for (const inp of f.inputs) {
      const req = inp.required ? '(required)' : '(optional)'
      process.stdout.write(`  ${inp.id.padEnd(20)} ${inp.type.padEnd(15)} ${req}  ${inp.description ?? ''}\n`)
    }
    process.stdout.write('\n')
  }

  if (f.outputs.length > 0) {
    process.stdout.write(`OUTPUTS\n`)
    for (const out of f.outputs) {
      process.stdout.write(`  ${out.id.padEnd(20)} ${out.type.padEnd(15)}  ${out.description ?? ''}\n`)
    }
    process.stdout.write('\n')
  }

  process.stdout.write(`LINEAGE    ${l.kind}\n`)
  if (l.kind === 'composed') {
    process.stdout.write(`PARENTS\n`)
    for (const p of l.parents) {
      process.stdout.write(`  ${p.id} @ ${p.version}\n`)
    }
    if (l.humanEdits) {
      process.stdout.write(`\nHUMAN EDITS\n  ${l.humanEdits}\n`)
    }
  }
  process.stdout.write('\n')
}
