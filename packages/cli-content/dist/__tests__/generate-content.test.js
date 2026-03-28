import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateContent } from '../generate-content.js';
const mockBridge = {
    planComposition: vi.fn(),
    makeRuntimeDecision: vi.fn(),
    generateContent: vi.fn(),
};
beforeEach(() => {
    vi.clearAllMocks();
});
describe('generateContent xhs', () => {
    it('returns title, body, tags from AI response', async () => {
        vi.mocked(mockBridge.generateContent).mockResolvedValue({
            content: JSON.stringify({
                title: '秋季护肤攻略',
                body: '秋天来了，皮肤容易干燥...',
                tags: ['护肤', '秋季', '美妆'],
            }),
        });
        const result = await generateContent({ topic: '秋季护肤', style: 'casual', lang: 'zh-CN' }, 'xhs', mockBridge);
        expect(result).toEqual({
            title: '秋季护肤攻略',
            body: '秋天来了，皮肤容易干燥...',
            tags: ['护肤', '秋季', '美妆'],
        });
    });
});
describe('generateContent x', () => {
    it('returns body and tags for Twitter', async () => {
        vi.mocked(mockBridge.generateContent).mockResolvedValue({
            content: JSON.stringify({
                title: '',
                body: 'Autumn skincare tips: keep it simple...',
                tags: ['skincare', 'autumn'],
            }),
        });
        const result = await generateContent({ topic: 'autumn skincare', style: 'professional', lang: 'en' }, 'x', mockBridge);
        expect(result.body).toBe('Autumn skincare tips: keep it simple...');
        expect(result.tags).toEqual(['skincare', 'autumn']);
    });
});
describe('generateContent error handling', () => {
    it('throws if AI returns invalid JSON', async () => {
        vi.mocked(mockBridge.generateContent).mockResolvedValue({
            content: 'not json at all',
        });
        await expect(generateContent({ topic: 'test' }, 'xhs', mockBridge)).rejects.toThrow('Failed to parse AI content response');
    });
});
//# sourceMappingURL=generate-content.test.js.map