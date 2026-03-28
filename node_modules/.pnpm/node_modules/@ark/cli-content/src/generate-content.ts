import type { AiBridge } from '@ark/ai-bridge'
import type { ContentInput, ContentOutput } from './types.js'

export async function generateContent(
  input: ContentInput,
  platform: 'xhs' | 'x',
  bridge: AiBridge
): Promise<ContentOutput> {
  const prompt = platform === 'xhs'
    ? buildXhsPrompt(input)
    : buildXPrompt(input)

  const result = await bridge.generateContent(prompt)

  let parsed: unknown
  try {
    const cleaned = result.content
      .replace(/^```json\n?/, '')
      .replace(/\n?```$/, '')
      .trim()
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Failed to parse AI content response: ${result.content}`)
  }

  const output = parsed as ContentOutput
  return {
    title: output.title ?? '',
    body: output.body,
    tags: Array.isArray(output.tags) ? output.tags : [],
  }
}

function buildXhsPrompt(input: ContentInput): string {
  const style = input.style ?? 'casual'
  const lang = input.lang ?? 'zh-CN'
  return `You are a Xiaohongshu (小红书) content creator. Write an engaging post about: "${input.topic}".

Style: ${style}
Language: ${lang}

Requirements:
- Title: catchy, 10-20 characters
- Body: 100-200 characters, conversational tone, include emojis
- Tags: 3-5 relevant hashtags (without # symbol)

Respond ONLY with a JSON object in this exact format:
{"title": "...", "body": "...", "tags": ["tag1", "tag2"]}`
}

function buildXPrompt(input: ContentInput): string {
  const style = input.style ?? 'casual'
  const lang = input.lang ?? 'en'
  return `You are a Twitter/X content creator. Write a tweet about: "${input.topic}".

Style: ${style}
Language: ${lang}

Requirements:
- Body: under 280 characters, punchy and engaging
- Tags: 2-3 relevant hashtags (without # symbol)
- No title needed for Twitter

Respond ONLY with a JSON object in this exact format:
{"title": "", "body": "...", "tags": ["tag1", "tag2"]}`
}
