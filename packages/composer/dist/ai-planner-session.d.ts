import type { AiBridge, CompositionPlanResult } from '@ark/ai-bridge';
import type { CliDescriptor, ComposeRequest } from '@ark/core';
export interface PlannerSessionResult extends CompositionPlanResult {
    prompt: string;
}
export declare class AiPlannerSession {
    private bridge;
    private builder;
    constructor(bridge: AiBridge);
    run(request: ComposeRequest, descriptors: Map<string, CliDescriptor>): Promise<PlannerSessionResult>;
}
//# sourceMappingURL=ai-planner-session.d.ts.map