# Social Publisher CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@ark/cli-social-publisher` — a composed CLI with `post-xhs` and `post-x` commands that generate platform-native content via Claude and publish it to Xiaohongshu and Twitter/X using `agent-browser`.

**Architecture:** Four leaf CLIs (`cli-content`, `cli-xhs`, `cli-x`) are wired together by a composed CLI (`cli-social-publisher`) using the ark MultiCommandRunner pattern. Each command has its own wiring plan YAML in `wirings/`. Content generation uses `@ark/ai-bridge` → Claude. Browser automation calls the `agent-browser` CLI subprocess via `execSync`.

**Tech Stack:** TypeScript, Node.js ESM, `@ark/core` (readInputPayload/writeOutput), `@ark/ai-bridge` (generateContent), `agent-browser` CLI (global install), Vitest, pnpm workspaces.

---

## File Map

```
packages/cli-content/
  src/
    index.ts              # entry: reads payload, routes xhs|x command, calls generate-content.ts
    generate-content.ts   # buildXhsPrompt(), buildXPrompt(), generateContent()
    types.ts              # ContentInput, ContentOutput interfaces
  ark-descriptor.yaml
  tsconfig.json           # (already exists as skeleton — verify)
  package.json            # (already exists — add "type": "module", devDeps)
  src/__tests__/
    generate-content.test.ts

packages/cli-xhs/
  src/
    index.ts              # entry: reads payload, calls post-xhs.ts
    post-xhs.ts           # loadSession(), navigateToPublish(), fillForm(), submit()
    types.ts              # XhsInput, XhsOutput interfaces
  ark-descriptor.yaml
  tsconfig.json           # (already exists as skeleton — verify)
  package.json            # (already exists — remove playwright, add agent-browser dep)
  sessions/               # .gitignore'd
  src/__tests__/
    post-xhs.test.ts

packages/cli-x/           # NEW — does not exist
  src/
    index.ts              # entry: reads payload, calls post-x.ts
    post-x.ts             # loadSession(), navigateToCompose(), fillTweet(), submit()
    types.ts              # XInput, XOutput interfaces
  ark-descriptor.yaml
  tsconfig.json
  package.json
  sessions/               # .gitignore'd
  src/__tests__/
    post-x.test.ts

packages/cli-social-publisher/   # NEW — does not exist
  src/
    index.ts              # MultiCommandRunner entry
  wirings/
    post-xhs.yaml
    post-x.yaml
  ark-descriptor.yaml
  tsconfig.json
  package.json
```

---

## Task 1: Set up `cli-content` package skeleton

**Files:**
- Modify: `packages/cli-content/package.json`
- Create: `packages/cli-content/tsconfig.json` (if missing)

- [ ] **Step 1: Check and update package.json**

Replace `packages/cli-content/package.json` with:

```json
{
  "name": "@ark/cli-content",
  "version": "0.1.0",
  "description": "AI content generation leaf CLI",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "ark-content": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@ark/ai-bridge": "workspace:*",
    "@ark/core": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `packages/cli-content/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Install deps from monorepo root**

```bash
cd D:/ark && pnpm install
```

Expected: no errors, `@ark/cli-content` linked.

---

## Task 2: Implement `cli-content` types and content generator

**Files:**
- Create: `packages/cli-content/src/types.ts`
- Create: `packages/cli-content/src/generate-content.ts`
- Create: `packages/cli-content/src/__tests__/generate-content.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/cli-content/src/__tests__/generate-content.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateContent } from '../generate-content.js'
import type { AiBridge } from '@ark/ai-bridge'

const mockBridge: AiBridge = {
  planComposition: vi.fn(),
  makeRuntimeDecision: vi.fn(),
  generateContent: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateContent xhs', () => {
  it('returns title, body, tags from AI response', async () => {
    vi.mocked(mockBridge.generateContent).mockResolvedValue({
      content: JSON.stringify({
        title: '秋季护肤攻略',
        body: '秋天来了，皮肤容易干燥...',
        tags: ['护肤', '秋季', '美妆'],
      }),
    })

    const result = await generateContent(
      { topic: '秋季护肤', style: 'casual', lang: 'zh-CN' },
      'xhs',
      mockBridge
    )

    expect(result).toEqual({
      title: '秋季护肤攻略',
      body: '秋天来了，皮肤容易干燥...',
      tags: ['护肤', '秋季', '美妆'],
    })
  })
})

describe('generateContent x', () => {
  it('returns body and tags for Twitter', async () => {
    vi.mocked(mockBridge.generateContent).mockResolvedValue({
      content: JSON.stringify({
        title: '',
        body: 'Autumn skincare tips: keep it simple...',
        tags: ['skincare', 'autumn'],
      }),
    })

    const result = await generateContent(
      { topic: 'autumn skincare', style: 'professional', lang: 'en' },
      'x',
      mockBridge
    )

    expect(result.body).toBe('Autumn skincare tips: keep it simple...')
    expect(result.tags).toEqual(['skincare', 'autumn'])
  })
})

describe('generateContent error handling', () => {
  it('throws if AI returns invalid JSON', async () => {
    vi.mocked(mockBridge.generateContent).mockResolvedValue({
      content: 'not json at all',
    })

    await expect(
      generateContent({ topic: 'test' }, 'xhs', mockBridge)
    ).rejects.toThrow('Failed to parse AI content response')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd D:/ark/packages/cli-content && pnpm test
```

