import { describe, it, expect } from 'vitest';
import { buildAgentBrowserCommands } from '../post-xhs.js';
describe('buildAgentBrowserCommands', () => {
    it('returns commands with session load and form fill', () => {
        const commands = buildAgentBrowserCommands({
            sessionPath: '/sessions/xhs.json',
            input: {
                title: '秋季护肤攻略',
                body: '秋天来了，皮肤容易干燥...',
                tags: ['护肤', '秋季'],
            },
        });
        expect(commands[0]).toContain('load-session');
        expect(commands[0]).toContain('/sessions/xhs.json');
        expect(commands.some(c => c.includes('open'))).toBe(true);
        expect(commands.some(c => c.includes('秋季护肤攻略'))).toBe(true);
        expect(commands.some(c => c.includes('秋天来了'))).toBe(true);
    });
    it('formats tags as hashtags in body', () => {
        const commands = buildAgentBrowserCommands({
            sessionPath: '/sessions/xhs.json',
            input: {
                title: 'title',
                body: 'body text',
                tags: ['tag1', 'tag2'],
            },
        });
        const fillCommands = commands.filter(c => c.includes('fill'));
        const fullText = fillCommands.join(' ');
        expect(fullText).toContain('#tag1');
        expect(fullText).toContain('#tag2');
    });
});
//# sourceMappingURL=post-xhs.test.js.map