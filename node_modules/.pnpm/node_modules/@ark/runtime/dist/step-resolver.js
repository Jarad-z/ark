import { StepExecutionError } from '@ark/core';
import { humanReview, log, conditional } from './builtin-steps.js';
const BUILTIN_MAP = {
    'builtin/human-review': humanReview,
    'builtin/log': (inputs) => log(inputs),
    'builtin/conditional': (inputs) => conditional(inputs),
};
export class StepResolver {
    childRunner;
    monorepoRoot;
    constructor(childRunner, monorepoRoot) {
        this.childRunner = childRunner;
        this.monorepoRoot = monorepoRoot;
    }
    resolve(step, dryRun) {
        // Built-in step
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
        return uses in BUILTIN_MAP;
    }
    assertKnown(step) {
        if (!this.isBuiltin(step.uses) && !step.uses.startsWith('@')) {
            throw new StepExecutionError(`Unknown step uses value: "${step.uses}". Expected a builtin/* or @scope/package.`, step.id);
        }
    }
}
//# sourceMappingURL=step-resolver.js.map