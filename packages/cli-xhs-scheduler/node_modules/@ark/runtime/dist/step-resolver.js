import { StepExecutionError } from '@ark/core';
import { humanReview, log, conditional, parallelMap, branch } from './builtin-steps.js';
const BUILTIN_MAP = {
    'builtin/human-review': humanReview,
    'builtin/log': (inputs) => log(inputs),
    'builtin/conditional': (inputs) => conditional(inputs),
    'builtin/branch': (inputs) => branch(inputs),
};
function parseTimeout(t) {
    const match = t.match(/^(\d+)([sm])$/);
    if (!match)
        throw new Error(`Invalid timeout format: ${t}`);
    const n = match[1];
    const unit = match[2];
    return parseInt(n, 10) * (unit === 'm' ? 60000 : 1000);
}
function withTimeout(executor, timeoutMs, outerSignal) {
    return async (inputs, ctx) => {
        const ctrl = new AbortController();
        const forwardAbort = () => ctrl.abort();
        outerSignal?.addEventListener('abort', forwardAbort, { once: true });
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            return await Promise.race([
                executor(inputs, ctx),
                new Promise((_, reject) => {
                    ctrl.signal.addEventListener('abort', () => reject(new Error('Step timed out')), { once: true });
                }),
            ]);
        }
        finally {
            clearTimeout(timer);
            outerSignal?.removeEventListener('abort', forwardAbort);
        }
    };
}
export class StepResolver {
    childRunner;
    monorepoRoot;
    constructor(childRunner, monorepoRoot) {
        this.childRunner = childRunner;
        this.monorepoRoot = monorepoRoot;
    }
    resolve(step, dryRun, parallelBehavior = 'failFast', signal) {
        const executor = this.buildExecutor(step, dryRun, parallelBehavior);
        if (step.timeout) {
            const timeoutMs = parseTimeout(step.timeout);
            return withTimeout(executor, timeoutMs, signal);
        }
        return executor;
    }
    buildExecutor(step, dryRun, parallelBehavior) {
        // builtin/parallel-map requires ChildCliRunner access
        if (step.uses === 'builtin/parallel-map') {
            const runner = this.childRunner;
            const monorepoRoot = this.monorepoRoot;
            return async (inputs, ctx) => {
                const runChild = (packageId, command, childInputs, childSignal) => runner
                    .run({
                    packageId,
                    command,
                    inputs: childInputs,
                    monorepoRoot,
                    dryRun: dryRun || ctx.dryRun,
                    signal: childSignal,
                })
                    .then(r => r.output);
                return parallelMap(inputs, ctx, runChild, parallelBehavior);
            };
        }
        // Other built-in steps
        const builtin = BUILTIN_MAP[step.uses];
        if (builtin)
            return builtin;
        // External package step — delegate to ChildCliRunner
        const { uses: packageId, command, id: stepId } = step;
        const runner = this.childRunner;
        return async (inputs, ctx) => {
            const result = await runner.run({
                packageId,
                command,
                inputs,
                monorepoRoot: this.monorepoRoot,
                dryRun: dryRun || ctx.dryRun,
                stepId,
            });
            return { output: result.output };
        };
    }
    isBuiltin(uses) {
        return uses in BUILTIN_MAP || uses === 'builtin/parallel-map';
    }
    assertKnown(step) {
        if (!this.isBuiltin(step.uses) && !step.uses.startsWith('@')) {
            throw new StepExecutionError(`Unknown step uses value: "${step.uses}". Expected a builtin/* or @scope/package.`, step.id);
        }
    }
}
//# sourceMappingURL=step-resolver.js.map