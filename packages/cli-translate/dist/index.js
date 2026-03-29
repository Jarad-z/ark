#!/usr/bin/env node
// Mock translate CLI — translates English text to Chinese (fake)
const payload = process.env.ARK_INPUT_PAYLOAD
  ? JSON.parse(process.env.ARK_INPUT_PAYLOAD)
  : {}

const text = payload.text ?? 'hello'

// Simple mock translation dictionary
const dict = {
  'Hello world': '你好世界',
  'Good morning': '早上好',
  'How are you': '你好吗',
}
const translated = dict[text] ?? `[译] ${text}`

process.stdout.write(
  'ARK_OUTPUT:' +
    JSON.stringify({ original: text, title: text.slice(0, 20), translated }) +
    '\n'
)
process.exit(0)
