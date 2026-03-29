import { z } from 'zod'

// ── Shared primitives ────────────────────────────────────────────────────────

export const ISO8601Schema = z.string().datetime({ offset: true })

// ── Port types ───────────────────────────────────────────────────────────────

export const PortSchema = z.object({
  id: z.string(),
  type: z.string(),
  required: z.boolean().default(false),
  description: z.string().optional(),
})

export type Port = z.infer<typeof PortSchema>

// ── Command option ───────────────────────────────────────────────────────────

export const CommandOptionSchema = z.object({
  flag: z.string(),
  type: z.string(),
  required: z.boolean().default(false),
  description: z.string().optional(),
  default: z.unknown().optional(),
})

export const CommandSchema = z.object({
  name: z.string(),
  description: z.string(),
  options: z.array(CommandOptionSchema).default([]),
  // For composed CLIs: points to the wiring plan for this command.
  // Relative to the package root. Defaults to ark-wiring.yaml if omitted.
  wiringRef: z.string().optional(),
})

// ── Env var declaration ──────────────────────────────────────────────────────

export const EnvVarSchema = z.object({
  name: z.string(),
  required: z.boolean().default(true),
  description: z.string().optional(),
  default: z.string().optional(),
})

// ── Functional section ───────────────────────────────────────────────────────

export const FunctionalSchema = z.object({
  id: z.string(),
  version: z.string(),
  displayName: z.string(),
  description: z.string(),
  entrypoint: z.string(),
  modes: z.array(z.enum(['auto', 'manual'])).default(['manual']),
  inputs: z.array(PortSchema).default([]),
  outputs: z.array(PortSchema).default([]),
  commands: z.array(CommandSchema).default([]),
  // Free-form type definitions referenced by ports
  types: z.record(z.string(), z.unknown()).default({}),
  env: z.array(EnvVarSchema).default([]),
})

export type Functional = z.infer<typeof FunctionalSchema>

// ── Lineage section ──────────────────────────────────────────────────────────

export const ParentRefSchema = z.object({
  id: z.string(),
  version: z.string(),
  descriptorHash: z.string().optional(),
})

export const LineageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('leaf'),
    createdAt: ISO8601Schema,
    authors: z.array(z.object({ handle: z.string() })).default([]),
    history: z.array(z.unknown()).default([]),
  }),
  z.object({
    kind: z.literal('composed'),
    createdAt: ISO8601Schema,
    authors: z.array(z.object({ handle: z.string() })).default([]),
    parents: z.array(ParentRefSchema),
    aiPrompt: z.string(),
    aiProposal: z.string(),
    approvedWiringRef: z.string().default('ark-wiring.yaml'),
    humanEdits: z.string().optional(),
    usedAsParentIn: z.array(z.string()).default([]),
  }),
])

export type Lineage = z.infer<typeof LineageSchema>

// ── CliDescriptor ────────────────────────────────────────────────────────────

export const CliDescriptorSchema = z.object({
  apiVersion: z.literal('ark/v1'),
  kind: z.literal('CliDescriptor'),
  functional: FunctionalSchema,
  lineage: LineageSchema,
})

export type CliDescriptor = z.infer<typeof CliDescriptorSchema>

// ── WiringPlan ───────────────────────────────────────────────────────────────

export const OutputBindingSchema = z.object({
  bind: z.record(z.string(), z.string()),
})

export const WiringStepSchema = z.object({
  id: z.string(),
  uses: z.string(),
  command: z.string().optional(),
  description: z.string().optional(),
  condition: z.string().optional(),
  inputs: z.record(z.string(), z.unknown()).default({}),
  outputs: OutputBindingSchema.optional(),
  timeout: z.string().regex(/^\d+[sm]$/).optional(),
  dependsOn: z.array(z.string()).optional(),
})

export type WiringStep = z.infer<typeof WiringStepSchema>

export const RetryPolicySchema = z.object({
  maxAttempts: z.number().int().positive().default(3),
  backoffMs: z.number().int().nonnegative().default(1000),
  jitter: z.boolean().default(false),
})

export const ErrorPolicySchema = z.object({
  onStepFailure: z.enum(['abort', 'continue', 'retry']).default('abort'),
  retryPolicy: RetryPolicySchema.optional(),
  parallelBehavior: z.enum(['failFast', 'waitAll']).default('failFast'),
})

export const AutoModeDecisionStepSchema = z.object({
  before: z.string(),
  prompt: z.string(),
  outputBindings: z.record(z.string(), z.string()),
})

export const WiringFlagSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean().default(false),
  description: z.string().optional(),
  default: z.unknown().optional(),
})

export const WiringPlanSchema = z.object({
  apiVersion: z.literal('ark/v1'),
  kind: z.literal('WiringPlan'),
  generatedBy: z.string().optional(),
  generatedAt: ISO8601Schema.optional(),
  approvedAt: ISO8601Schema.optional(),
  pipeline: z.object({
    mode: z.enum(['sequential', 'parallel', 'dag']).default('sequential'),
  }),
  steps: z.array(WiringStepSchema),
  errorPolicy: ErrorPolicySchema.optional(),
  autoMode: z
    .object({
      decisionStep: AutoModeDecisionStepSchema,
    })
    .optional(),
  flags: z.array(WiringFlagSchema).default([]),
})

export type WiringPlan = z.infer<typeof WiringPlanSchema>

// ── ComposeRequest ───────────────────────────────────────────────────────────

// A single-command compose request (original, simple form)
// A multi-command compose request uses the `commands` array instead of `intent`
export const ComposeCommandSchema = z.object({
  name: z.string(),
  intent: z.string(),
  constraints: z.array(z.string()).default([]),
})

export type ComposeCommand = z.infer<typeof ComposeCommandSchema>

export const ComposeRequestSchema = z.object({
  apiVersion: z.literal('ark/v1'),
  kind: z.literal('ComposeRequest'),
  output: z.object({
    id: z.string(),
    displayName: z.string(),
    description: z.string().optional(),
    targetDirectory: z.string(),
  }),
  parents: z.array(z.object({ id: z.string() })),
  // Single-command form (backward compatible)
  intent: z.string().optional(),
  constraints: z.array(z.string()).default([]),
  // Multi-command form: each command gets its own wiring plan
  commands: z.array(ComposeCommandSchema).optional(),
  aiModel: z.string().optional(),
}).refine(
  (d) => d.intent !== undefined || (d.commands !== undefined && d.commands.length > 0),
  { message: 'Either intent (single-command) or commands (multi-command) must be provided.' }
)

export type ComposeRequest = z.infer<typeof ComposeRequestSchema>

// ── PipelineContext ──────────────────────────────────────────────────────────

export const PipelineContextSchema = z.object({
  mode: z.enum(['auto', 'manual']),
  flags: z.record(z.string(), z.unknown()),
  stepOutputs: z.record(z.string(), z.unknown()),
  bindings: z.record(z.string(), z.unknown()),
  dryRun: z.boolean().default(false),
  meta: z.object({
    composedCliId: z.string(),
    runId: z.string(),
    startedAt: ISO8601Schema,
  }),
})

export type PipelineContext = z.infer<typeof PipelineContextSchema>
