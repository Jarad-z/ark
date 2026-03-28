import type { CliDescriptor, ComposeRequest } from '@ark/core';
import type { PlannerSessionResult } from './ai-planner-session.js';
export interface LineageData {
    kind: 'composed';
    createdAt: string;
    parents: Array<{
        id: string;
        version: string;
        descriptorHash: string;
    }>;
    aiPrompt: string;
    aiProposal: string;
    approvedWiringRef: string;
    humanEdits: string | undefined;
    usedAsParentIn: string[];
}
export declare function buildLineage(request: ComposeRequest, descriptors: Map<string, CliDescriptor>, plannerResult: PlannerSessionResult, humanEdits: string | undefined): LineageData;
//# sourceMappingURL=lineage-writer.d.ts.map