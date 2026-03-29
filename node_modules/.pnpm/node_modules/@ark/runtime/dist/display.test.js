import { describe, it, expect, beforeEach } from 'vitest';
import { Display } from './display.js';
describe('Display structured log (non-TTY)', () => {
    let lines;
    let display;
    beforeEach(() => {
        lines = [];
        display = new Display({ isTTY: false, write: (line) => lines.push(line) });
    });
    it('emits pipeline start', () => {
        display.pipelineStart({ runId: 'abc', mode: 'dag', stepCount: 3 });
        expect(lines[0]).toContain('[ark][pipeline] start');
        expect(lines[0]).toContain('runId=abc');
        expect(lines[0]).toContain('mode=dag');
    });
    it('emits step start with deps', () => {
        display.stepStart('fetch', '@ark/cli-weather', ['a', 'b']);
        expect(lines[0]).toContain('[step:fetch] start');
        expect(lines[0]).toContain('uses=@ark/cli-weather');
        expect(lines[0]).toContain('deps=[a,b]');
    });
    it('emits step done with elapsed', () => {
        display.stepDone('fetch', 1200);
        expect(lines[0]).toContain('[step:fetch] done');
        expect(lines[0]).toContain('elapsed=1.2s');
    });
    it('emits step failed', () => {
        display.stepFailed('fetch', new Error('timeout'), 1200);
        expect(lines[0]).toContain('[step:fetch] failed');
        expect(lines[0]).toContain('timeout');
    });
    it('emits pipeline done with timing summary', () => {
        display.pipelineDone(15200, [
            { id: 'fetch', elapsedMs: 8100 },
            { id: 'generate', elapsedMs: 4100 },
        ], 12200);
        expect(lines.some(l => l.includes('fetch'))).toBe(true);
        expect(lines.some(l => l.includes('15.2s'))).toBe(true);
    });
    it('emits lineage step', () => {
        display.lineageStep('fetch', '@ark/cli-wttr-base', 'done', 300);
        expect(lines[0]).toContain('[step:fetch][lineage:@ark/cli-wttr-base] done');
    });
});
//# sourceMappingURL=display.test.js.map