#!/usr/bin/env node
import { runComposedCli } from '@ark/runtime'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

await runComposedCli({
  packageDir: join(__dirname, '..'),
  composedCliId: '@ark/cli-weather-report',
  monorepoRoot: join(__dirname, '..', '..', '..'),
})
