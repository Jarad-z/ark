/**
 * Build a dependency map: stepId → [stepIds it depends on]
 * Infers deps from ctx.bindings.* references in inputs,
 * merged with explicit dependsOn declarations.
 */
export function buildDag(steps) {
    // Map: bindingName → stepId that produces it
    const bindingProducer = new Map();
    for (const step of steps) {
        for (const key of Object.keys(step.outputs?.bind ?? {})) {
            bindingProducer.set(key, step.id);
        }
    }
    const dag = new Map();
    for (const step of steps) {
        const deps = new Set(step.dependsOn ?? []);
        // Scan all input values for {{ ctx.bindings.<name> }} references
        for (const val of Object.values(step.inputs ?? {})) {
            if (typeof val !== 'string')
                continue;
            const matches = val.matchAll(/\{\{\s*ctx\.bindings\.(\w+)/g);
            for (const match of matches) {
                const bindingName = match[1];
                if (!bindingName)
                    continue;
                const producer = bindingProducer.get(bindingName);
                if (producer && producer !== step.id) {
                    deps.add(producer);
                }
            }
        }
        dag.set(step.id, [...deps]);
    }
    return dag;
}
/**
 * Topological sort of step IDs.
 * Throws if a cycle is detected.
 */
export function topoSort(dag) {
    const visited = new Set();
    const visiting = new Set();
    const result = [];
    function visit(id) {
        if (visited.has(id))
            return;
        if (visiting.has(id)) {
            throw new Error(`Circular dependency detected: step "${id}" is part of a cycle`);
        }
        visiting.add(id);
        for (const dep of dag.get(id) ?? []) {
            visit(dep);
        }
        visiting.delete(id);
        visited.add(id);
        result.push(id);
    }
    for (const id of dag.keys()) {
        visit(id);
    }
    return result;
}
//# sourceMappingURL=dag.js.map