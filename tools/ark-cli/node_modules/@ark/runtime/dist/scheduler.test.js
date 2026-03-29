import { describe, it, expect } from 'vitest';
import { Scheduler } from './scheduler.js';
describe('Scheduler', () => {
    it('runs independent steps concurrently', async () => {
        const order = [];
        const delays = { a: 50, b: 10, c: 30 };
        const scheduler = new Scheduler({
            dag: new Map([['a', []], ['b', []], ['c', []]]),
            concurrency: Infinity,
            parallelBehavior: 'waitAll',
            runStep: async (id) => {
                await new Promise(r => setTimeout(r, delays[id]));
                order.push(id);
            },
        });
        await scheduler.run();
        expect(order).toEqual(['b', 'c', 'a']);
    });
    it('respects concurrency limit', async () => {
        let concurrent = 0;
        let maxConcurrent = 0;
        const scheduler = new Scheduler({
            dag: new Map([['a', []], ['b', []], ['c', []], ['d', []]]),
            concurrency: 2,
            parallelBehavior: 'waitAll',
            runStep: async () => {
                concurrent++;
                maxConcurrent = Math.max(maxConcurrent, concurrent);
                await new Promise(r => setTimeout(r, 20));
                concurrent--;
            },
        });
        await scheduler.run();
        expect(maxConcurrent).toBe(2);
    });
    it('runs dependent step only after its dependency completes', async () => {
        const order = [];
        const scheduler = new Scheduler({
            dag: new Map([['a', []], ['b', ['a']]]),
            concurrency: Infinity,
            parallelBehavior: 'failFast',
            runStep: async (id) => {
                await new Promise(r => setTimeout(r, 10));
                order.push(id);
            },
        });
        await scheduler.run();
        expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    });
    it('failFast: cancels running steps when one fails', async () => {
        const cancelled = [];
        const scheduler = new Scheduler({
            dag: new Map([['a', []], ['b', []]]),
            concurrency: Infinity,
            parallelBehavior: 'failFast',
            runStep: async (id, signal) => {
                if (id === 'a')
                    throw new Error('step a failed');
                await new Promise((_, reject) => {
                    signal.addEventListener('abort', () => {
                        cancelled.push(id);
                        reject(new Error('cancelled'));
                    });
                });
            },
        });
        await expect(scheduler.run()).rejects.toThrow('step a failed');
        expect(cancelled).toContain('b');
    });
    it('waitAll: runs all steps despite one failure', async () => {
        const completed = [];
        const scheduler = new Scheduler({
            dag: new Map([['a', []], ['b', []]]),
            concurrency: Infinity,
            parallelBehavior: 'waitAll',
            runStep: async (id) => {
                if (id === 'a')
                    throw new Error('step a failed');
                await new Promise(r => setTimeout(r, 10));
                completed.push(id);
            },
        });
        await expect(scheduler.run()).rejects.toThrow();
        expect(completed).toContain('b');
    });
});
//# sourceMappingURL=scheduler.test.js.map