#!/usr/bin/env node
import { readInputPayload, writeOutput } from '@ark/core'
import { createAiBridge } from '@ark/ai-bridge'
import { generateContent } from './generate-content.js'
import type { ContentInput } from './types.js'

const payload = readInputPayload<ContentInput>()

const args = process.argv.slice(2)

// argv[0] is the command: xhs | x
const command = args[0]
if (command !== 'xhs' && command !== 'x') {
  process.stderr.write(`[ark:cli-content] Error: command must be "xhs" or "x", got "${command}"\n`)
  process.exit(1)
}

function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag)
  return idx !== -1 ? args[idx + 1] : undefined
}

const topic = payload?.topic ?? getFlag('--topic')
if (!topic) {
  process.stderr.write('[ark:cli-content] Error: --topic is required\n')
  process.exit(1)
}

const style = payload?.style ?? getFlag('--style')
const lang = payload?.lang ?? getFlag('--lang')

try {
  const bridge = createAiBridge()
  const input: ContentInput = { topic }
  if (style) input.style = style
  if (lang) input.lang = lang
  const result = await generateContent(input, command, bridge)
  writeOutput(result)
  process.exit(0)
} catch (err) {
  process.stderr.write(`[ark:cli-content] Error: ${String(err)}\n`)
  process.exit(1)
}
