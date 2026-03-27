"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const template_engine_js_1 = require("./template-engine.js");
(0, vitest_1.describe)('interpolate', () => {
    const ctx = {
        mode: 'manual',
        flags: { topic: '秋季护肤', language: 'zh-CN' },
        bindings: { generatedPost: { title: '标题', body: '正文' } },
    };
    (0, vitest_1.it)('resolves a simple dot path', () => {
        (0, vitest_1.expect)((0, template_engine_js_1.interpolate)('{{ flags.topic }}', ctx)).toBe('秋季护肤');
    });
    (0, vitest_1.it)('resolves ctx. prefix paths', () => {
        (0, vitest_1.expect)((0, template_engine_js_1.interpolate)('{{ ctx.flags.topic }}', ctx)).toBe('秋季护肤');
    });
    (0, vitest_1.it)('returns the typed value for single expressions', () => {
        (0, vitest_1.expect)((0, template_engine_js_1.interpolate)('{{ flags.language }}', ctx)).toBe('zh-CN');
    });
    (0, vitest_1.it)('handles default pipe with existing value', () => {
        (0, vitest_1.expect)((0, template_engine_js_1.interpolate)("{{ flags.language | default: 'en' }}", ctx)).toBe('zh-CN');
    });
    (0, vitest_1.it)('handles default pipe with missing value', () => {
        (0, vitest_1.expect)((0, template_engine_js_1.interpolate)("{{ flags.tone | default: 'warm-casual' }}", ctx)).toBe('warm-casual');
    });
    (0, vitest_1.it)('handles equality ternary (true branch)', () => {
        (0, vitest_1.expect)((0, template_engine_js_1.interpolate)("{{ ctx.mode == 'manual' ? ctx.bindings.generatedPost : ctx.flags.topic }}", ctx)).toEqual({ title: '标题', body: '正文' });
    });
    (0, vitest_1.it)('handles equality ternary (false branch)', () => {
        const autoCtx = { ...ctx, mode: 'auto' };
        (0, vitest_1.expect)((0, template_engine_js_1.interpolate)("{{ ctx.mode == 'manual' ? ctx.bindings.generatedPost : ctx.flags.topic }}", autoCtx)).toBe('秋季护肤');
    });
    (0, vitest_1.it)('replaces multiple expressions in a string', () => {
        (0, vitest_1.expect)((0, template_engine_js_1.interpolate)('Hello {{ flags.topic }} in {{ flags.language }}', ctx)).toBe('Hello 秋季护肤 in zh-CN');
    });
    (0, vitest_1.it)('returns empty string for undefined paths in multi-expression strings', () => {
        (0, vitest_1.expect)((0, template_engine_js_1.interpolate)('prefix-{{ flags.missing }}-suffix', ctx)).toBe('prefix--suffix');
    });
});
(0, vitest_1.describe)('resolveInputs', () => {
    (0, vitest_1.it)('resolves string values as templates, passes non-strings through', () => {
        const ctx = { flags: { topic: '护肤' } };
        const inputs = { topic: '{{ flags.topic }}', count: 3 };
        (0, vitest_1.expect)((0, template_engine_js_1.resolveInputs)(inputs, ctx)).toEqual({ topic: '护肤', count: 3 });
    });
});
(0, vitest_1.describe)('applyBindings', () => {
    (0, vitest_1.it)('maps step output keys to context bindings', () => {
        const ctx = { bindings: {} };
        (0, template_engine_js_1.applyBindings)({ generatedPost: 'post' }, { post: { title: '标题' } }, ctx);
        (0, vitest_1.expect)(ctx['bindings']['generatedPost']).toEqual({ title: '标题' });
    });
    (0, vitest_1.it)('throws PortBindingError when output key is missing', () => {
        const ctx = { bindings: {} };
        (0, vitest_1.expect)(() => (0, template_engine_js_1.applyBindings)({ generatedPost: 'post' }, { result: 'something' }, ctx)).toThrow('Output binding failed');
    });
});
//# sourceMappingURL=template-engine.test.js.map