import { describe, it, expect } from 'vitest'
import {
  CliDescriptorSchema,
  WiringPlanSchema,
  ComposeRequestSchema,
} from './schemas.js'

const leafDescriptor = {
  apiVersion: 'ark/v1',
  kind: 'CliDescriptor',
  functional: {
    id: '@ark/cli-xhs',
    version: '1.0.0',
    displayName: 'Xiaohongshu CLI',
    description: 'Browser automation for Xiaohongshu.',
    entrypoint: 'dist/index.js',
    inputs: [{ id: 'post', type: 'Post', required: true }],
    outputs: [{ id: 'publishResult', type: 'PublishResult' }],
  },
  lineage: {
    kind: 'leaf',
    createdAt: '2025-01-15T10:00:00+00:00',
  },
}

describe('CliDescriptorSchema', () => {
  it('parses a valid leaf descriptor', () => {
    const result = CliDescriptorSchema.safeParse(leafDescriptor)
    expect(result.success).toBe(true)
  })

  it('rejects missing required functional.id', () => {
    const invalid = structuredClone(leafDescriptor)
    // @ts-expect-error intentional
    delete invalid.functional.id
    expect(CliDescriptorSchema.safeParse(invalid).success).toBe(false)
  })

  it('parses a composed descriptor', () => {
    const composed = {
      ...leafDescriptor,
      lineage: {
        kind: 'composed',
        createdAt: '2025-02-01T14:00:00+00:00',
        parents: [
          { id: '@ark/cli-xhs', version: '1.0.0' },
          { id: '@ark/cli-content', version: '1.0.0' },
        ],
        aiPrompt: 'Combine these CLIs...',
        aiProposal: 'Here is my proposal...',
      },
    }
    expect(CliDescriptorSchema.safeParse(composed).success).toBe(true)
  })
})

describe('WiringPlanSchema', () => {
  it('parses a minimal valid wiring plan', () => {
    const plan = {
      apiVersion: 'ark/v1',
      kind: 'WiringPlan',
      pipeline: { mode: 'sequential' },
      steps: [
        {
          id: 'generate',
          uses: '@ark/cli-content',
          command: 'generate',
          inputs: { topic: '{{ ctx.flags.topic }}' },
          outputs: { bind: { generatedPost: 'post' } },
        },
      ],
    }
    expect(WiringPlanSchema.safeParse(plan).success).toBe(true)
  })
})

describe('ComposeRequestSchema', () => {
  it('parses a valid compose request', () => {
    const req = {
      apiVersion: 'ark/v1',
      kind: 'ComposeRequest',
      output: {
        id: '@ark/cli-xhs-scheduler',
        displayName: 'Xiaohongshu Scheduler',
        targetDirectory: 'packages/cli-xhs-scheduler',
      },
      parents: [{ id: '@ark/cli-xhs' }, { id: '@ark/cli-content' }],
      intent: 'Schedule AI-generated posts for Xiaohongshu.',
    }
    expect(ComposeRequestSchema.safeParse(req).success).toBe(true)
  })
})

describe('WiringPlanSchema — lifecycle and topology', () => {
  const basePlan = {
    apiVersion: 'ark/v1' as const,
    kind: 'WiringPlan' as const,
    pipeline: { topology: 'sequential' as const },
    steps: [],
  }

  it('accepts topology: sequential with lifecycle: finite (default)', () => {
    const result = WiringPlanSchema.safeParse(basePlan)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.pipeline.lifecycle).toBe('finite')
    }
  })

  it('accepts deprecated mode field', () => {
    const plan = { ...basePlan, pipeline: { mode: 'sequential' as const } }
    const result = WiringPlanSchema.safeParse(plan)
    expect(result.success).toBe(true)
  })

  it('rejects plan with neither topology nor mode', () => {
    const plan = { ...basePlan, pipeline: { lifecycle: 'finite' } }
    const result = WiringPlanSchema.safeParse(plan)
    expect(result.success).toBe(false)
  })

  it('accepts lifecycle: streaming with streaming config', () => {
    const plan = {
      ...basePlan,
      pipeline: { topology: 'sequential' as const, lifecycle: 'streaming' as const },
      streaming: {
        until: '2026-12-31T00:00:00+00:00',
        stopOn: [{ signal: 'SIGINT' }, { signal: 'SIGTERM' }],
        restartOnFailure: true,
      },
    }
    const result = WiringPlanSchema.safeParse(plan)
    expect(result.success).toBe(true)
  })

  it('streaming config restartOnFailure defaults to false', () => {
    const plan = {
      ...basePlan,
      pipeline: { topology: 'sequential' as const, lifecycle: 'streaming' as const },
      streaming: {},
    }
    const result = WiringPlanSchema.safeParse(plan)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.streaming?.restartOnFailure).toBe(false)
    }
  })

  it('rejects streaming config when lifecycle is not streaming', () => {
    const plan = {
      ...basePlan,
      pipeline: { topology: 'sequential' as const, lifecycle: 'finite' as const },
      streaming: { restartOnFailure: false },
    }
    const result = WiringPlanSchema.safeParse(plan)
    expect(result.success).toBe(false)
  })

  it('rejects streaming config when lifecycle is absent (defaults to finite)', () => {
    const plan = {
      ...basePlan,
      streaming: { restartOnFailure: false },
    }
    const result = WiringPlanSchema.safeParse(plan)
    expect(result.success).toBe(false)
  })

  it('accepts lifecycle: streaming without streaming config block', () => {
    const plan = {
      ...basePlan,
      pipeline: { topology: 'sequential' as const, lifecycle: 'streaming' as const },
    }
    const result = WiringPlanSchema.safeParse(plan)
    expect(result.success).toBe(true)
  })
})
