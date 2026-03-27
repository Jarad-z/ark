import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as yaml from 'js-yaml'
import type { ComposeRequest, CliDescriptor } from '@ark/core'
import type { LineageData } from './lineage-writer.js'

export interface ScaffoldOptions {
  monorepoRoot: string
  request: ComposeRequest
  descriptors: Map<string, CliDescriptor>
  wiringYaml: string
  lineage: LineageData
}

/**
 * Creates the composed CLI package directory with all required files.
 */
export class PackageScaffolder {
  scaffold(options: ScaffoldOptions): string {
    const { monorepoRoot, request, descriptors, wiringYaml, lineage } = options
    const targetDir = resolve(monorepoRoot, request.output.targetDirectory)

    if (existsSync(targetDir)) {
      throw new Error(
        `Target directory already exists: ${targetDir}. Remove it before re-composing.`
      )
    }

    mkdirSync(join(targetDir, 'src'), { recursive: true })

    this.writeDescriptor(targetDir, request, descriptors, lineage)
    this.writeWiring(targetDir, wiringYaml)
    this.writePackageJson(targetDir, request, descriptors)
    this.writeTsConfig(targetDir)
    this.writeEntrypoint(targetDir, request)

    return targetDir
  }

  private writeDescriptor(
    targetDir: string,
    request: ComposeRequest,
    descriptors: Map<string, CliDescriptor>,
    lineage: LineageData
  ): void {
    // Merge declared flags from all parent functional outputs into the composed CLI's inputs
    const allFlags = this.inferFlags(descriptors)

    const descriptor = {
      apiVersion: 'ark/v1',
      kind: 'CliDescriptor',
      functional: {
        id: request.output.id,
        version: '0.1.0',
        displayName: request.output.displayName,
        description: request.output.description ?? '',
        entrypoint: 'dist/index.js',
        modes: ['auto', 'manual'],
        inputs: [],
        outputs: [],
        commands: [
          {
            name: 'run',
            description: 'Execute the composed pipeline.',
            options: allFlags,
          },
        ],
        types: {},
        env: [],
      },
      lineage,
    }

    writeFileSync(
      join(targetDir, 'ark-descriptor.yaml'),
      yaml.dump(descriptor, { lineWidth: 120 }),
      'utf8'
    )
  }

  private writeWiring(targetDir: string, wiringYaml: string): void {
    writeFileSync(join(targetDir, 'ark-wiring.yaml'), wiringYaml, 'utf8')
  }

  private writePackageJson(
    targetDir: string,
    request: ComposeRequest,
    descriptors: Map<string, CliDescriptor>
  ): void {
    const parentDeps: Record<string, string> = {}
    for (const [id] of descriptors) {
      parentDeps[id] = 'workspace:*'
    }

    const pkg = {
      name: request.output.id,
      version: '0.1.0',
      description: request.output.description ?? '',
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      bin: {
        [request.output.id.replace(/^@[^/]+\//, '')]: 'dist/index.js',
      },
      scripts: {
        build: 'tsc',
        test: 'vitest run',
        typecheck: 'tsc --noEmit',
      },
      dependencies: {
        '@ark/core': 'workspace:*',
        '@ark/runtime': 'workspace:*',
        ...parentDeps,
      },
    }

    writeFileSync(
      join(targetDir, 'package.json'),
      JSON.stringify(pkg, null, 2) + '\n',
      'utf8'
    )
  }

  private writeTsConfig(targetDir: string): void {
    const tsconfig = {
      extends: '../../tsconfig.base.json',
      compilerOptions: { outDir: 'dist', rootDir: 'src' },
      include: ['src'],
    }
    writeFileSync(
      join(targetDir, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2) + '\n',
      'utf8'
    )
  }

  private writeEntrypoint(targetDir: string, request: ComposeRequest): void {
    const content = `#!/usr/bin/env node
import { PipelineRunner } from '@ark/runtime'
import { join } from 'node:path'

const runner = new PipelineRunner({
  wiringPath: join(import.meta.dirname, '..', 'ark-wiring.yaml'),
  composedCliId: '${request.output.id}',
  monorepoRoot: join(import.meta.dirname, '..', '..', '..'),
})

await runner.run(process.argv.slice(2))
`
    writeFileSync(join(targetDir, 'src', 'index.ts'), content, 'utf8')
  }

  private inferFlags(descriptors: Map<string, CliDescriptor>): Array<{
    flag: string
    type: string
    required: boolean
    description: string
  }> {
    // Collect common flags surfaced across all parent CLIs
    const seen = new Set<string>()
    const flags: Array<{ flag: string; type: string; required: boolean; description: string }> = []

    for (const desc of descriptors.values()) {
      for (const cmd of desc.functional.commands) {
        for (const opt of cmd.options) {
          if (!seen.has(opt.flag)) {
            seen.add(opt.flag)
            flags.push({
              flag: opt.flag,
              type: opt.type,
              required: opt.required,
              description: opt.description ?? '',
            })
          }
        }
      }
    }

    // Always include mode flags
    if (!seen.has('--auto')) {
      flags.push({ flag: '--auto', type: 'boolean', required: false, description: 'Run in auto mode (AI makes all decisions).' })
    }
    if (!seen.has('--dry-run')) {
      flags.push({ flag: '--dry-run', type: 'boolean', required: false, description: 'Preview without executing publish steps.' })
    }

    return flags
  }
}
