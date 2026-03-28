import { execSync } from 'node:child_process'
import type { XhsInput, XhsOutput } from './types.js'

interface BuildCommandsOptions {
  sessionPath: string
  input: XhsInput
}

export function buildAgentBrowserCommands(options: BuildCommandsOptions): string[] {
  const { sessionPath, input } = options
  const tagsText = input.tags.map(t => `#${t}`).join(' ')
  const fullBody = `${input.body}\n\n${tagsText}`

  return [
    `agent-browser load-session "${sessionPath}"`,
    `agent-browser open "https://www.xiaohongshu.com/publish/publish"`,
    `agent-browser wait --load networkidle`,
    `agent-browser snapshot -i`,
    `agent-browser fill @title "${input.title.replace(/"/g, '\\"')}"`,
    `agent-browser fill @content "${fullBody.replace(/"/g, '\\"')}"`,
    `agent-browser click @publish-btn`,
    `agent-browser wait --load networkidle`,
    `agent-browser snapshot`,
  ]
}

export async function postToXhs(
  input: XhsInput,
  sessionPath: string
): Promise<XhsOutput> {
  const commands = buildAgentBrowserCommands({ sessionPath, input })

  for (const cmd of commands.slice(0, -1)) {
    execSync(cmd, { stdio: 'inherit' })
  }

  const snapshotOutput = execSync(commands[commands.length - 1]!, {
    encoding: 'utf8',
  })

  const urlMatch = /url:\s*(https?:\/\/[^\s]+)/i.exec(snapshotOutput)
  const postUrl = urlMatch?.[1] ?? 'https://www.xiaohongshu.com'

  return {
    postUrl,
    publishedAt: new Date().toISOString(),
  }
}
