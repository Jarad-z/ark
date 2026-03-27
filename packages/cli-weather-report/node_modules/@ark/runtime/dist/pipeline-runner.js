import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as yaml from 'js-yaml';
import { randomUUID } from 'node:crypto';
import { WiringPlanSchema, ValidationError, StepExecutionError, resolveInputs, applyBindings, } from '@ark/core';
import { createAiBridge } from '@ark/ai-bridge';
import { ChildCliRunner } from './child-cli-runner.js';
import { StepResolver } from './step-resolver.js';
import { AutoModeOrchestrator } from './auto-mode-orchestrator.js';
/**
 * Loads a WiringPlan and executes its steps, managing context, bindings,
 * auto-mode AI decisions, error policy, and dry-run interception.
 */
export class PipelineRunner {
    options;
    plan;
    resolver;
    orchestrator;
    constructor(options) {
        this.options = options;
        this.plan = this.loadPlan(options.wiringPath);
        const childRunner = new ChildCliRunner();
        this.resolver = new StepResolver(childRunner, options.monorepoRoot);
    }
    async run(argv) {
        const { flags, dryRun, mode } = this.parseArgv(argv);
        const ctx = {
            mode,
            flags,
            stepOutputs: {},
            bindings: {},
            dryRun,
            meta: {
                composedCliId: this.options.composedCliId,
                runId: randomUUID(),
                startedAt: new Date().toISOString(),
            },
        };
        if (mode === 'auto') {
            const bridge = this.options.bridge ?? createAiBridge();
            this.orchestrator = new AutoModeOrchestrator(bridge);
        }
        process.stderr.write(`[ark:runtime] Starting pipeline "${this.options.composedCliId}" ` +
            `(mode=${mode}, dryRun=${dryRun}, runId=${ctx.meta.runId})\n`);
        const steps = this.plan.steps;
        for (const step of steps) {
            await this.executeStep(step, ctx);
        }
        process.stderr.write(`[ark:runtime] Pipeline completed successfully.\n`);
        return {
            success: true,
            stepOutputs: ctx.stepOutputs,
            bindings: ctx.bindings,
        };
    }
    async executeStep(step, ctx) {
        // Auto-mode: fire AI decision before this step if configured
        if (ctx.mode === 'auto' && this.orchestrator?.shouldFireBefore(this.plan, step.id)) {
            await this.orchestrator.runDecision(this.plan, ctx);
        }
        // Evaluate condition
        if (step.condition !== undefined) {
            const { interpolate } = await import('@ark/core');
            const condResult = interpolate(step.condition, ctx);
            if (!condResult) {
                process.stderr.write(`[ark:runtime] Step "${step.id}" skipped (condition false).\n`);
                return;
            }
        }
        process.stderr.write(`[ark:runtime] Running step "${step.id}" (uses=${step.uses})...\n`);
        // Resolve inputs against current context
        const resolvedInputs = resolveInputs(step.inputs, ctx);
        // Get executor and run
        const executor = this.resolver.resolve(step, ctx.dryRun);
        const result = await this.runWithRetry(step, executor, resolvedInputs, ctx);
        if (result.skipped) {
            process.stderr.write(`[ark:runtime] Step "${step.id}" skipped (builtin conditional).\n`);
            return;
        }
        // Store raw step output
        ;
        ctx.stepOutputs[step.id] = result.output;
        // Apply output bindings to ctx.bindings (skip in dry-run — output is empty)
        if (step.outputs?.bind && !ctx.dryRun) {
            applyBindings(step.outputs.bind, result.output, ctx);
        }
        process.stderr.write(`[ark:runtime] Step "${step.id}" completed.\n`);
    }
    async runWithRetry(step, executor, inputs, ctx) {
        const errorPolicy = this.plan.errorPolicy;
        const maxAttempts = errorPolicy?.retryPolicy?.maxAttempts ?? 1;
        const backoffMs = errorPolicy?.retryPolicy?.backoffMs ?? 1000;
        const onFailure = errorPolicy?.onStepFailure ?? 'abort';
        let lastError;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await executor(inputs, ctx);
            }
            catch (err) {
                lastError = err;
                if (onFailure === 'abort') {
                    throw new StepExecutionError(`Step "${step.id}" failed: ${String(err)}`, step.id, err);
                }
                if (onFailure === 'continue') {
                    process.stderr.write(`[ark:runtime] Step "${step.id}" failed (continuing): ${String(err)}\n`);
                    return { output: {} };
                }
                // retry
                if (attempt < maxAttempts) {
                    const delay = backoffMs * attempt;
                    process.stderr.write(`[ark:runtime] Step "${step.id}" failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms...\n`);
                    await sleep(delay);
                }
            }
        }
        throw new StepExecutionError(`Step "${step.id}" failed after ${maxAttempts} attempts: ${String(lastError)}`, step.id, lastError);
    }
    loadPlan(wiringPath) {
        const absPath = resolve(wiringPath);
        let raw;
        try {
            raw = yaml.load(readFileSync(absPath, 'utf8'));
        }
        catch (err) {
            throw new ValidationError(`Failed to read ark-wiring.yaml at ${absPath}: ${String(err)}`, []);
        }
        const result = WiringPlanSchema.safeParse(raw);
        if (!result.success) {
            const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
            throw new ValidationError('Invalid ark-wiring.yaml', issues);
        }
        return result.data;
    }
    parseArgv(argv) {
        const flags = {};
        let dryRun = false;
        let mode = 'manual';
        for (let i = 0; i < argv.length; i++) {
            const arg = argv[i];
            if (arg === '--auto') {
                mode = 'auto';
            }
            else if (arg === '--dry-run') {
                dryRun = true;
            }
            else if (arg.startsWith('--')) {
                const key = arg.slice(2);
                const next = argv[i + 1];
                if (next && !next.startsWith('--')) {
                    flags[key] = next;
                    i++;
                }
                else {
                    flags[key] = true;
                }
            }
        }
        return { flags, dryRun, mode };
    }
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
//# sourceMappingURL=pipeline-runner.js.map