Expected: FAIL — `generate-content.ts` not found.

- [ ] **Step 3: Create types.ts**

Create `packages/cli-content/src/types.ts`:

```typescript
export interface ContentInput {
  topic: string
  style?: string
  lang?: string
}

export interface ContentOutput {
  title: string
  body: string
  tags: string[]
}
```

- [ ] **Step 4: Create generate-content.ts**

Create `packages/cli-content/src/generate-content.ts`:

```typescript
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
    // Strip markdown fences if present
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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd D:/ark/packages/cli-content && pnpm test
```

Expected: PASS — 3 tests pass.

- [ ] **Step 6: Commit**

```bash
cd D:/ark
git add packages/cli-content/src/types.ts packages/cli-content/src/generate-content.ts packages/cli-content/src/__tests__/generate-content.test.ts packages/cli-content/package.json packages/cli-content/tsconfig.json
git commit -m "feat: add cli-content generate-content module with tests"
```

---

## Task 3: Implement `cli-content` entry point and descriptor

**Files:**
- Create: `packages/cli-content/src/index.ts`
- Create: `packages/cli-content/ark-descriptor.yaml`

- [ ] **Step 1: Create index.ts**

Create `packages/cli-content/src/index.ts`:

```typescript
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
  const result = await generateContent({ topic, style, lang }, command, bridge)
  writeOutput(result)
  process.exit(0)
} catch (err) {
  process.stderr.write(`[ark:cli-content] Error: ${String(err)}\n`)
  process.exit(1)
}
```

- [ ] **Step 2: Create ark-descriptor.yaml**

Create `packages/cli-content/ark-descriptor.yaml`:

```yaml
apiVersion: ark/v1
kind: CliDescriptor

functional:
  id: "@ark/cli-content"
  version: "0.1.0"
  displayName: "Content Generator CLI"
  description: |
    Generates platform-native social media content using AI.
    Supports Xiaohongshu (xhs) and Twitter/X (x) output formats.
  entrypoint: "dist/index.js"
  modes: [manual, auto]

  inputs:
    - id: topic
      type: string
      required: true
      description: "Topic or theme for the post."
    - id: style
      type: string
      required: false
      description: "Writing style: casual, professional, poetic."
    - id: lang
      type: string
      required: false
      description: "Language code. Defaults to zh-CN for xhs, en for x."

  outputs:
    - id: title
      type: string
      description: "Post title (empty string for Twitter)."
    - id: body
      type: string
      description: "Post body text."
    - id: tags
      type: string[]
      description: "List of hashtags (without # symbol)."

  commands:
    - name: xhs
      description: "Generate a Xiaohongshu post."
      options:
        - flag: "--topic"
          type: string
          required: true
          description: "Post topic."
        - flag: "--style"
          type: string
          required: false
          description: "Writing style (casual, professional, poetic)."
        - flag: "--lang"
          type: string
          required: false
          description: "Language code. Default: zh-CN."
    - name: x
      description: "Generate a Twitter/X post."
      options:
        - flag: "--topic"
          type: string
          required: true
          description: "Post topic."
        - flag: "--style"
          type: string
          required: false
          description: "Writing style (casual, professional)."
        - flag: "--lang"
          type: string
          required: false
          description: "Language code. Default: en."

  types: {}
  env:
    - name: ANTHROPIC_API_KEY
      required: true
      description: "Anthropic API key for Claude content generation."

lineage:
  kind: leaf
  createdAt: "2026-03-28T00:00:00+00:00"
  history: []
```

- [ ] **Step 3: Build**

