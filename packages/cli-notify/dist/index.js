#!/usr/bin/env node
// Mock notify CLI — prints the alert message to stdout
const payload = process.env.ARK_INPUT_PAYLOAD
  ? JSON.parse(process.env.ARK_INPUT_PAYLOAD)
  : {}

const channel = payload.channel ?? 'console'
const message = payload.message ?? '(no message)'

process.stderr.write(`[notify:${channel}] ${message}\n`)
process.stdout.write('ARK_OUTPUT:' + JSON.stringify({ sent: true, channel, message }) + '\n')
process.exit(0)
