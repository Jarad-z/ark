import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { saveReport } from './save-report.js';
describe('saveReport', () => {
    it('creates a markdown file in the output directory', () => {
        const dir = join(tmpdir(), `ark-report-test-${randomUUID()}`);
        const result = {
            city: 'Shanghai, China',
            report: '今天上海天气很好。',
            generatedAt: '2025-03-01T08:00:00.000Z',
        };
        const path = saveReport(result, dir);
        expect(existsSync(path)).toBe(true);
        expect(path).toContain('2025-03-01');
        expect(path).toContain('Shanghai');
        expect(path.endsWith('.md')).toBe(true);
        const content = readFileSync(path, 'utf8');
        expect(content).toContain('今天上海天气很好。');
        expect(content).toContain('Shanghai, China');
        rmSync(dir, { recursive: true });
    });
    it('creates the output directory if it does not exist', () => {
        const dir = join(tmpdir(), `ark-report-new-${randomUUID()}`, 'nested', 'dir');
        const result = {
            city: 'Guangzhou',
            report: '广州今天多云。',
            generatedAt: '2025-03-01T08:00:00.000Z',
        };
        const path = saveReport(result, dir);
        expect(existsSync(path)).toBe(true);
        rmSync(join(tmpdir(), `ark-report-new-${randomUUID().slice(0, 8)}`), {
            recursive: true,
            force: true,
        });
    });
});
//# sourceMappingURL=save-report.test.js.map