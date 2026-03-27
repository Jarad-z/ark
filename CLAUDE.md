# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Run tests for a single package
cd packages/<name> && pnpm test
# or
pnpm --filter @ark/<name> test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

Requirements: Node >=20.0.0, pnpm >=9.0.0.

## Architecture

Ark is a **CLI composition framework** — it lets you wire multiple "leaf" CLIs into a "composed" CLI via a YAML wiring plan, with optional AI assistance and pipeline orchestration.

### Package Layout

```
packages/
  core/          # Zod schemas, template engine, descriptor loader, I/O utils
  ai-bridge/     # Anthropic Claude API abstraction (@anthropic-ai/sdk)
  runtime/       # Pipeline execution engine (reads wiring plans, runs steps)
  composer/      # AI-assisted composition: generates wiring plans, scaffolds packages
  cli-weather/   # Leaf CLI: fetches weather from wttr.in
  cli-report/    # Leaf CLI: AI report generation via Claude
  cli-content/   # Leaf CLI: AI content generation
  cli-xhs/       # Leaf CLI: Xiaohongshu browser automation (Playwright)
  cli-xhs-scheduler/ # Leaf CLI: XHS post scheduling
  cli-weather-report/  # Composed CLI example (weather + report)
tools/
  ark-cli/       # Meta CLI (`ark` binary): compose, run, list, describe, validate, lineage
```

### Data Flow

1. **Descriptor** (`ark-descriptor.yaml`) — defines a CLI's functional interface (inputs, outputs, modes, commands, env) and lineage (leaf vs composed, parent references)
2. **Wiring Plan** (`ark-wiring.yaml`) — defines the pipeline: ordered steps, data bindings, conditions, error policy, auto-mode AI prompts
3. **Runtime** reads both files, executes steps via child processes (`execa`), resolves template expressions, and manages `PipelineContext`
4. **Composer** uses Claude to generate wiring plans from compose requests, then scaffolds new package directories

### Key Files

| File | Purpose |
|------|---------|
| `packages/core/src/schemas.ts` | Zod schemas for all data types (CliDescriptor, WiringPlan, Functional, Lineage) |
| `packages/core/src/template-engine.ts` | `{{ ctx.x }}`, `{{ ctx.a \| default: 'v' }}`, `{{ cond ? a : b }}` interpolation |
| `packages/runtime/src/pipeline-runner.ts` | Main execution orchestrator — reads plan, manages context, runs steps |
| `packages/runtime/src/builtin-steps.ts` | Built-in step types: `humanReview`, `log`, `conditional` |
| `packages/composer/src/composer.ts` | Composition orchestrator: AI plan generation → human review → scaffolding |
| `packages/cli-weather-report/ark-wiring.yaml` | Reference example of a complete wiring plan |

### Descriptor Format

```yaml
apiVersion: ark/v1
kind: CliDescriptor
functional:
  id: "@ark/cli-name"
  version: "0.1.0"
  entrypoint: "dist/index.js"
  modes: [auto, manual]
  inputs: [{ id: name, type: string, required: true }]
  outputs: [{ id: result, type: string }]
  commands: [{ name: run, description: "...", options: [...] }]
  env: [{ name: ANTHROPIC_API_KEY, required: true }]
lineage:
  kind: leaf            # or "composed"
  createdAt: ISO8601
  parents?: [{ id, version, descriptorHash }]   # composed only
```

### Wiring Plan Format

```yaml
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential
steps:
  - id: step-id
    uses: "@ark/cli-name"           # or "builtin/humanReview"
    command: run
    condition: "{{ ctx.mode == 'manual' }}"
    inputs:
      city: "{{ ctx.flags.city | default: 'London' }}"
    outputs:
      bind:
        weather-data: rawWeather    # binds step output to pipeline context
errorPolicy:
  onStepFailure: abort
  retryPolicy:
    maxAttempts: 3
    backoffMs: 2000
    jitter: true
autoMode:
  decisionStep:
    before: step-id
    prompt: "AI decision prompt..."
```

### Template Engine

- `{{ ctx.flags.name }}` — access pipeline context
- `{{ ctx.x | default: 'fallback' }}` — with default
- `{{ ctx.mode == 'manual' ? ctx.a : ctx.b }}` — ternary
- A template string with a single `{{ }}` preserves the original type; multiple interpolations coerce to string

### Adding a New Leaf CLI

1. Create `packages/cli-<name>/` with `package.json`, `tsconfig.json`, `ark-descriptor.yaml`, `src/index.ts`
2. Set `lineage.kind: leaf` in the descriptor
3. Add to `pnpm-workspace.yaml` (already covered by `packages/*` glob)
4. Extend `tsconfig.base.json` in the package's tsconfig

### Adding a New Composed CLI

Use the composer: `ark compose --request <request-file>` or run `@ark/composer` programmatically. The composer calls Claude to generate the wiring plan, prompts for human review, then scaffolds the package.
