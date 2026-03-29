#!/usr/bin/env node
// Mock price checker — emits a stream of prices that slowly decrease
// Emits one price every 2 seconds: 350 → 280 → 210 → 140 → 90 → 60
const payload = process.env.ARK_INPUT_PAYLOAD
  ? JSON.parse(process.env.ARK_INPUT_PAYLOAD)
  : {}

const productId = payload.productId ?? 'ITEM-001'
const prices = [350, 280, 210, 140, 90, 60]

for (const price of prices) {
  process.stdout.write(
    'ARK_OUTPUT:' + JSON.stringify({ productId, price, currency: 'CNY' }) + '\n'
  )
  // flush stdout and wait 2 seconds between each price tick
  await new Promise(r => setTimeout(r, 2000))
}

process.exit(0)
