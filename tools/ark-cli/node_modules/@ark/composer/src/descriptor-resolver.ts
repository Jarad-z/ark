import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { loadDescriptor } from '@ark/core'
import type { CliDescriptor } from '@ark/core'
import { DescriptorNotFoundError } from '@ark/core'

/**
 * Finds ark-descriptor.yaml files for parent CLI IDs within the monorepo.
 *
 * Resolution order:
 * 1. packages/<name> where name = id without @scope/  (e.g. @ark/cli-xhs → packages/cli-xhs)
 * 2. tools/<name>
 * 3. Any direct path passed in searchRoots
 */
export class DescriptorResolver {
  private searchRoots: string[]

  constructor(monorepoRoot: string, extraSearchRoots: string[] = []) {
    this.searchRoots = [
      join(monorepoRoot, 'packages'),
      join(monorepoRoot, 'tools'),
      ...extraSearchRoots,
    ]
  }

  resolve(id: string): CliDescriptor {
    const packageDir = this.findPackageDir(id)
    if (!packageDir) {
      throw new DescriptorNotFoundError(id)
    }
    return loadDescriptor(packageDir)
  }

  resolveAll(ids: string[]): Map<string, CliDescriptor> {
    const map = new Map<string, CliDescriptor>()
    for (const id of ids) {
      map.set(id, this.resolve(id))
    }
    return map
  }

  private findPackageDir(id: string): string | null {
    // Strip scope: @ark/cli-xhs → cli-xhs
    const name = id.includes('/') ? id.split('/').slice(1).join('/') : id

    for (const root of this.searchRoots) {
      const candidate = resolve(root, name)
      if (existsSync(join(candidate, 'ark-descriptor.yaml'))) {
        return candidate
      }
    }
    return null
  }
}