```bash
cd D:/ark/packages/cli-content && pnpm build
```

Expected: `dist/index.js` created, no TypeScript errors.

- [ ] **Step 4: Smoke test**

```bash
cd D:/ark
ANTHROPIC_API_KEY=dummy node packages/cli-content/dist/index.js xhs --topic "test" 2>&1 | head -5
```

Expected: Error about API key (not a "command not found" error) — confirms entry point loads correctly.

- [ ] **Step 5: Commit**

```bash
cd D:/ark
git add packages/cli-content/src/index.ts packages/cli-content/ark-descriptor.yaml
git commit -m "feat: implement cli-content entry point and descriptor"
```

---

## Task 4: Set up `cli-xhs` package and implement browser automation

**Files:**
- Modify: `packages/cli-xhs/package.json`
- Create: `packages/cli-xhs/tsconfig.json` (if missing)
- Create: `packages/cli-xhs/src/types.ts`
- Create: `packages/cli-xhs/src/post-xhs.ts`
- Create: `packages/cli-xhs/src/__tests__/post-xhs.test.ts`

- [ ] **Step 1: Update package.json** — replace playwright with agent-browser

Replace `packages/cli-xhs/package.json`:

```json
{
  "name": "@ark/cli-xhs",
  "version": "0.1.0",
  "description": "Xiaohongshu browser-automation leaf CLI",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "ark-xhs": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@ark/core": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "typescript": "^5.0.0"
  }
}
```

Note: `agent-browser` is a globally installed CLI, not an npm dependency.

- [ ] **Step 2: Create tsconfig.json** (if not present)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create types.ts**

Create `packages/cli-xhs/src/types.ts`:

```typescript
export interface XhsInput {
  title: string
  body: string
  tags: string[]
}

export interface XhsOutput {
  postUrl: string
  publishedAt: string
}
```

- [ ] **Step 4: Write the failing test**

Create `packages/cli-xhs/src/__tests__/post-xhs.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildAgentBrowserCommands } from '../post-xhs.js'

describe('buildAgentBrowserCommands', () => {
  it('returns commands with session load and form fill', () => {
    const commands = buildAgentBrowserCommands({
      sessionPath: '/sessions/xhs.json',
      input: {
        title: '秋季护肤攻略',
        body: '秋天来了，皮肤容易干燥...',
        tags: ['护肤', '秋季'],
      },
    })

    expect(commands[0]).toContain('load-session')
    expect(commands[0]).toContain('/sessions/xhs.json')
    expect(commands.some(c => c.includes('open'))).toBe(true)
    expect(commands.some(c => c.includes('秋季护肤攻略'))).toBe(true)
    expect(commands.some(c => c.includes('秋天来了'))).toBe(true)
  })

  it('formats tags as hashtags in body', () => {
    const commands = buildAgentBrowserCommands({
      sessionPath: '/sessions/xhs.json',
      input: {
        title: 'title',
        body: 'body text',
        tags: ['tag1', 'tag2'],
      },
    })

    const fillCommands = commands.filter(c => c.includes('fill'))
    const fullText = fillCommands.join(' ')
    expect(fullText).toContain('#tag1')
    expect(fullText).toContain('#tag2')
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

```bash
cd D:/ark/packages/cli-xhs && pnpm install && pnpm test
```

Expected: FAIL — `post-xhs.ts` not found.

- [ ] **Step 6: Create post-xhs.ts**

Create `packages/cli-xhs/src/post-xhs.ts`:

```typescript
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
    // snapshot commands return output; others we discard
    execSync(cmd, { stdio: 'inherit' })
  }

  // Run final snapshot to capture URL
  const snapshotOutput = execSync(commands[commands.length - 1]!, {
    encoding: 'utf8',
  })

  // Extract current URL from snapshot output (agent-browser prints it)
  const urlMatch = /url:\s*(https?:\/\/[^\s]+)/i.exec(snapshotOutput)
  const postUrl = urlMatch?.[1] ?? 'https://www.xiaohongshu.com'

  return {
    postUrl,
    publishedAt: new Date().toISOString(),
  }
}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
cd D:/ark/packages/cli-xhs && pnpm test
```

Expected: PASS — 2 tests pass.

- [ ] **Step 8: Commit**

```bash
cd D:/ark
git add packages/cli-xhs/package.json packages/cli-xhs/tsconfig.json packages/cli-xhs/src/types.ts packages/cli-xhs/src/post-xhs.ts packages/cli-xhs/src/__tests__/post-xhs.test.ts
git commit -m "feat: implement cli-xhs browser automation with agent-browser"
```

---

## Task 5: Implement `cli-xhs` entry point and descriptor

**Files:**
- Create: `packages/cli-xhs/src/index.ts`
- Create: `packages/cli-xhs/ark-descriptor.yaml`
- Create: `packages/cli-xhs/sessions/.gitkeep`

- [ ] **Step 1: Create index.ts**

Create `packages/cli-xhs/src/index.ts`:

```typescript
#!/usr/bin/env node
import { readInputPayload, writeOutput } from '@ark/core'
import { postToXhs } from './post-xhs.js'
import type { XhsInput } from './types.js'

