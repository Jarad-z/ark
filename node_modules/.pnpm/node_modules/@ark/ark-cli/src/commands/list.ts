import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadDescriptor } from '@ark/core'

export function listClis(monorepoRoot: string): void {
  const searchDirs = [
    join(monorepoRoot, 'packages'),
    join(monorepoRoot, 'tools'),
  ]

  const found: Array<{ id: string; displayName: string; kind: string; description: string }> = []

  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const pkgDir = join(dir, entry.name)
      const descriptorPath = join(pkgDir, 'ark-descriptor.yaml')
      if (!existsSync(descriptorPath)) continue

      try {
        const desc = loadDescriptor(pkgDir)
        found.push({
          id: desc.functional.id,
          displayName: desc.functional.displayName,
          kind: desc.lineage.kind,
          description: desc.functional.description.split('\n')[0]?.trim() ?? '',
        })
      } catch {
        // skip invalid descriptors
      }
    }
  }

  if (found.length === 0) {
    process.stdout.write('No Ark CLIs found.\n')
    return
  }

  process.stdout.write('\nArk CLIs\n')
  process.stdout.write('─'.repeat(70) + '\n')
  for (const cli of found) {
    const tag = cli.kind === 'composed' ? '[composed]' : '[leaf]    '
    process.stdout.write(`${tag} ${cli.id.padEnd(35)} ${cli.displayName}\n`)
    if (cli.description) {
      process.stdout.write(`           ${cli.description}\n`)
    }
  }
  process.stdout.write('\n')
}
