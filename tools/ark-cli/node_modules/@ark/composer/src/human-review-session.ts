import { createInterface } from 'node:readline'
import { spawnSync } from 'node:child_process'
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WiringPlanSchema, ValidationError } from '@ark/core'
import * as yaml from 'js-yaml'

export interface ReviewResult {
  wiringYaml: string
  humanEdits: string | undefined
  accepted: boolean
}

/**
 * Presents the AI-proposed WiringPlan YAML to the user in the terminal.
 * Options: accept / edit in $EDITOR / reject and re-prompt.
 */
export class HumanReviewSession {
  async review(
    rationale: string,
    wiringYaml: string
  ): Promise<ReviewResult> {
    while (true) {
      this.printProposal(rationale, wiringYaml)
      const choice = await this.prompt(
        '\n[ark:composer] Accept this wiring plan? [y]es / [e]dit / [r]eject: '
      )

      if (choice === 'y' || choice === 'yes') {
        this.validateOrThrow(wiringYaml)
        return { wiringYaml, humanEdits: undefined, accepted: true }
      }

      if (choice === 'e' || choice === 'edit') {
        const edited = this.openInEditor(wiringYaml)
        if (edited === wiringYaml) {
          process.stderr.write('[ark:composer] No changes made.\n')
          continue
        }
        this.validateOrThrow(edited)
        return {
          wiringYaml: edited,
          humanEdits: this.diffSummary(wiringYaml, edited),
          accepted: true,
        }
      }

      if (choice === 'r' || choice === 'reject') {
        return { wiringYaml, humanEdits: undefined, accepted: false }
      }

      process.stderr.write('Please enter y, e, or r.\n')
    }
  }

  private printProposal(rationale: string, wiringYaml: string): void {
    process.stdout.write('\n' + '─'.repeat(60) + '\n')
    if (rationale) {
      process.stdout.write('AI RATIONALE:\n\n' + rationale + '\n\n')
      process.stdout.write('─'.repeat(60) + '\n')
    }
    process.stdout.write('PROPOSED WIRING PLAN:\n\n```yaml\n' + wiringYaml + '\n```\n')
    process.stdout.write('─'.repeat(60) + '\n')
  }

  private prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
      })
      process.stdout.write(question)
      rl.once('line', (line) => {
        rl.close()
        resolve(line.trim().toLowerCase())
      })
    })
  }

  private openInEditor(content: string): string {
    const tmpFile = join(tmpdir(), `ark-wiring-${Date.now()}.yaml`)
    writeFileSync(tmpFile, content, 'utf8')

    const editor = process.env['EDITOR'] ?? process.env['VISUAL'] ?? 'notepad'
    spawnSync(editor, [tmpFile], { stdio: 'inherit' })

    const edited = readFileSync(tmpFile, 'utf8')
    unlinkSync(tmpFile)
    return edited
  }

  private validateOrThrow(wiringYaml: string): void {
    let raw: unknown
    try {
      raw = yaml.load(wiringYaml)
    } catch (err) {
      throw new ValidationError(`Wiring YAML is not valid YAML: ${String(err)}`, [])
    }
    const result = WiringPlanSchema.safeParse(raw)
    if (!result.success) {
      const issues = result.error.issues.map((i: { path: (string | number)[]; message: string }) => `${i.path.join('.')}: ${i.message}`)
      throw new ValidationError('Wiring plan failed schema validation', issues)
    }
  }

  private diffSummary(original: string, edited: string): string {
    const origLines = original.split('\n')
    const editLines = edited.split('\n')
    const added = editLines.filter((l) => !origLines.includes(l)).length
    const removed = origLines.filter((l) => !editLines.includes(l)).length
    return `Human edited: +${added} lines, -${removed} lines`
  }
}