const payload = readInputPayload<XhsInput>()

const args = process.argv.slice(2)
function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag)
  return idx !== -1 ? args[idx + 1] : undefined
}

const title = payload?.title ?? getFlag('--title')
const body = payload?.body ?? getFlag('--body')
const tagsRaw = payload?.tags ?? getFlag('--tags')
const tags = Array.isArray(tagsRaw)
  ? tagsRaw
  : typeof tagsRaw === 'string'
  ? tagsRaw.split(',').map(t => t.trim())
  : []

if (!title || !body) {
  process.stderr.write('[ark:cli-xhs] Error: title and body are required\n')
  process.exit(1)
}

const sessionPath = process.env['XHS_SESSION_PATH']
if (!sessionPath) {
  process.stderr.write('[ark:cli-xhs] Error: XHS_SESSION_PATH env var is required\n')
  process.exit(1)
}

try {
  const result = await postToXhs({ title, body, tags }, sessionPath)
  writeOutput(result)
  process.exit(0)
} catch (err) {
  process.stderr.write(`[ark:cli-xhs] Error: ${String(err)}\n`)
  process.exit(1)
}
```

- [ ] **Step 2: Create ark-descriptor.yaml**

Create `packages/cli-xhs/ark-descriptor.yaml`:

```yaml
apiVersion: ark/v1
kind: CliDescriptor

functional:
  id: "@ark/cli-xhs"
  version: "0.1.0"
  displayName: "Xiaohongshu Publisher CLI"
  description: |
    Publishes content to Xiaohongshu (小红书) using agent-browser automation.
    Requires a saved session file from a prior manual login.
  entrypoint: "dist/index.js"
  modes: [manual, auto]

  inputs:
    - id: title
      type: string
      required: true
      description: "Post title."
    - id: body
      type: string
      required: true
      description: "Post body text."
    - id: tags
      type: string[]
      required: false
      description: "Hashtags (without # symbol)."

  outputs:
    - id: postUrl
      type: string
      description: "URL of the published post."
    - id: publishedAt
      type: string
      description: "ISO 8601 timestamp of publication."

  commands:
    - name: post
      description: "Publish a post to Xiaohongshu."
      options:
        - flag: "--title"
          type: string
          required: true
        - flag: "--body"
          type: string
          required: true
        - flag: "--tags"
          type: string
          required: false
          description: "Comma-separated tags."

  types: {}
  env:
    - name: XHS_SESSION_PATH
      required: true
      description: "Path to the saved agent-browser session file for Xiaohongshu."

lineage:
  kind: leaf
  createdAt: "2026-03-28T00:00:00+00:00"
  history: []
