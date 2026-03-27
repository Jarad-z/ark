import type { AiBridge } from '@ark/ai-bridge'
import type { WeatherData } from './types.js'

export interface ReportResult {
  city: string
  report: string
  generatedAt: string
}

export async function generateReport(
  weather: WeatherData,
  style: string,
  bridge: AiBridge
): Promise<ReportResult> {
  const prompt = buildPrompt(weather, style)
  const result = await bridge.generateContent(prompt)

  return {
    city: weather.city,
    report: result.content.trim(),
    generatedAt: new Date().toISOString(),
  }
}

function buildPrompt(weather: WeatherData, style: string): string {
  return `You are a friendly weather reporter. Write a ${style} weather report in Chinese based on the following data.

City: ${weather.city}
Temperature: ${weather.tempC}°C (feels like ${weather.feelsLikeC}°C)
Humidity: ${weather.humidity}%
Wind: ${weather.windKmph} km/h
Condition: ${weather.description}
UV Index: ${weather.uvIndex}
Visibility: ${weather.visibility} km
Data time: ${weather.fetchedAt}

Requirements:
- Write in natural, conversational Chinese
- 3-5 sentences
- Include practical advice (e.g. bring an umbrella, wear sunscreen, dress warmly)
- Do not use bullet points, just flowing prose
- Style: ${style}`
}
