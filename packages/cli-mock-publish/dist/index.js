#!/usr/bin/env node
// Mock publish CLI — pretends to post to a platform
const payload = process.env.ARK_INPUT_PAYLOAD
  ? JSON.parse(process.env.ARK_INPUT_PAYLOAD)
  : {}

const title = payload.title ?? '(no title)'
const body = payload.body ?? payload.content ?? '(no body)'
const postId = Math.random().toString(36).slice(2, 10)
const postUrl = `https://mock-platform.example.com/post/${postId}`

process.stderr.write(`[mock-publish] 发布成功: "${title.slice(0, 40)}"\n`)
process.stdout.write('ARK_OUTPUT:' + JSON.stringify({ postId, postUrl, title }) + '\n')
process.exit(0)
