"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineContextSchema = exports.ComposeRequestSchema = exports.ComposeCommandSchema = exports.WiringPlanSchema = exports.StreamingConfigSchema = exports.WiringFlagSchema = exports.AutoModeDecisionStepSchema = exports.ErrorPolicySchema = exports.RetryPolicySchema = exports.WiringStepSchema = exports.OutputBindingSchema = exports.CliDescriptorSchema = exports.LineageSchema = exports.ParentRefSchema = exports.FunctionalSchema = exports.EnvVarSchema = exports.CommandSchema = exports.CommandOptionSchema = exports.PortSchema = exports.ISO8601Schema = void 0;
const zod_1 = require("zod");
// ── Shared primitives ────────────────────────────────────────────────────────
exports.ISO8601Schema = zod_1.z.string().datetime({ offset: true });
// ── Port types ───────────────────────────────────────────────────────────────
exports.PortSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.string(),
    required: zod_1.z.boolean().default(false),
    description: zod_1.z.string().optional(),
});
// ── Command option ───────────────────────────────────────────────────────────
exports.CommandOptionSchema = zod_1.z.object({
    flag: zod_1.z.string(),
    type: zod_1.z.string(),
    required: zod_1.z.boolean().default(false),
    description: zod_1.z.string().optional(),
    default: zod_1.z.unknown().optional(),
});
exports.CommandSchema = zod_1.z.object({
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    options: zod_1.z.array(exports.CommandOptionSchema).default([]),
    // For composed CLIs: points to the wiring plan for this command.
    // Relative to the package root. Defaults to ark-wiring.yaml if omitted.
    wiringRef: zod_1.z.string().optional(),
});
// ── Env var declaration ──────────────────────────────────────────────────────
exports.EnvVarSchema = zod_1.z.object({
    name: zod_1.z.string(),
    required: zod_1.z.boolean().default(true),
    description: zod_1.z.string().optional(),
    default: zod_1.z.string().optional(),
});
// ── Functional section ───────────────────────────────────────────────────────
exports.FunctionalSchema = zod_1.z.object({
    id: zod_1.z.string(),
    version: zod_1.z.string(),
    displayName: zod_1.z.string(),
    description: zod_1.z.string(),
    entrypoint: zod_1.z.string(),
    modes: zod_1.z.array(zod_1.z.enum(['auto', 'manual'])).default(['manual']),
    inputs: zod_1.z.array(exports.PortSchema).default([]),
    outputs: zod_1.z.array(exports.PortSchema).default([]),
    commands: zod_1.z.array(exports.CommandSchema).default([]),
    // When this CLI is used as a leaf step inside another pipeline, this command
    // is run if the wiring step does not specify a `command` field.
    // Falls back to ark-wiring.yaml if omitted.
    defaultCommand: zod_1.z.string().optional(),
    // Free-form type definitions referenced by ports
    types: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).default({}),
    env: zod_1.z.array(exports.EnvVarSchema).default([]),
});
// ── Lineage section ──────────────────────────────────────────────────────────
exports.ParentRefSchema = zod_1.z.object({
    id: zod_1.z.string(),
    version: zod_1.z.string(),
    descriptorHash: zod_1.z.string().optional(),
});
exports.LineageSchema = zod_1.z.discriminatedUnion('kind', [
    zod_1.z.object({
        kind: zod_1.z.literal('leaf'),
        createdAt: exports.ISO8601Schema,
        authors: zod_1.z.array(zod_1.z.object({ handle: zod_1.z.string() })).default([]),
        history: zod_1.z.array(zod_1.z.unknown()).default([]),
    }),
    zod_1.z.object({
        kind: zod_1.z.literal('composed'),
        createdAt: exports.ISO8601Schema,
        authors: zod_1.z.array(zod_1.z.object({ handle: zod_1.z.string() })).default([]),
        parents: zod_1.z.array(exports.ParentRefSchema),
        aiPrompt: zod_1.z.string(),
        aiProposal: zod_1.z.string(),
        approvedWiringRef: zod_1.z.string().default('ark-wiring.yaml'),
        humanEdits: zod_1.z.string().optional(),
        usedAsParentIn: zod_1.z.array(zod_1.z.string()).default([]),
    }),
]);
// ── CliDescriptor ────────────────────────────────────────────────────────────
exports.CliDescriptorSchema = zod_1.z.object({
    apiVersion: zod_1.z.literal('ark/v1'),
    kind: zod_1.z.literal('CliDescriptor'),
    functional: exports.FunctionalSchema,
    lineage: exports.LineageSchema,
});
// ── WiringPlan ───────────────────────────────────────────────────────────────
exports.OutputBindingSchema = zod_1.z.object({
    bind: zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
});
exports.WiringStepSchema = zod_1.z.object({
    id: zod_1.z.string(),
    uses: zod_1.z.string(),
    command: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    condition: zod_1.z.string().optional(),
    inputs: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).default({}),
    outputs: exports.OutputBindingSchema.optional(),
    timeout: zod_1.z.string().regex(/^\d+[sm]$/).optional(),
    dependsOn: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.RetryPolicySchema = zod_1.z.object({
    maxAttempts: zod_1.z.number().int().positive().default(3),
    backoffMs: zod_1.z.number().int().nonnegative().default(1000),
    jitter: zod_1.z.boolean().default(false),
});
exports.ErrorPolicySchema = zod_1.z.object({
    onStepFailure: zod_1.z.enum(['abort', 'continue', 'retry']).default('abort'),
    retryPolicy: exports.RetryPolicySchema.optional(),
    parallelBehavior: zod_1.z.enum(['failFast', 'waitAll']).default('failFast'),
});
exports.AutoModeDecisionStepSchema = zod_1.z.object({
    before: zod_1.z.string(),
    prompt: zod_1.z.string(),
    outputBindings: zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
});
exports.WiringFlagSchema = zod_1.z.object({
    name: zod_1.z.string(),
    type: zod_1.z.string(),
    required: zod_1.z.boolean().default(false),
    description: zod_1.z.string().optional(),
    default: zod_1.z.unknown().optional(),
});
exports.StreamingConfigSchema = zod_1.z.object({
    until: exports.ISO8601Schema.optional(),
    stopOn: zod_1.z.string().optional(),
    restartOnFailure: zod_1.z.boolean().default(false),
});
exports.WiringPlanSchema = zod_1.z.object({
    apiVersion: zod_1.z.literal('ark/v1'),
    kind: zod_1.z.literal('WiringPlan'),
    generatedBy: zod_1.z.string().optional(),
    generatedAt: exports.ISO8601Schema.optional(),
    approvedAt: exports.ISO8601Schema.optional(),
    pipeline: zod_1.z.object({
        // New canonical field
        topology: zod_1.z.enum(['sequential', 'dag']).optional(),
        /** @deprecated Use topology instead. Will be removed in a future version. */
        mode: zod_1.z.enum(['sequential', 'dag']).optional(),
        lifecycle: zod_1.z.enum(['finite', 'streaming']).default('finite'),
        concurrency: zod_1.z.number().int().positive().optional(),
    }).refine((p) => p.topology !== undefined || p.mode !== undefined, { message: 'pipeline.topology (or deprecated pipeline.mode) is required' }),
    streaming: exports.StreamingConfigSchema.optional(),
    steps: zod_1.z.array(exports.WiringStepSchema),
    errorPolicy: exports.ErrorPolicySchema.optional(),
    autoMode: zod_1.z
        .object({
        decisionStep: exports.AutoModeDecisionStepSchema,
    })
        .optional(),
    flags: zod_1.z.array(exports.WiringFlagSchema).default([]),
}).superRefine((plan, ctx) => {
    if (plan.streaming !== undefined && plan.pipeline.lifecycle !== 'streaming') {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['streaming'],
            message: 'streaming config is only valid when pipeline.lifecycle is "streaming"',
        });
    }
});
// ── ComposeRequest ───────────────────────────────────────────────────────────
// A single-command compose request (original, simple form)
// A multi-command compose request uses the `commands` array instead of `intent`
exports.ComposeCommandSchema = zod_1.z.object({
    name: zod_1.z.string(),
    intent: zod_1.z.string(),
    constraints: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.ComposeRequestSchema = zod_1.z.object({
    apiVersion: zod_1.z.literal('ark/v1'),
    kind: zod_1.z.literal('ComposeRequest'),
    output: zod_1.z.object({
        id: zod_1.z.string(),
        displayName: zod_1.z.string(),
        description: zod_1.z.string().optional(),
        targetDirectory: zod_1.z.string(),
    }),
    parents: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string() })),
    // Single-command form (backward compatible)
    intent: zod_1.z.string().optional(),
    constraints: zod_1.z.array(zod_1.z.string()).default([]),
    // Multi-command form: each command gets its own wiring plan
    commands: zod_1.z.array(exports.ComposeCommandSchema).optional(),
    aiModel: zod_1.z.string().optional(),
}).refine((d) => d.intent !== undefined || (d.commands !== undefined && d.commands.length > 0), { message: 'Either intent (single-command) or commands (multi-command) must be provided.' });
// ── PipelineContext ──────────────────────────────────────────────────────────
exports.PipelineContextSchema = zod_1.z.object({
    mode: zod_1.z.enum(['auto', 'manual']),
    flags: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    stepOutputs: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    bindings: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    dryRun: zod_1.z.boolean().default(false),
    meta: zod_1.z.object({
        composedCliId: zod_1.z.string(),
        runId: zod_1.z.string(),
        startedAt: exports.ISO8601Schema,
    }),
});
//# sourceMappingURL=schemas.js.map