import { describe, it, expect } from 'vitest';
import { buildAgentBrowserCommands } from '../post-x.js';
describe('buildAgentBrowserCommands for Twitter/X', () => {
    it('returns commands with session load and tweet fill', () => {
        const commands = buildAgentBrowserCommands({
            sessionPath: '/sessions/x.json',
            input: {
                body: 'Autumn skincare tips: keep it simple',
                tags: ['skincare', 'autumn'],
            },
        });
        expect(commands[0]).toContain('--state');
        expect(commands[0]).toContain('/sessions/x.json');
        expect(commands.some(c => c.includes('x.com'))).toBe(true);
        expect(commands.some(c => c.includes('Autumn skincare'))).toBe(true);
    });
    it('appends hashtags to tweet body', () => {
        const commands = buildAgentBrowserCommands({
            sessionPath: '/sessions/x.json',
            input: { body: 'hello world', tags: ['ai', 'tech'] },
        });
        const fillCommands = commands.filter(c => c.includes('fill'));
        const fullText = fillCommands.join(' ');
        expect(fullText).toContain('#ai');
        expect(fullText).toContain('#tech');
    });
});
//# sourceMappingURL=post-x.test.js.map