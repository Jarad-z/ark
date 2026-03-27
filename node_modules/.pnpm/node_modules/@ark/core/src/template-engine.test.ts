import { describe, it, expect } from 'vitest'
import { interpolate, resolveInputs, applyBindings } from './template-engine.js'

describe('interpolate', () => {
  const ctx = {
    mode: 'manual',
    flags: { topic: '秋季护肤', language: 'zh-CN' },
    bindings: { generatedPost: { title: '标题', body: '正文' } },
  }

  it('resolves a simple dot path', () => {
    expect(interpolate('{{ flags.topic }}', ctx)).toBe('秋季护肤')
  })

  it('resolves ctx. prefix paths', () => {
    expect(interpolate('{{ ctx.flags.topic }}', ctx)).toBe('秋季护肤')
  })

  it('returns the typed value for single expressions', () => {
    expect(interpolate('{{ flags.language }}', ctx)).toBe('zh-CN')
  })

  it('handles default pipe with existing value', () => {
    expect(interpolate("{{ flags.language | default: 'en' }}", ctx)).toBe('zh-CN')
  })

  it('handles default pipe with missing value', () => {
    expect(interpolate("{{ flags.tone | default: 'warm-casual' }}", ctx)).toBe('warm-casual')
  })

  it('handles equality ternary (true branch)', () => {
    expect(
      interpolate("{{ ctx.mode == 'manual' ? ctx.bindings.generatedPost : ctx.flags.topic }}", ctx)
    ).toEqual({ title: '标题', body: '正文' })
  })

  it('handles equality ternary (false branch)', () => {
    const autoCtx = { ...ctx, mode: 'auto' }
    expect(
      interpolate("{{ ctx.mode == 'manual' ? ctx.bindings.generatedPost : ctx.flags.topic }}", autoCtx)
    ).toBe('秋季护肤')
  })

  it('replaces multiple expressions in a string', () => {
    expect(interpolate('Hello {{ flags.topic }} in {{ flags.language }}', ctx)).toBe(
      'Hello 秋季护肤 in zh-CN'
    )
  })

  it('returns empty string for undefined paths in multi-expression strings', () => {
    expect(interpolate('prefix-{{ flags.missing }}-suffix', ctx)).toBe('prefix--suffix')
  })
})

describe('resolveInputs', () => {
  it('resolves string values as templates, passes non-strings through', () => {
    const ctx = { flags: { topic: '护肤' } }
    const inputs = { topic: '{{ flags.topic }}', count: 3 }
    expect(resolveInputs(inputs, ctx)).toEqual({ topic: '护肤', count: 3 })
  })
})

describe('applyBindings', () => {
  it('maps step output keys to context bindings', () => {
    const ctx: Record<string, unknown> = { bindings: {} }
    applyBindings({ generatedPost: 'post' }, { post: { title: '标题' } }, ctx)
    expect((ctx['bindings'] as Record<string, unknown>)['generatedPost']).toEqual({ title: '标题' })
  })

  it('throws PortBindingError when output key is missing', () => {
    const ctx: Record<string, unknown> = { bindings: {} }
    expect(() =>
      applyBindings({ generatedPost: 'post' }, { result: 'something' }, ctx)
    ).toThrow('Output binding failed')
  })
})
