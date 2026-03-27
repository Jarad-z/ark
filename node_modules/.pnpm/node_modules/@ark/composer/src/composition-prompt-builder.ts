import * as yaml from 'js-yaml'
import type { CliDescriptor, ComposeRequest } from '@ark/core'

/**
 * Builds the AI prompt for composition planning.
 * The quality of the generated WiringPlan depends entirely on this prompt.
 */
export class CompositionPromptBuilder {
  build(
    request: ComposeRequest,
    descriptors: Map<string, CliDescriptor>
  ): string {
    const descriptorDumps = [...descriptors.entries()]
      .map(([id, desc]: [string, CliDescriptor]) => {
        const serialized = yaml.dump(desc, { lineWidth: 120 })
        return `### Descriptor: ${id}\n\`\`\`yaml\n${serialized}\`\`\``
      })
      .join('\n\n')

    const constraintsList =
      request.constraints.length > 0
        ? request.constraints.map((c) => `- ${c}`).join('\n')
        : '(none)'

    return `You are an expert CLI composition planner for the Ark framework.

Your task is to produce a WiringPlan YAML that wires together the parent CLIs
described below to fulfil the user's intent.

## User Intent
${request.intent}

## Constraints
${constraintsList}

## Output CLI
- id: ${request.output.id}
- displayName: ${request.output.displayName}
${request.output.description ? `- description: ${request.output.description}` : ''}

## Parent CLI Descriptors
${descriptorDumps}

## WiringPlan Schema Requirements
The WiringPlan YAML must conform to this structure:

\`\`\`yaml
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential  # sequential | parallel | dag

steps:
  - id: <step-id>
    uses: <parent-cli-id>       # or builtin/human-review, builtin/log, builtin/conditional
    command: <command-name>      # optional
    description: <human description>
    condition: "{{ ctx.mode == 'manual' }}"  # optional, Liquid-style expression
    inputs:
      <key>: "{{ ctx.flags.topic }}"   # template expressions supported
    outputs:
      bind:
        <ctx-binding-name>: <step-output-key>

errorPolicy:
  onStepFailure: abort  # abort | continue | retry
  retryPolicy:
    maxAttempts: 3
    backoffMs: 1000

autoMode:               # only if modes includes 'auto'
  decisionStep:
    before: <step-id>
    prompt: |
      <natural language instruction to the AI at runtime>
    outputBindings:
      <flag-name>: ctx.flags.<flag-name>

flags:
  - name: <flag>
    type: string
    required: false
    description: <description>
    default: <value>
\`\`\`

## Available Builtin Steps
- \`builtin/human-review\`: Presents the input payload to the human for approval/editing.
  Inputs: \`payload\` (any). Outputs: \`approved\` (edited or original value).
- \`builtin/log\`: Logs a message to stdout. Inputs: \`message\` (string).
- \`builtin/conditional\`: Branches based on a condition. Inputs: \`condition\` (bool), \`value\` (any).

## Template Expression Syntax
- \`{{ ctx.flags.topic }}\` — read a CLI flag
- \`{{ ctx.bindings.generatedPost }}\` — read a named binding set by a previous step
- \`{{ ctx.flags.language | default: 'zh-CN' }}\` — with fallback
- \`{{ ctx.mode == 'manual' ? ctx.bindings.approved : ctx.bindings.generated }}\` — ternary

## Instructions
1. First, write a brief **rationale** explaining your composition strategy:
   - Why you chose this pipeline mode
   - How outputs from one step become inputs to the next
   - How --auto vs --manual modes are handled
2. Then output the complete WiringPlan YAML in a \`\`\`yaml code fence.
3. The YAML must be self-contained and valid. Do not use placeholders.
4. Make sure every step output that is referenced in a later step is bound via \`outputs.bind\`.
`
  }
}
