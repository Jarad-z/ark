import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as yaml from 'js-yaml'
import { ComposeRequestSchema, ValidationError } from '@ark/core'
import type { ComposeRequest } from '@ark/core'
import { createAiBridge } from '@ark/ai-bridge'
import type { AiBridge } from '@ark/ai-bridge'
import { DescriptorResolver } from './descriptor-resolver.js'
import { AiPlannerSession } from './ai-planner-session.js'
import { HumanReviewSession } from './human-review-session.js'
import { PackageScaffolder } from './package-scaffolder.js'
import { buildLineage } from './lineage-writer.js'

export interface ComposerOptions {
  monorepoRoot?: string
  bridge?: AiBridge
}

export class Composer {
  private monorepoRoot: string
  private bridge: AiBridge

  constructor(options: ComposerOptions = {}) {
    this.monorepoRoot = options.monorepoRoot ?? process.cwd()
    this.bridge = options.bridge ?? createAiBridge()
  }

  async compose(requestPath: string): Promise<string> {
    // 1. Load and validate compose request
    const request = this.loadRequest(requestPath)

    // 2. Resolve parent descriptors
    const resolver = new DescriptorResolver(this.monorepoRoot)
    const descriptors = resolver.resolveAll(request.parents.map((p: { id: string }) => p.id))

    // 3. AI generates wiring plan
    const planner = new AiPlannerSession(this.bridge)
    const plannerResult = await planner.run(request, descriptors)

    // 4. Human reviews (loop until accepted or rejected)
    const reviewer = new HumanReviewSession()
    let reviewResult = await reviewer.review(plannerResult.rationale, plannerResult.wiringYaml)

    while (!reviewResult.accepted) {
      process.stderr.write('[ark:composer] Plan rejected. Re-running AI with amended prompt...\n')
      const amendedResult = await planner.run(request, descriptors)
      reviewResult = await reviewer.review(amendedResult.rationale, amendedResult.wiringYaml)
    }

    // 5. Build lineage
    const lineage = buildLineage(request, descriptors, plannerResult, reviewResult.humanEdits)

    // 6. Scaffold the package
    const scaffolder = new PackageScaffolder()
    const targetDir = scaffolder.scaffold({
      monorepoRoot: this.monorepoRoot,
      request,
      descriptors,
      wiringYaml: reviewResult.wiringYaml,
      lineage,
    })

    process.stdout.write(`\n[ark:composer] ✓ Created composed CLI at: ${targetDir}\n`)
    process.stdout.write(`[ark:composer] Next: pnpm install && pnpm --filter ${request.output.id} build\n`)

    return targetDir
  }

  private loadRequest(requestPath: string): ComposeRequest {
    const absPath = resolve(requestPath)
    let raw: unknown
    try {
      raw = yaml.load(readFileSync(absPath, 'utf8'))
    } catch (err) {
      throw new ValidationError(`Failed to read compose request at ${absPath}: ${String(err)}`, [])
    }

    const result = ComposeRequestSchema.safeParse(raw)
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      throw new ValidationError('Invalid compose request', issues)
    }
    return result.data
  }
}
