import { describe, it, expect } from 'vitest';
import { buildDag, topoSort } from './dag.js';
const step = (id, inputs = {}, dependsOn) => ({ id, uses: '@ark/cli-test', inputs, dependsOn });
describe('buildDag', () => {
    it('infers dependency from ctx.bindings reference', () => {
        const stepsWithBindings = [
            { ...step('a'), outputs: { bind: { aOut: '.' } } },
            step('b', { data: '{{ ctx.bindings.aOut }}' }),
        ];
        const dag = buildDag(stepsWithBindings);
        expect(dag.get('b')).toContain('a');
    });
    it('merges explicit dependsOn with inferred deps', () => {
        const steps = [
            step('a'),
            step('b'),
            step('c', {}, ['a']),
        ];
        const dag = buildDag(steps);
        expect(dag.get('c')).toContain('a');
        expect(dag.get('b')).toEqual([]);
    });
    it('steps with no deps have empty array', () => {
        const steps = [step('a'), step('b')];
        const dag = buildDag(steps);
        expect(dag.get('a')).toEqual([]);
        expect(dag.get('b')).toEqual([]);
    });
});
describe('topoSort', () => {
    it('sorts so dependencies come before dependents', () => {
        const dag = new Map([
            ['a', []],
            ['b', ['a']],
            ['c', ['a', 'b']],
        ]);
        const order = topoSort(dag);
        expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
        expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
    });
    it('throws on circular dependency', () => {
        const dag = new Map([
            ['a', ['b']],
            ['b', ['a']],
        ]);
        expect(() => topoSort(dag)).toThrow('Circular dependency detected');
    });
    it('handles independent steps in any order', () => {
        const dag = new Map([['a', []], ['b', []], ['c', []]]);
        const order = topoSort(dag);
        expect(order).toHaveLength(3);
        expect(order).toContain('a');
    });
});
//# sourceMappingURL=dag.test.js.map