import { describe, it, expect } from 'vitest'
import {
  CliDescriptorSchema,
  WiringPlanSchema,
  WiringStepSchema,
  ErrorPolicySchema,
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

describe('schema extensions', () => {
  it('accepts timeout on a step', () => {
    const step = {
      id: 'fetch',
      uses: '@ark/cli-weather',
      timeout: '30s',
    }
    expect(() => WiringStepSchema.parse(step)).not.toThrow()
  })

  it('accepts dependsOn on a step', () => {
    const step = { id: 'b', uses: '@ark/cli-weather', dependsOn: ['a'] }
    expect(() => WiringStepSchema.parse(step)).not.toThrow()
  })

  it('accepts pipeline concurrency', () => {
    const plan = {
      apiVersion: 'ark/v1',
      kind: 'WiringPlan',
      pipeline: { mode: 'dag', concurrency: 3 },
      steps: [],
    }
    expect(() => WiringPlanSchema.parse(plan)).not.toThrow()
  })

  it('accepts parallelBehavior in errorPolicy', () => {
    const policy = { onStepFailure: 'abort', parallelBehavior: 'waitAll' }
    expect(() => ErrorPolicySchema.parse(policy)).not.toThrow()
  })

  it('rejects invalid timeout format', () => {
    const step = { id: 'x', uses: '@ark/cli-weather', timeout: '30x' }
    expect(() => WiringStepSchema.parse(step)).toThrow()
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