```

- [ ] **Step 3: Create sessions directory and gitkeep**

```bash
mkdir -p D:/ark/packages/cli-xhs/sessions
touch D:/ark/packages/cli-xhs/sessions/.gitkeep
```

- [ ] **Step 4: Add sessions/ to .gitignore**

Add to `D:/ark/.gitignore` (or create if missing):

```
packages/cli-xhs/sessions/*.json
packages/cli-x/sessions/*.json
```

- [ ] **Step 5: Build**

```bash
cd D:/ark/packages/cli-xhs && pnpm build
```

Expected: `dist/index.js` created, no errors.

- [ ] **Step 6: Commit**

```bash
cd D:/ark
git add packages/cli-xhs/src/index.ts packages/cli-xhs/ark-descriptor.yaml packages/cli-xhs/sessions/.gitkeep .gitignore
git commit -m "feat: implement cli-xhs entry point, descriptor, and session directory"
```

---

## Task 6: Create `cli-x` package (Twitter/X automation)

**Files:**
- Create: `packages/cli-x/package.json`
- Create: `packages/cli-x/tsconfig.json`
- Create: `packages/cli-x/src/types.ts`
- Create: `packages/cli-x/src/post-x.ts`
- Create: `packages/cli-x/src/__tests__/post-x.test.ts`
- Create: `packages/cli-x/src/index.ts`
- Create: `packages/cli-x/ark-descriptor.yaml`

- [ ] **Step 1: Create package.json**

Create `packages/cli-x/package.json`:

```json
{
  "name": "@ark/cli-x",
  "version": "0.1.0",
  "description": "Twitter/X browser-automation leaf CLI",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "ark-x": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@ark/core": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `packages/cli-x/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create types.ts**

Create `packages/cli-x/src/types.ts`:

```typescript
export interface XInput {
  body: string
  tags: string[]
}

export interface XOutput {
  postUrl: string
  publishedAt: string
}
```

- [ ] **Step 4: Write the failing test**

Create `packages/cli-x/src/__tests__/post-x.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildAgentBrowserCommands } from '../post-x.js'

describe('buildAgentBrowserCommands for Twitter/X', () => {
  it('returns commands with session load and tweet fill', () => {
    const commands = buildAgentBrowserCommands({
      sessionPath: '/sessions/x.json',
      input: {
        body: 'Autumn skincare tips: keep it simple',
        tags: ['skincare', 'autumn'],
      },
    })

    expect(commands[0]).toContain('load-session')
    expect(commands[0]).toContain('/sessions/x.json')
    expect(commands.some(c => c.includes('x.com'))).toBe(true)
    expect(commands.some(c => c.includes('Autumn skincare'))).toBe(true)
  })

  it('appends hashtags to tweet body', () => {
    const commands = buildAgentBrowserCommands({
      sessionPath: '/sessions/x.json',
      input: { body: 'hello world', tags: ['ai', 'tech'] },
    })

    const fillCommands = commands.filter(c => c.includes('fill'))
    const fullText = fillCommands.join(' ')
    expect(fullText).toContain('#ai')
    expect(fullText).toContain('#tech')
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

```bash
cd D:/ark && pnpm install && cd packages/cli-x && pnpm test
```

Expected: FAIL — `post-x.ts` not found.

- [ ] **Step 6: Create post-x.ts**

Create `packages/cli-x/src/post-x.ts`:

```typescript
import { execSync } from 'node:child_process'
import type { XInput, XOutput } from './types.js'

interface BuildCommandsOptions {
  sessionPath: string
  input: XInput
}

export function buildAgentBrowserCommands(options: BuildCommandsOptions): string[] {
  const { sessionPath, input } = options
  const tagsText = input.tags.map(t => `#${t}`).join(' ')
  const fullBody = `${input.body} ${tagsText}`.trim()

  return [
    `agent-browser load-session "${sessionPath}"`,
    `agent-browser open "https://x.com/compose/tweet"`,
    `agent-browser wait --load networkidle`,
    `agent-browser snapshot -i`,
    `agent-browser fill @tweet-input "${fullBody.replace(/"/g, '\\"')}"`,
    `agent-browser click @post-btn`,
    `agent-browser wait --load networkidle`,
    `agent-browser snapshot`,
  ]
}

export async function postToX(
  input: XInput,
  sessionPath: string
): Promise<XOutput> {
  const commands = buildAgentBrowserCommands({ sessionPath, input })

  for (const cmd of commands.slice(0, -1)) {
    execSync(cmd, { stdio: 'inherit' })
  }

  const snapshotOutput = execSync(commands[commands.length - 1]!, {
    encoding: 'utf8',
  })

  const urlMatch = /url:\s*(https?:\/\/[^\s]+)/i.exec(snapshotOutput)
  const postUrl = urlMatch?.[1] ?? 'https://x.com'

  return {
    postUrl,
    publishedAt: new Date().toISOString(),
  }
}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
cd D:/ark/packages/cli-x && pnpm test
```

Expected: PASS — 2 tests pass.

- [ ] **Step 8: Create index.ts**

Create `packages/cli-x/src/index.ts`:

```typescript
#!/usr/bin/env node
import { readInputPayload, writeOutput } from '@ark/core'
import { postToX } from './post-x.js'
import type { XInput } from './types.js'

const payload = readInputPayload<XInput>()

const args = process.argv.slice(2)
function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag)
  return idx !== -1 ? args[idx + 1] : undefined
}

const body = payload?.body ?? getFlag('--body')
const tagsRaw = payload?.tags ?? getFlag('--tags')
const tags = Array.isArray(tagsRaw)
  ? tagsRaw
  : typeof tagsRaw === 'string'
  ? tagsRaw.split(',').map(t => t.trim())
  : []

if (!body) {
  process.stderr.write('[ark:cli-x] Error: body is required\n')
  process.exit(1)
}

const sessionPath = process.env['X_SESSION_PATH']
if (!sessionPath) {
  process.stderr.write('[ark:cli-x] Error: X_SESSION_PATH env var is required\n')
  process.exit(1)
}

try {
  const result = await postToX({ body, tags }, sessionPath)
  writeOutput(result)
  process.exit(0)
} catch (err) {
  process.stderr.write(`[ark:cli-x] Error: ${String(err)}\n`)
  process.exit(1)
}
```

- [ ] **Step 9: Create ark-descriptor.yaml**

Create `packages/cli-x/ark-descriptor.yaml`:

```yaml
apiVersion: ark/v1
kind: CliDescriptor

functional:
  id: "@ark/cli-x"
  version: "0.1.0"
  displayName: "Twitter/X Publisher CLI"
  description: |
    Publishes content to Twitter/X using agent-browser automation.
    Requires a saved session file from a prior manual login.
  entrypoint: "dist/index.js"
  modes: [manual, auto]

  inputs:
    - id: body
      type: string
      required: true
      description: "Tweet body text (under 280 chars)."
    - id: tags
      type: string[]
      required: false
      description: "Hashtags (without # symbol)."

  outputs:
    - id: postUrl
      type: string
      description: "URL of the published tweet."
    - id: publishedAt
      type: string
      description: "ISO 8601 timestamp of publication."

  commands:
    - name: post
      description: "Publish a tweet to Twitter/X."
      options:
        - flag: "--body"
          type: string
          required: true
        - flag: "--tags"
          type: string
          required: false
          description: "Comma-separated tags."

  types: {}
  env:
    - name: X_SESSION_PATH
      required: true
      description: "Path to the saved agent-browser session file for Twitter/X."

lineage:
  kind: leaf
  createdAt: "2026-03-28T00:00:00+00:00"
  history: []
```

- [ ] **Step 10: Create sessions directory**

```bash
mkdir -p D:/ark/packages/cli-x/sessions
touch D:/ark/packages/cli-x/sessions/.gitkeep
```

- [ ] **Step 11: Build**

```bash
cd D:/ark/packages/cli-x && pnpm build
```

Expected: `dist/index.js` created, no errors.

- [ ] **Step 12: Commit**

```bash
cd D:/ark
git add packages/cli-x/
git commit -m "feat: implement cli-x Twitter/X automation leaf CLI"
```

---

## Task 7: Create `cli-social-publisher` composed CLI

**Files:**
- Create: `packages/cli-social-publisher/package.json`
- Create: `packages/cli-social-publisher/tsconfig.json`
- Create: `packages/cli-social-publisher/ark-descriptor.yaml`
- Create: `packages/cli-social-publisher/wirings/post-xhs.yaml`
- Create: `packages/cli-social-publisher/wirings/post-x.yaml`
- Create: `packages/cli-social-publisher/src/index.ts`

- [ ] **Step 1: Create package.json**

Create `packages/cli-social-publisher/package.json`:

```json
{
  "name": "@ark/cli-social-publisher",
  "version": "0.1.0",
  "description": "Composed CLI: AI-generated social media publishing for XHS and Twitter/X",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "social-publisher": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@ark/core": "workspace:*",
    "@ark/runtime": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `packages/cli-social-publisher/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create wirings/post-xhs.yaml**

Create `packages/cli-social-publisher/wirings/post-xhs.yaml`:

```yaml
apiVersion: ark/v1
kind: WiringPlan
generatedBy: "hand-written"
generatedAt: "2026-03-28T00:00:00+00:00"

pipeline:
  mode: sequential

steps:
  - id: generate
    uses: "@ark/cli-content"
    command: xhs
    description: "Generate Xiaohongshu post content using AI."
    inputs:
      topic: "{{ ctx.flags.topic }}"
      style: "{{ ctx.flags.style | default: 'casual' }}"
    outputs:
      bind:
        content: "."

  - id: review
    uses: builtin/human-review
    condition: "{{ ctx.mode == 'manual' }}"
    description: "Show generated content for human review before posting."
    inputs:
      payload: "{{ ctx.bindings.content }}"
    outputs:
      bind:
        approvedContent: approved

  - id: post
    uses: "@ark/cli-xhs"
    command: post
    description: "Publish the content to Xiaohongshu."
    inputs:
      title: "{{ ctx.mode == 'manual' ? ctx.bindings.approvedContent.title : ctx.bindings.content.title }}"
      body: "{{ ctx.mode == 'manual' ? ctx.bindings.approvedContent.body : ctx.bindings.content.body }}"
      tags: "{{ ctx.mode == 'manual' ? ctx.bindings.approvedContent.tags : ctx.bindings.content.tags }}"
    outputs:
      bind:
        result: "."

  - id: done
    uses: builtin/log
    description: "Print the published post URL."
    inputs:
      message: "{{ ctx.bindings.result.postUrl }}"

errorPolicy:
  onStepFailure: abort
  retryPolicy:
    maxAttempts: 3
    backoffMs: 2000
    jitter: true

flags:
  - name: topic
    type: string
    required: true
    description: "Topic for the post."
  - name: style
    type: string
    required: false
    default: "casual"
    description: "Writing style (casual, professional, poetic)."
```

- [ ] **Step 4: Create wirings/post-x.yaml**

Create `packages/cli-social-publisher/wirings/post-x.yaml`:

```yaml
apiVersion: ark/v1
kind: WiringPlan
generatedBy: "hand-written"
generatedAt: "2026-03-28T00:00:00+00:00"

pipeline:
  mode: sequential

steps:
  - id: generate
    uses: "@ark/cli-content"
    command: x
    description: "Generate Twitter/X post content using AI."
    inputs:
      topic: "{{ ctx.flags.topic }}"
      style: "{{ ctx.flags.style | default: 'casual' }}"
    outputs:
      bind:
        content: "."

  - id: review
    uses: builtin/human-review
    condition: "{{ ctx.mode == 'manual' }}"
    description: "Show generated content for human review before posting."
    inputs:
      payload: "{{ ctx.bindings.content }}"
    outputs:
      bind:
        approvedContent: approved

  - id: post
    uses: "@ark/cli-x"
    command: post
    description: "Publish the content to Twitter/X."
    inputs:
      body: "{{ ctx.mode == 'manual' ? ctx.bindings.approvedContent.body : ctx.bindings.content.body }}"
      tags: "{{ ctx.mode == 'manual' ? ctx.bindings.approvedContent.tags : ctx.bindings.content.tags }}"
    outputs:
      bind:
        result: "."

  - id: done
    uses: builtin/log
    description: "Print the published tweet URL."
    inputs:
      message: "{{ ctx.bindings.result.postUrl }}"

errorPolicy:
  onStepFailure: abort
  retryPolicy:
    maxAttempts: 3
    backoffMs: 2000
    jitter: true

flags:
  - name: topic
    type: string
    required: true
    description: "Topic for the tweet."
  - name: style
    type: string
    required: false
    default: "casual"
    description: "Writing style (casual, professional)."
```

- [ ] **Step 5: Create ark-descriptor.yaml**

Create `packages/cli-social-publisher/ark-descriptor.yaml`:

```yaml
apiVersion: ark/v1
kind: CliDescriptor

functional:
  id: "@ark/cli-social-publisher"
  version: "0.1.0"
  displayName: "Social Publisher"
  description: |
    Composed CLI that generates platform-native social media content using AI
    and publishes it to Xiaohongshu or Twitter/X via browser automation.
  entrypoint: "dist/index.js"
  modes: [auto, manual]

  inputs: []

  outputs:
    - id: postUrl
      type: string
      description: "URL of the published post."
    - id: publishedAt
      type: string
      description: "ISO 8601 timestamp of publication."

  commands:
    - name: post-xhs
      description: "Generate and publish a Xiaohongshu post."
      wiringRef: "wirings/post-xhs.yaml"
      options:
        - flag: "--topic"
          type: string
          required: true
          description: "Post topic."
        - flag: "--style"
          type: string
          required: false
          description: "Writing style: casual, professional, poetic."
        - flag: "--auto"
          type: boolean
          required: false
          description: "Skip human review step."
        - flag: "--manual"
          type: boolean
          required: false
          description: "Pause for human review before posting."
        - flag: "--dry-run"
          type: boolean
          required: false
          description: "Run pipeline without actually posting."
    - name: post-x
      description: "Generate and publish a Twitter/X post."
      wiringRef: "wirings/post-x.yaml"
      options:
        - flag: "--topic"
          type: string
          required: true
          description: "Tweet topic."
        - flag: "--style"
          type: string
          required: false
          description: "Writing style: casual, professional."
        - flag: "--auto"
          type: boolean
          required: false
          description: "Skip human review step."
        - flag: "--manual"
          type: boolean
          required: false
          description: "Pause for human review before posting."
        - flag: "--dry-run"
          type: boolean
          required: false
          description: "Run pipeline without actually posting."

  types: {}
  env:
    - name: ANTHROPIC_API_KEY
      required: true
      description: "Required for AI content generation."
    - name: XHS_SESSION_PATH
      required: false
      description: "Required when running post-xhs."
    - name: X_SESSION_PATH
      required: false
      description: "Required when running post-x."

lineage:
  kind: composed
  createdAt: "2026-03-28T00:00:00+00:00"
  parents:
    - id: "@ark/cli-content"
      version: "0.1.0"
    - id: "@ark/cli-xhs"
      version: "0.1.0"
    - id: "@ark/cli-x"
      version: "0.1.0"
  aiProposal: "Sequential: generate content → optional human review → publish via browser automation"
  approvedWiringRef: "wirings/"
```

- [ ] **Step 6: Create src/index.ts**

Create `packages/cli-social-publisher/src/index.ts`:

```typescript
#!/usr/bin/env node
import { MultiCommandRunner } from '@ark/runtime'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const runner = new MultiCommandRunner({
  packageDir: join(__dirname, '..'),
  composedCliId: '@ark/cli-social-publisher',
  monorepoRoot: join(__dirname, '..', '..', '..'),
})

const argv = process.argv.slice(2)
if (!argv[0] || argv[0] === '--help' || argv[0] === '-h') {
  runner.printHelp()
  process.exit(0)
}

const result = await runner.run(argv)
if (!result.success) process.exit(1)
```

- [ ] **Step 7: Install and build**

```bash
cd D:/ark && pnpm install && pnpm --filter @ark/cli-social-publisher build
```

Expected: `packages/cli-social-publisher/dist/index.js` created, no errors.

- [ ] **Step 8: Smoke test help output**

```bash
node packages/cli-social-publisher/dist/index.js --help
```

Expected: Prints available commands: `post-xhs`, `post-x` with descriptions.

- [ ] **Step 9: Commit**

```bash
cd D:/ark
git add packages/cli-social-publisher/
git commit -m "feat: scaffold cli-social-publisher composed CLI with post-xhs and post-x wiring"
```

---

## Task 8: Build all packages and dry-run validation

- [ ] **Step 1: Build all packages**

```bash
cd D:/ark && pnpm build
```

Expected: All packages build without TypeScript errors.

- [ ] **Step 2: Dry-run post-xhs**

```bash
cd D:/ark
ANTHROPIC_API_KEY=dummy XHS_SESSION_PATH=./packages/cli-xhs/sessions/xhs.json \
  node packages/cli-social-publisher/dist/index.js post-xhs --topic "秋季护肤" --dry-run
```

Expected: Pipeline runs all steps in dry-run mode, skipping actual browser/AI calls. Output shows step trace without errors.

- [ ] **Step 3: Dry-run post-x**

```bash
cd D:/ark
ANTHROPIC_API_KEY=dummy X_SESSION_PATH=./packages/cli-x/sessions/x.json \
  node packages/cli-social-publisher/dist/index.js post-x --topic "AI trends" --dry-run
```

Expected: Same — pipeline completes in dry-run mode.

- [ ] **Step 4: Final commit**

```bash
cd D:/ark
git add .
git commit -m "feat: complete cli-social-publisher — all packages built and dry-run validated"
```

---

## Session Setup (One-time manual step — not automated)

Before doing a live run, set up sessions:

```bash
# Install agent-browser globally
npm install -g agent-browser

# Xiaohongshu: open browser, log in manually, save session
agent-browser open https://www.xiaohongshu.com
# (log in manually in the browser window that opens)
agent-browser save-session ./packages/cli-xhs/sessions/xhs-session.json

# Twitter/X: same flow
agent-browser open https://x.com
# (log in manually)
agent-browser save-session ./packages/cli-x/sessions/x-session.json

# Set env vars
export XHS_SESSION_PATH="$(pwd)/packages/cli-xhs/sessions/xhs-session.json"
export X_SESSION_PATH="$(pwd)/packages/cli-x/sessions/x-session.json"
export ANTHROPIC_API_KEY="sk-ant-..."
```

Then run live:

```bash
node packages/cli-social-publisher/dist/index.js post-xhs --topic "秋季护肤" --manual
node packages/cli-social-publisher/dist/index.js post-x --topic "AI trends" --style professional
```
