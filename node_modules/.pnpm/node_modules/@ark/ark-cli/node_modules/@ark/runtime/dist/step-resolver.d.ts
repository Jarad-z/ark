import type { WiringStep, PipelineContext } from '@ark/core';
import type { BuiltinStepResult } from './builtin-steps.js';
import type { ChildCliRunner } from './child-cli-runner.js';
export type StepExecutor = (inputs: Record<string, unknown>, ctx: PipelineContext) => Promise<BuiltinStepResult>;
export declare class StepResolver {
    private childRunner;
    private monorepoRoot;
    constructor(childRunner: ChildCliRunner, monorepoRoot: string);
    resolve(step: WiringStep, dryRun: boolean): StepExecutor;
    isBuiltin(uses: string): boolean;
    assertKnown(step: WiringStep): void;
}
//# sourceMappingURL=step-resolver.d.ts.map