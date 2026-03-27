import type { CliDescriptor, ComposeRequest } from '@ark/core'
import type { PlannerSessionResult } from './ai-planner-session.js'
import { createHash } from 'node:crypto'
import * as yaml from 'js-yaml'

export interface LineageData {
  kind: 'composed'
  createdAt: string
  parents: Array<{ id: string; version: string; descriptorHash: string }>
  aiPrompt: string
  aiProposal: string
  approvedWiringRef: string
  humanEdits: string | undefined
  usedAsParentIn: string[]
}

export function buildLineage(
  request: ComposeRequest,
  descriptors: Map<string, CliDescriptor>,
  plannerResult: PlannerSessionResult,
  humanEdits: string | undefined
): LineageData {
  const parents = request.parents.map(({ id }: { id: string }) => {
    const desc = descriptors.get(id)!
    const serialized = yaml.dump(desc)
    const hash = 'sha256:' + createHash('sha256').update(serialized).digest('hex')
    return {
      id,
      version: desc.functional.version,
      descriptorHash: hash,
    }
  })

  return {
    kind: 'composed',
    createdAt: new Date().toISOString(),
    parents,
    aiPrompt: plannerResult.prompt,
    aiProposal: plannerResult.wiringYaml ?? '',
    approvedWiringRef: 'ark-wiring.yaml',
    humanEdits,
    usedAsParentIn: [],
  }
}
