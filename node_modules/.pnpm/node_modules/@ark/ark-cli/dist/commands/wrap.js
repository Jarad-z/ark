import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
/**
 * Scaffolds a leaf CLI adapter package that wraps a third-party CLI binary.
 *
 * Generated structure:
 *   <outDir>/
 *     src/index.ts
 *     src/types.ts
 *     ark-descriptor.yaml
 *     package.json
 *     tsconfig.json
 */
export function wrapCli(options) {
    const { id, cli, cmd, outDir, monorepoRoot } = options;
    const absOut = resolve(monorepoRoot, outDir);
    if (existsSync(absOut)) {
        process.stderr.write(`[ark wrap] Directory already exists: ${absOut}\n`);
        process.stderr.write('[ark wrap] Aborting to avoid overwriting existing files.\n');
        process.exit(1);
    }
    // Derive a short name from the package id: "@my-org/cli-feishu-adapter" → "feishu-adapter"
    const shortName = id.includes('/')
        ? id.split('/').pop().replace(/^cli-/, '')
        : id.replace(/^cli-/, '');
    const displayName = shortName
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    const cmdArgs = cmd.trim().split(/\s+/); // e.g. "message send" → ["message", "send"]
    const cmdArgsLiteral = cmdArgs.map((a) => `'${a}'`).join(', ');
    const now = new Date().toISOString();
    // ── package.json ───────────────────────────────────────────────────────────
    const packageJson = {
        name: id,
        version: '0.1.0',
        type: 'module',
        description: `Ark adapter for the ${cli} CLI`,
        main: 'dist/index.js',
        scripts: {
            build: 'tsc',
            test: 'vitest run',
        },
        dependencies: {
            '@ark/core': 'workspace:*',
            execa: '^9.0.0',
        },
        devDependencies: {
            typescript: '^5.0.0',
            vitest: '^2.0.0',
        },
    };
    // ── tsconfig.json ──────────────────────────────────────────────────────────
    const tsconfig = {
        extends: '../../../tsconfig.base.json',
        compilerOptions: {
            outDir: 'dist',
            rootDir: 'src',
        },
        include: ['src'],
    };
    // ── src/types.ts ───────────────────────────────────────────────────────────
    const typesTs = `// Input and output types for the ${displayName}.
// Edit these to match the actual CLI inputs/outputs.

export interface ${toPascalCase(shortName)}Input {
  // TODO: add input fields
  // example:
  // chatId: string
  // message: string
}

export interface ${toPascalCase(shortName)}Output {
  // TODO: add output fields
  // example:
  // success: boolean
  // messageId: string
}
`;
    // ── src/index.ts ───────────────────────────────────────────────────────────
    const cmdArgsStr = cmdArgs.length > 0 ? `\n    ${cmdArgsLiteral},` : '';
    const indexTs = `#!/usr/bin/env node
import { readInputPayload, writeOutput } from '@ark/core'
import { execa } from 'execa'
import type { ${toPascalCase(shortName)}Input, ${toPascalCase(shortName)}Output } from './types.js'

// ── 1. Read inputs (pipeline call vs direct terminal call) ────────────────
const payload = readInputPayload<${toPascalCase(shortName)}Input>()

const args = process.argv.slice(2)
function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag)
  return idx !== -1 ? args[idx + 1] : undefined
}

// TODO: replace with your actual input fields
// const myField = payload?.myField ?? getFlag('--my-field')

// ── 2. Auth check ─────────────────────────────────────────────────────────
// const token = process.env['${cli.toUpperCase()}_TOKEN']
// if (!token) {
//   process.stderr.write('[ark:${shortName}] Error: ${cli.toUpperCase()}_TOKEN env var is required\\n')
//   process.exit(1)
// }

// ── 3. Invoke third-party CLI ─────────────────────────────────────────────
const result = await execa('${cli}', [${cmdArgsStr}
  // TODO: add CLI flags mapped from inputs
  // '--some-flag', myField,
], { reject: false })

if (result.exitCode !== 0) {
  process.stderr.write(\`[ark:${shortName}] CLI error: \${result.stderr}\\n\`)
  process.exit(1)
}

// ── 4. Parse third-party CLI output ──────────────────────────────────────
let output: ${toPascalCase(shortName)}Output
try {
  // Option A: third-party CLI outputs JSON
  output = JSON.parse(result.stdout) as ${toPascalCase(shortName)}Output
} catch {
  // Option B: third-party CLI outputs plain text — extract what you need
  output = {
    // TODO: parse result.stdout
  } as ${toPascalCase(shortName)}Output
}

// ── 5. Write Ark protocol output ──────────────────────────────────────────
writeOutput(output)
process.exit(0)
`;
    // ── ark-descriptor.yaml ────────────────────────────────────────────────────
    const descriptorYaml = `apiVersion: ark/v1
kind: CliDescriptor

functional:
  id: "${id}"
  version: "0.1.0"
  displayName: "${displayName}"
  description: |
    Wraps the ${cli} CLI for use in Ark pipelines.
    Depends on: ${cli} CLI installed and available in PATH.
  entrypoint: "dist/index.js"
  modes: [manual, auto]

  inputs: []
  # TODO: declare inputs, e.g.:
  # inputs:
  #   - id: chatId
  #     type: string
  #     required: true
  #     description: "..."

  outputs: []
  # TODO: declare outputs, e.g.:
  # outputs:
  #   - id: success
  #     type: boolean
  #     description: "..."

  commands:
    - name: ${cmdArgs[0] ?? 'run'}
      description: "Run ${cmd}"
      options: []

  env: []
  # TODO: declare required env vars, e.g.:
  # env:
  #   - name: ${cli.toUpperCase()}_TOKEN
  #     required: true
  #     description: "Auth token for ${cli}"

lineage:
  kind: leaf
  createdAt: "${now}"
`;
    // ── Write files ────────────────────────────────────────────────────────────
    mkdirSync(join(absOut, 'src'), { recursive: true });
    writeFileSync(join(absOut, 'package.json'), JSON.stringify(packageJson, null, 2) + '\n');
    writeFileSync(join(absOut, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2) + '\n');
    writeFileSync(join(absOut, 'src', 'types.ts'), typesTs);
    writeFileSync(join(absOut, 'src', 'index.ts'), indexTs);
    writeFileSync(join(absOut, 'ark-descriptor.yaml'), descriptorYaml);
    process.stdout.write(`\n[ark wrap] Scaffolded adapter package at: ${absOut}\n\n`);
    process.stdout.write(`Next steps:\n`);
    process.stdout.write(`  1. Edit src/types.ts  — define Input/Output types\n`);
    process.stdout.write(`  2. Edit src/index.ts  — map inputs to CLI flags, parse output\n`);
    process.stdout.write(`  3. Edit ark-descriptor.yaml  — declare inputs/outputs/env\n`);
    process.stdout.write(`  4. pnpm --filter ${id} build\n\n`);
}
function toPascalCase(str) {
    return str
        .split(/[-_]/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('');
}
//# sourceMappingURL=wrap.js.map