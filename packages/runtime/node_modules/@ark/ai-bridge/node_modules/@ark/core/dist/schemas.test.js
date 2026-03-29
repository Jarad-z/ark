"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const schemas_js_1 = require("./schemas.js");
const leafDescriptor = {
    apiVersion: 'ark/v1',
    kind: 'CliDescriptor',
    functional: {
        id: '@ark/cli-xhs',
        version: '1.0.0',
        displayName: 'Xiaohongshu CLI',
        description: 'Browser automation for Xiaohongshu.',
        entrypoint: 'dist/index.js',
        inputs: [{ id: 'post', type: 'Post', required: true }],
        outputs: [{ id: 'publishResult', type: 'PublishResult' }],
    },
    lineage: {
        kind: 'leaf',
        createdAt: '2025-01-15T10:00:00+00:00',
    },
};
(0, vitest_1.describe)('CliDescriptorSchema', () => {
    (0, vitest_1.it)('parses a valid leaf descriptor', () => {
        const result = schemas_js_1.CliDescriptorSchema.safeParse(leafDescriptor);
        (0, vitest_1.expect)(result.success).toBe(true);
    });
    (0, vitest_1.it)('rejects missing required functional.id', () => {
        const invalid = structuredClone(leafDescriptor);
        // @ts-expect-error intentional
        delete invalid.functional.id;
        (0, vitest_1.expect)(schemas_js_1.CliDescriptorSchema.safeParse(invalid).success).toBe(false);
    });
    (0, vitest_1.it)('parses a composed descriptor', () => {
        const composed = {
            ...leafDescriptor,
            lineage: {
                kind: 'composed',
                createdAt: '2025-02-01T14:00:00+00:00',
                parents: [
                    { id: '@ark/cli-xhs', version: '1.0.0' },
                    { id: '@ark/cli-content', version: '1.0.0' },
                ],
                aiPrompt: 'Combine these CLIs...',
                aiProposal: 'Here is my proposal...',
            },
        };
        (0, vitest_1.expect)(schemas_js_1.CliDescriptorSchema.safeParse(composed).success).toBe(true);
    });
});
(0, vitest_1.describe)('WiringPlanSchema', () => {
    (0, vitest_1.it)('parses a minimal valid wiring plan', () => {
        const plan = {
            apiVersion: 'ark/v1',
            kind: 'WiringPlan',
            pipeline: { mode: 'sequential' },
            steps: [
                {
                    id: 'generate',
                    uses: '@ark/cli-content',
                    command: 'generate',
                    inputs: { topic: '{{ ctx.flags.topic }}' },
                    outputs: { bind: { generatedPost: 'post' } },
                },
            ],
        };
        (0, vitest_1.expect)(schemas_js_1.WiringPlanSchema.safeParse(plan).success).toBe(true);
    });
});
(0, vitest_1.describe)('ComposeRequestSchema', () => {
    (0, vitest_1.it)('parses a valid compose request', () => {
        const req = {
            apiVersion: 'ark/v1',
            kind: 'ComposeRequest',
            output: {
                id: '@ark/cli-xhs-scheduler',
                displayName: 'Xiaohongshu Scheduler',
                targetDirectory: 'packages/cli-xhs-scheduler',
            },
            parents: [{ id: '@ark/cli-xhs' }, { id: '@ark/cli-content' }],
            intent: 'Schedule AI-generated posts for Xiaohongshu.',
        };
        (0, vitest_1.expect)(schemas_js_1.ComposeRequestSchema.safeParse(req).success).toBe(true);
    });
});
(0, vitest_1.describe)('WiringPlanSchema — lifecycle and topology', () => {
    const basePlan = {
        apiVersion: 'ark/v1',
        kind: 'WiringPlan',
        pipeline: { topology: 'sequential' },
        steps: [],
    };
    (0, vitest_1.it)('accepts topology: sequential with lifecycle: finite (default)', () => {
        const result = schemas_js_1.WiringPlanSchema.safeParse(basePlan);
        (0, vitest_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, vitest_1.expect)(result.data.pipeline.lifecycle).toBe('finite');
        }
    });
    (0, vitest_1.it)('accepts deprecated mode field', () => {
        const plan = { ...basePlan, pipeline: { mode: 'sequential' } };
        const result = schemas_js_1.WiringPlanSchema.safeParse(plan);
        (0, vitest_1.expect)(result.success).toBe(true);
    });
    (0, vitest_1.it)('rejects plan with neither topology nor mode', () => {
        const plan = { ...basePlan, pipeline: { lifecycle: 'finite' } };
        const result = schemas_js_1.WiringPlanSchema.safeParse(plan);
        (0, vitest_1.expect)(result.success).toBe(false);
    });
    (0, vitest_1.it)('accepts lifecycle: streaming with streaming config', () => {
        const plan = {
            ...basePlan,
            pipeline: { topology: 'sequential', lifecycle: 'streaming' },
            streaming: {
                until: '2026-12-31T00:00:00+00:00',
                stopOn: [{ signal: 'SIGINT' }, { signal: 'SIGTERM' }],
                restartOnFailure: true,
            },
        };
        const result = schemas_js_1.WiringPlanSchema.safeParse(plan);
        (0, vitest_1.expect)(result.success).toBe(true);
    });
    (0, vitest_1.it)('streaming config restartOnFailure defaults to false', () => {
        const plan = {
            ...basePlan,
            pipeline: { topology: 'sequential', lifecycle: 'streaming' },
            streaming: {},
        };
        const result = schemas_js_1.WiringPlanSchema.safeParse(plan);
        (0, vitest_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, vitest_1.expect)(result.data.streaming?.restartOnFailure).toBe(false);
        }
    });
    (0, vitest_1.it)('rejects streaming config when lifecycle is not streaming', () => {
        const plan = {
            ...basePlan,
            pipeline: { topology: 'sequential', lifecycle: 'finite' },
            streaming: { restartOnFailure: false },
        };
        const result = schemas_js_1.WiringPlanSchema.safeParse(plan);
        (0, vitest_1.expect)(result.success).toBe(false);
    });
    (0, vitest_1.it)('rejects streaming config when lifecycle is absent (defaults to finite)', () => {
        const plan = {
            ...basePlan,
            streaming: { restartOnFailure: false },
        };
        const result = schemas_js_1.WiringPlanSchema.safeParse(plan);
        (0, vitest_1.expect)(result.success).toBe(false);
    });
    (0, vitest_1.it)('accepts lifecycle: streaming without streaming config block', () => {
        const plan = {
            ...basePlan,
            pipeline: { topology: 'sequential', lifecycle: 'streaming' },
        };
        const result = schemas_js_1.WiringPlanSchema.safeParse(plan);
        (0, vitest_1.expect)(result.success).toBe(true);
    });
});
//# sourceMappingURL=schemas.test.js.map