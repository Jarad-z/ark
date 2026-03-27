export interface WeatherData {
  city: string
  tempC: number
  feelsLikeC: number
  humidity: number
  windKmph: number
  description: string
  uvIndex: number
  visibility: number
  fetchedAt: string
}

interface WttrResponse {
  current_condition: Array<{
    temp_C: string
    FeelsLikeC: string
    humidity: string
    windspeedKmph: string
    weatherDesc: Array<{ value: string }>
    uvIndex: string
    visibility: string
  }>
  nearest_area: Array<{
    areaName: Array<{ value: string }>
    country: Array<{ value: string }>
  }>
}

export async function fetchWeather(city: string): Promise<WeatherData> {
  const encoded = encodeURIComponent(city)
  const url = `https://wttr.in/${encoded}?format=j1`

  const response = await fetch(url, {
    headers: { 'User-Agent': 'ark-cli-weather/0.1.0' },
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new Error(`wttr.in returned ${response.status} for city "${city}"`)
  }

  const data = (await response.json()) as WttrResponse

  const current = data.current_condition[0]
  const area = data.nearest_area[0]

  if (!current || !area) {
    throw new Error(`Unexpected response structure from wttr.in for city "${city}"`)
  }

  const resolvedCity = [
    area.areaName[0]?.value,
    area.country[0]?.value,
  ]
    .filter(Boolean)
    .join(', ')

  return {
    city: resolvedCity || city,
    tempC: Number(current.temp_C),
    feelsLikeC: Number(current.FeelsLikeC),
    humidity: Number(current.humidity),
    windKmph: Number(current.windspeedKmph),
    description: current.weatherDesc[0]?.value ?? 'Unknown',
    uvIndex: Number(current.uvIndex),
    visibility: Number(current.visibility),
    fetchedAt: new Date().toISOString(),
  }
}
