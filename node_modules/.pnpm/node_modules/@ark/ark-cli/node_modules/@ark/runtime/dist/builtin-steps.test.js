import { describe, it, expect, vi } from 'vitest';
import { parallelMap, branch } from './builtin-steps.js';
const mockCtx = { flags: {}, bindings: new Map(), mode: 'manual', dryRun: false };
describe('branch()', () => {
    it('returns the next step id for the first matching condition', async () => {
        const result = await branch({
            routes: [
                { condition: false, next: 'step-a' },
                { condition: true, next: 'step-b' },
            ],
        });
        expect(result.output).toEqual({ next: 'step-b' });
        expect(result.skipped).toBeUndefined();
    });
    it('returns default when no condition matches', async () => {
        const result = await branch({
            routes: [{ condition: false, next: 'step-a' }],
            default: 'step-fallback',
        });
        expect(result.output).toEqual({ next: 'step-fallback' });
    });
    it('returns { next: null } when no match and no default', async () => {
        const result = await branch({
            routes: [{ condition: false, next: 'step-a' }],
        });
        expect(result.output).toEqual({ next: null });
    });
    it('throws if routes is not an array', async () => {
        await expect(branch({ routes: 'bad' })).rejects.toThrow('branch: routes must be an array');
    });
});
describe('parallelMap', () => {
    it('runs each item and collects results in order', async () => {
        const runChild = vi.fn().mockImplementation(async (_pkg, _cmd, inputs) => ({
            city: inputs['city'],
        }));
        const result = await parallelMap({ items: ['london', 'paris'], step: '@ark/cli-weather', inputKey: 'city' }, mockCtx, runChild, 'failFast');
        expect(result.output['results']).toEqual([{ city: 'london' }, { city: 'paris' }]);
        expect(runChild).toHaveBeenCalledTimes(2);
    });
    it('throws if items is not an array', async () => {
        const runChild = vi.fn();
        await expect(parallelMap({ items: 'oops', step: '@ark/cli-weather' }, mockCtx, runChild, 'failFast')).rejects.toThrow('parallel-map: items must be an array');
    });
    it('throws if step is not a string', async () => {
        const runChild = vi.fn();
        await expect(parallelMap({ items: [], step: 42 }, mockCtx, runChild, 'failFast')).rejects.toThrow('parallel-map: step must be a string');
    });
    it('respects concurrency limit', async () => {
        let inFlight = 0;
        let maxInFlight = 0;
        const runChild = vi.fn().mockImplementation(async () => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise(r => setTimeout(r, 10));
            inFlight--;
            return {};
        });
        await parallelMap({ items: ['a', 'b', 'c', 'd'], step: '@ark/cli-weather', concurrency: 2 }, mockCtx, runChild, 'failFast');
        expect(maxInFlight).toBeLessThanOrEqual(2);
    });
    it('waitAll collects null for failed items', async () => {
        const runChild = vi.fn().mockImplementation(async (_pkg, _cmd, inputs) => {
            if (inputs['item'] === 'bad')
                throw new Error('bad item');
            return { ok: true };
        });
        const result = await parallelMap({ items: ['good', 'bad'], step: '@ark/cli-weather' }, mockCtx, runChild, 'waitAll');
        expect(result.output['results']).toEqual([{ ok: true }, null]);
    });
    it('failFast throws on first failure', async () => {
        const runChild = vi.fn().mockRejectedValue(new Error('fail'));
        await expect(parallelMap({ items: ['x', 'y'], step: '@ark/cli-weather' }, mockCtx, runChild, 'failFast')).rejects.toThrow();
    });
});
//# sourceMappingURL=builtin-steps.test.js.map