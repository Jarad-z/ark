import { describe, it, expect, vi } from 'vitest'
import { AiPlannerSession } from './ai-planner-session.js'

const parallelPlanYaml = `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential
steps:
  - id: fetch-weather
    uses: "@ark/cli-weather"
    outputs:
      bind:
        weatherData: "."
  - id: fetch-news
    uses: "@ark/cli-news"
    outputs:
      bind:
        newsData: "."
  - id: generate
    uses: "@ark/cli-report"
    inputs:
      weather: "{{ ctx.bindings.weatherData }}"
      news: "{{ ctx.bindings.newsData }}"
`

const mockBridge = {
  planComposition: vi.fn().mockResolvedValue({
    wiringYaml: parallelPlanYaml,
    rationale: 'test plan',
  }),
}

describe('AiPlannerSession parallel detection', () => {
  it('detects parallelizable steps and returns suggestion', async () => {
    const session = new AiPlannerSession(mockBridge as any)
    const result = await session.run(
      {
        apiVersion: 'ark/v1',
        kind: 'ComposeRequest',
        output: { id: 'test', targetDirectory: '.' },
        parents: [],
        intent: 'test',
        constraints: [],
      } as any,
      new Map()
    )
    expect(result.parallelSuggestion).toBeDefined()
    expect(result.parallelSuggestion?.stepIds).toContain('fetch-weather')
    expect(result.parallelSuggestion?.stepIds).toContain('fetch-news')
    expect(result.parallelSuggestion?.stepIds).not.toContain('generate')
    expect(result.parallelSuggestion?.recommendation).toBe('failFast')
  })

  it('returns no suggestion when all steps are sequential (chained)', async () => {
    const sequentialBridge = {
      planComposition: vi.fn().mockResolvedValue({
        wiringYaml: `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential
steps:
  - id: a
    uses: "@ark/cli-a"
    outputs:
      bind:
        aOut: "."
  - id: b
    uses: "@ark/cli-b"
    inputs:
      data: "{{ ctx.bindings.aOut }}"
`,
        rationale: 'sequential',
      }),
    }
    const session = new AiPlannerSession(sequentialBridge as any)
    const result = await session.run(
      {
        apiVersion: 'ark/v1',
        kind: 'ComposeRequest',
        output: { id: 'test', targetDirectory: '.' },
        parents: [],
        intent: 'test',
        constraints: [],
      } as any,
      new Map()
    )
    expect(result.parallelSuggestion).toBeUndefined()
  })
})
