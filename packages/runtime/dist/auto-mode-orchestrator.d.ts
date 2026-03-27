import type { WiringPlan, PipelineContext } from '@ark/core';
import type { AiBridge } from '@ark/ai-bridge';
/**
 * In --auto mode, fires an AI decision call before the configured step
 * and injects the returned bindings into the pipeline context flags.
 */
export declare class AutoModeOrchestrator {
    private bridge;
    constructor(bridge: AiBridge);
    /**
     * Returns true if the auto decision step should fire before the given stepId.
     */
    shouldFireBefore(plan: WiringPlan, stepId: string): boolean;
    runDecision(plan: WiringPlan, ctx: PipelineContext): Promise<void>;
}
//# sourceMappingURL=auto-mode-orchestrator.d.ts.map