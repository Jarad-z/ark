import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateReport } from './generate-report.js'
import type { WeatherData } from './types.js'
import type { AiBridge } from '@ark/ai-bridge'

const mockWeather: WeatherData = {
  city: 'Beijing, China',
  tempC: 22,
  feelsLikeC: 20,
  humidity: 65,
  windKmph: 15,
  description: 'Partly Cloudy',
  uvIndex: 4,
  visibility: 10,
  fetchedAt: '2025-03-01T08:00:00.000Z',
}

const mockBridge: AiBridge = {
  planComposition: vi.fn(),
  makeRuntimeDecision: vi.fn(),
  generateContent: vi.fn().mockResolvedValue({
    content: '今天北京天气晴朗，气温22度，体感舒适，适合外出。',
    usage: { inputTokens: 100, outputTokens: 30 },
  }),
}

describe('generateReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a report with city, text, and timestamp', async () => {
    const result = await generateReport(mockWeather, 'casual', mockBridge)

    expect(result.city).toBe('Beijing, China')
    expect(result.report).toBe('今天北京天气晴朗，气温22度，体感舒适，适合外出。')
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('passes style to bridge.generateContent prompt', async () => {
    await generateReport(mockWeather, 'humorous', mockBridge)
    const callArg = ((mockBridge.generateContent as ReturnType<typeof vi.fn>).mock.calls[0] as [string])[0]
    expect(callArg).toContain('humorous')
  })

  it('includes weather data in the prompt', async () => {
    await generateReport(mockWeather, 'casual', mockBridge)
    const callArg = ((mockBridge.generateContent as ReturnType<typeof vi.fn>).mock.calls[0] as [string])[0]
    expect(callArg).toContain('22')
    expect(callArg).toContain('Beijing')
  })
})
