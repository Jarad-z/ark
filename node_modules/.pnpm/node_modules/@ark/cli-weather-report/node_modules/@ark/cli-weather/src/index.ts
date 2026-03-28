#!/usr/bin/env node
import { readInputPayload, writeOutput } from '@ark/core'
import { fetchWeather } from './fetch-weather.js'

interface WeatherInput {
  city?: string
}

// Support both pipeline (ARK_INPUT_PAYLOAD) and direct CLI invocation
const payload = readInputPayload<WeatherInput>()

// Argv fallback: node index.js fetch --city Beijing
const args = process.argv.slice(2)
const cityFlagIdx = args.indexOf('--city')
const cityFromArgv = cityFlagIdx !== -1 ? args[cityFlagIdx + 1] : undefined

const city = payload?.city ?? cityFromArgv ?? 'Beijing'

try {
  const weather = await fetchWeather(city)
  writeOutput(weather)
  process.exit(0)
} catch (err) {
  process.stderr.write(`[ark:cli-weather] Error: ${String(err)}\n`)
  process.exit(1)
}
