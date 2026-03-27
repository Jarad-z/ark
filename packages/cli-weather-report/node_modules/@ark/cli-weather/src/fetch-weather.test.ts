import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWeather } from './fetch-weather.js'

const mockResponse = {
  current_condition: [
    {
      temp_C: '22',
      FeelsLikeC: '20',
      humidity: '65',
      windspeedKmph: '15',
      weatherDesc: [{ value: 'Partly Cloudy' }],
      uvIndex: '4',
      visibility: '10',
    },
  ],
  nearest_area: [
    {
      areaName: [{ value: 'Beijing' }],
      country: [{ value: 'China' }],
    },
  ],
}

describe('fetchWeather', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns structured weather data', async () => {
    const data = await fetchWeather('Beijing')
    expect(data.city).toBe('Beijing, China')
    expect(data.tempC).toBe(22)
    expect(data.humidity).toBe(65)
    expect(data.description).toBe('Partly Cloudy')
    expect(data.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404 })
    )
    await expect(fetchWeather('UnknownCity')).rejects.toThrow('404')
  })

  it('calls wttr.in with encoded city name', async () => {
    await fetchWeather('New York')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('New%20York'),
      expect.any(Object)
    )
  })
})
