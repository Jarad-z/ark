import type { WiringStep } from '@ark/core';
/**
 * Build a dependency map: stepId → [stepIds it depends on]
 * Infers deps from ctx.bindings.* references in inputs,
 * merged with explicit dependsOn declarations.
 */
export declare function buildDag(steps: WiringStep[]): Map<string, string[]>;
/**
 * Topological sort of step IDs.
 * Throws if a cycle is detected.
 */
export declare function topoSort(dag: Map<string, string[]>): string[];
//# sourceMappingURL=dag.d.ts.map