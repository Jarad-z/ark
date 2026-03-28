"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageScaffolder = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const yaml = __importStar(require("js-yaml"));
/**
 * Creates the composed CLI package directory with all required files.
 */
class PackageScaffolder {
    scaffold(options) {
        const { monorepoRoot, request, descriptors, wiringYaml, lineage } = options;
        const targetDir = (0, node_path_1.resolve)(monorepoRoot, request.output.targetDirectory);
        if ((0, node_fs_1.existsSync)(targetDir)) {
            throw new Error(`Target directory already exists: ${targetDir}. Remove it before re-composing.`);
        }
        const isMultiCommand = wiringYaml instanceof Map;
        (0, node_fs_1.mkdirSync)((0, node_path_1.join)(targetDir, 'src'), { recursive: true });
        if (isMultiCommand)
            (0, node_fs_1.mkdirSync)((0, node_path_1.join)(targetDir, 'wirings'), { recursive: true });
        this.writeDescriptor(targetDir, request, descriptors, lineage);
        this.writeWiring(targetDir, wiringYaml);
        this.writePackageJson(targetDir, request, descriptors);
        this.writeTsConfig(targetDir);
        this.writeEntrypoint(targetDir, request);
        return targetDir;
    }
    writeDescriptor(targetDir, request, descriptors, lineage) {
        // Merge declared flags from all parent functional outputs into the composed CLI's inputs
        const allFlags = this.inferFlags(descriptors);
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
                commands: request.commands && request.commands.length > 1
                    ? request.commands.map((cmd) => ({
                        name: cmd.name,
                        description: cmd.intent.split('\n')[0]?.trim() ?? cmd.name,
                        wiringRef: `wirings/${cmd.name}.yaml`,
                        options: allFlags,
                    }))
                    : [
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
        };
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(targetDir, 'ark-descriptor.yaml'), yaml.dump(descriptor, { lineWidth: 120 }), 'utf8');
    }
    writeWiring(targetDir, wiringYaml) {
        if (typeof wiringYaml === 'string') {
            // Single-command: write ark-wiring.yaml at package root
            (0, node_fs_1.writeFileSync)((0, node_path_1.join)(targetDir, 'ark-wiring.yaml'), wiringYaml, 'utf8');
        }
        else {
            // Multi-command: write wirings/<command>.yaml for each command
            for (const [commandName, yaml] of wiringYaml) {
                (0, node_fs_1.writeFileSync)((0, node_path_1.join)(targetDir, 'wirings', `${commandName}.yaml`), yaml, 'utf8');
            }
        }
    }
    writePackageJson(targetDir, request, descriptors) {
        const parentDeps = {};
        for (const [id] of descriptors) {
            parentDeps[id] = 'workspace:*';
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
        };
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(targetDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    }
    writeTsConfig(targetDir) {
        const tsconfig = {
            extends: '../../tsconfig.base.json',
            compilerOptions: { outDir: 'dist', rootDir: 'src' },
            include: ['src'],
        };
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(targetDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2) + '\n', 'utf8');
    }
    writeEntrypoint(targetDir, request) {
        const isMultiCommand = request.commands && request.commands.length > 1;
        const content = isMultiCommand
            ? `#!/usr/bin/env node
import { MultiCommandRunner } from '@ark/runtime'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const runner = new MultiCommandRunner({
  packageDir: join(__dirname, '..'),
  composedCliId: '${request.output.id}',
  monorepoRoot: join(__dirname, '..', '..', '..'),
})

const argv = process.argv.slice(2)
if (!argv[0] || argv[0] === '--help' || argv[0] === '-h') {
  runner.printHelp()
  process.exit(0)
}

const result = await runner.run(argv)
if (!result.success) process.exit(1)
`
            : `#!/usr/bin/env node
import { PipelineRunner } from '@ark/runtime'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const runner = new PipelineRunner({
  wiringPath: join(__dirname, '..', 'ark-wiring.yaml'),
  composedCliId: '${request.output.id}',
  monorepoRoot: join(__dirname, '..', '..', '..'),
})

const result = await runner.run(process.argv.slice(2))
if (!result.success) process.exit(1)
`;
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(targetDir, 'src', 'index.ts'), content, 'utf8');
    }
    inferFlags(descriptors) {
        // Collect common flags surfaced across all parent CLIs
        const seen = new Set();
        const flags = [];
        for (const desc of descriptors.values()) {
            for (const cmd of desc.functional.commands) {
                for (const opt of cmd.options) {
                    if (!seen.has(opt.flag)) {
                        seen.add(opt.flag);
                        flags.push({
                            flag: opt.flag,
                            type: opt.type,
                            required: opt.required,
                            description: opt.description ?? '',
                        });
                    }
                }
            }
        }
        // Always include mode flags
        if (!seen.has('--auto')) {
            flags.push({ flag: '--auto', type: 'boolean', required: false, description: 'Run in auto mode (AI makes all decisions).' });
        }
        if (!seen.has('--dry-run')) {
            flags.push({ flag: '--dry-run', type: 'boolean', required: false, description: 'Preview without executing publish steps.' });
        }
        return flags;
    }
}
exports.PackageScaffolder = PackageScaffolder;
//# sourceMappingURL=package-scaffolder.js.map