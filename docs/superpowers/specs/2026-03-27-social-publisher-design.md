# Social Publisher CLI — Design Spec

**Date:** 2026-03-27
**Status:** Approved

---

## Overview

A composed CLI `@ark/cli-social-publisher` that publishes AI-generated content to Xiaohongshu and Twitter/X. It exposes two commands (`post-xhs`, `post-x`), each wiring a content-generation leaf CLI with a browser-automation leaf CLI via the ark framework.

---

## Package Structure

```
packages/
  cli-content/              # Leaf: AI content generation (xhs | x commands)
  cli-xhs/                  # Leaf: Xiaohongshu browser automation (post command)
  cli-x/                    # Leaf: Twitter/X browser automation (post command) [NEW]
  cli-social-publisher/     # Composed CLI [NEW]
    wirings/
      post-xhs.yaml
      post-x.yaml
    src/index.ts            # MultiCommandRunner entry
```

`cli-content` and `cli-xhs` already exist as empty skeletons. `cli-x` and `cli-social-publisher` are new.

---

## Leaf CLI Interfaces

### `@ark/cli-content`

**Commands:** `xhs`, `x`

**Flags:**
| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--topic` | string | yes | Post topic |
| `--style` | string | no | casual / professional / poetic |
| `--lang` | string | no | Language (default: zh-CN for xhs, en for x) |

**ARK_INPUT_PAYLOAD:** `{ topic, style?, lang? }`

**Output:** `{ title, body, tags }`

**env:** `ANTHROPIC_API_KEY`

---

### `@ark/cli-xhs`

**Commands:** `post`

**Input:** `{ title, body, tags }`

**Output:** `{ postUrl, publishedAt }`

**env:** `XHS_SESSION_PATH` — path to saved agent-browser session file

**Tool:** `agent-browser` CLI (load-session → open → snapshot → fill → click)

---

### `@ark/cli-x`

**Commands:** `post`

**Input:** `{ body, tags }` (no title — Twitter has no title field)

**Output:** `{ postUrl, publishedAt }`

**env:** `X_SESSION_PATH` — path to saved agent-browser session file

**Tool:** `agent-browser` CLI

---

## Composed CLI: `@ark/cli-social-publisher`

### Commands

| Command | Wiring | Pipeline |
|---------|--------|----------|
| `post-xhs` | `wirings/post-xhs.yaml` | generate → review → post → log |
| `post-x` | `wirings/post-x.yaml` | generate → review → post → log |

### Wiring Plan: `post-xhs`

```yaml
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential
steps:
  - id: generate
    uses: "@ark/cli-content"
    command: xhs
    inputs:
      topic: "{{ ctx.flags.topic }}"
      style: "{{ ctx.flags.style | default: 'casual' }}"
    outputs:
      bind:
        content: "."

  - id: review
    uses: builtin/human-review
    condition: "{{ ctx.mode == 'manual' }}"
    inputs:
      payload: "{{ ctx.bindings.content }}"
    outputs:
      bind:
        approvedContent: approved

  - id: post
    uses: "@ark/cli-xhs"
    command: post
    inputs:
      title: "{{ ctx.mode == 'manual' ? ctx.bindings.approvedContent.title : ctx.bindings.content.title }}"
      body: "{{ ctx.mode == 'manual' ? ctx.bindings.approvedContent.body : ctx.bindings.content.body }}"
      tags: "{{ ctx.mode == 'manual' ? ctx.bindings.approvedContent.tags : ctx.bindings.content.tags }}"
    outputs:
      bind:
        result: "."

  - id: done
    uses: builtin/log
    inputs:
      message: "{{ ctx.bindings.result.postUrl }}"

errorPolicy:
  onStepFailure: abort
  retryPolicy:
    maxAttempts: 3
    backoffMs: 2000
    jitter: true
```

`post-x.yaml` is identical in structure, substituting `cli-content x` and `cli-x post`, with `body` and `tags` only (no `title`).

### Usage

```bash
# Auto mode — AI generates and posts directly
node packages/cli-social-publisher/dist/index.js post-xhs --topic "秋季护肤" --auto

# Manual mode — review content before posting
node packages/cli-social-publisher/dist/index.js post-xhs --topic "秋季护肤" --manual

# Twitter/X
node packages/cli-social-publisher/dist/index.js post-x --topic "AI trends" --style professional
```

---

## Session Management

**First-time setup (manual login):**
```bash
agent-browser open https://www.xiaohongshu.com
# Log in manually in the browser window
agent-browser save-session ./packages/cli-xhs/sessions/xhs-session.json

agent-browser open https://x.com
agent-browser save-session ./packages/cli-x/sessions/x-session.json
```

**Runtime — session is loaded at CLI startup:**
```typescript
// Inside cli-xhs/src/index.ts
const sessionPath = process.env['XHS_SESSION_PATH']
execSync(`agent-browser load-session ${sessionPath}`)
```

**Required env vars:**
```bash
export XHS_SESSION_PATH="./packages/cli-xhs/sessions/xhs-session.json"
export X_SESSION_PATH="./packages/cli-x/sessions/x-session.json"
export ANTHROPIC_API_KEY="sk-ant-..."
```

**`.gitignore`** must exclude `sessions/` directories to prevent cookie leaks.

---

## Lineage

```
@ark/cli-social-publisher (composed)
├── post-xhs pipeline
│   ├── @ark/cli-content (leaf)
│   └── @ark/cli-xhs (leaf)
└── post-x pipeline
    ├── @ark/cli-content (leaf)
    └── @ark/cli-x (leaf)
```

---

## Implementation Order

1. Implement `cli-content` — descriptor + `xhs`/`x` commands with Claude prompts
2. Implement `cli-xhs` — descriptor + `post` command with agent-browser
3. Implement `cli-x` — new package, same pattern as cli-xhs
4. Scaffold `cli-social-publisher` — descriptor, wirings, MultiCommandRunner entrypoint
5. End-to-end test with `--dry-run`, then live run with real sessions
