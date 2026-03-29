export interface StepTiming {
  id: string
  elapsedMs: number
}

export interface DisplayOptions {
  isTTY?: boolean
  write?: (line: string) => void
}

export type StepState = 'pending' | 'waiting' | 'running' | 'done' | 'failed' | 'skipped' | 'cancelled'

interface StepRow {
  id: string
  uses: string
  state: StepState
  startedAt?: number
  elapsedMs?: number
  detail?: string
  deps: string[]
  lineage: Array<{ id: string; state: StepState; elapsedMs?: number }>
}

const STATE_COLOR: Record<StepState, string> = {
  pending:   '\x1b[2m',
  waiting:   '\x1b[33m',
  running:   '\x1b[36m',
  done:      '\x1b[32m',
  failed:    '\x1b[31m',
  skipped:   '\x1b[2m',
  cancelled: '\x1b[33m',
}
const RESET = '\x1b[0m'

export class Display {
  private isTTY: boolean
  private write: (line: string) => void
  private rows: Map<string, StepRow> = new Map()
  private pipelineRunId = ''
  private pipelineMode = ''
  private timer?: ReturnType<typeof setInterval>
  private _lastLineCount = 0

  constructor(opts: DisplayOptions = {}) {
    this.isTTY = opts.isTTY ?? (process.stdout.isTTY === true)
    this.write = opts.write ?? ((line) => process.stderr.write(line + '\n'))
  }

  pipelineStart(opts: { runId: string; mode: string; stepCount: number }) {
    this.pipelineRunId = opts.runId
    this.pipelineMode = opts.mode
    if (this.isTTY) {
      this.startPanel()
    } else {
      this.write(`[ark][pipeline] start  runId=${opts.runId}  mode=${opts.mode}  steps=${opts.stepCount}`)
    }
  }

  pipelineDone(wallMs: number, timings: StepTiming[], sequentialMs: number) {
    if (this.isTTY) {
      this.stopPanel()
    } else {
      this.write(`[ark][pipeline] done  elapsed=${fmtMs(wallMs)}`)
    }
    this.printTimingSummary(wallMs, timings, sequentialMs)
  }

  pipelineFailed(wallMs: number, err: Error) {
    if (this.isTTY) this.stopPanel()
    this.write(`[ark][pipeline] failed  elapsed=${fmtMs(wallMs)}  error=${err.message}`)
  }

  registerStep(id: string, uses: string, deps: string[]) {
    this.rows.set(id, { id, uses, state: 'pending', deps, lineage: [] })
  }

  stepWaiting(id: string) { this.setState(id, 'waiting') }

  stepStart(id: string, uses: string, deps: string[]) {
    const row = this.rows.get(id)
    if (row) {
      row.state = 'running'
      row.startedAt = Date.now()
    }
    if (!this.isTTY) {
      this.write(`[ark][step:${id}] start  uses=${uses}  deps=[${deps.join(',')}]`)
    }
  }

  stepDone(id: string, elapsedMs: number) {
    const row = this.rows.get(id)
    if (row) { row.state = 'done'; row.elapsedMs = elapsedMs }
    if (!this.isTTY) this.write(`[ark][step:${id}] done  elapsed=${fmtMs(elapsedMs)}`)
  }

  stepFailed(id: string, err: Error, elapsedMs: number) {
    const row = this.rows.get(id)
    if (row) { row.state = 'failed'; row.elapsedMs = elapsedMs; row.detail = err.message }
    if (!this.isTTY) this.write(`[ark][step:${id}] failed  elapsed=${fmtMs(elapsedMs)}  error=${err.message}`)
  }

  stepSkipped(id: string) { this.setState(id, 'skipped') }
  stepCancelled(id: string) { this.setState(id, 'cancelled') }

  lineageStep(stepId: string, lineageId: string, state: StepState, elapsedMs?: number) {
    const row = this.rows.get(stepId)
    if (row) {
      const existing = row.lineage.find(l => l.id === lineageId)
      if (existing) {
        existing.state = state
        if (elapsedMs !== undefined) existing.elapsedMs = elapsedMs
      } else {
        const entry: { id: string; state: StepState; elapsedMs?: number } = { id: lineageId, state }
        if (elapsedMs !== undefined) entry.elapsedMs = elapsedMs
        row.lineage.push(entry)
      }
    }
    if (!this.isTTY) {
      const suffix = elapsedMs != null ? `  elapsed=${fmtMs(elapsedMs)}` : ''
      this.write(`[ark][step:${stepId}][lineage:${lineageId}] ${state}${suffix}`)
    }
  }

  private startPanel() {
    this.render()
    this.timer = setInterval(() => this.render(), 100)
  }

  private stopPanel() {
    if (this.timer) clearInterval(this.timer)
    this.render()
  }

  private render() {
    const lines: string[] = []
    const allDone = [...this.rows.values()].every(r =>
      r.state === 'done' || r.state === 'skipped' || r.state === 'failed' || r.state === 'cancelled'
    )
    const wallElapsed = [...this.rows.values()]
      .filter(r => r.startedAt)
      .reduce((max, r) => Math.max(max, r.elapsedMs ?? Date.now() - r.startedAt!), 0)

    lines.push(`\x1b[1mPipeline:\x1b[0m ${this.pipelineRunId}  [${allDone ? 'done' : 'running'}]  ${fmtMs(wallElapsed)}`)
    lines.push('')

    for (const row of this.rows.values()) {
      const elapsed = row.elapsedMs != null
        ? fmtMs(row.elapsedMs)
        : row.startedAt ? fmtMs(Date.now() - row.startedAt) : ''
      const color = STATE_COLOR[row.state]
      const detail = row.state === 'waiting' && row.deps.length
        ? `deps: ${row.deps.join(', ')}`
        : (row.detail ?? '')
      lines.push(`  ◆ ${row.id.padEnd(20)} ${color}[${row.state}]${RESET}  ${elapsed.padEnd(6)}  ${detail}`)
      for (const lin of row.lineage) {
        const lColor = STATE_COLOR[lin.state]
        const lElapsed = lin.elapsedMs != null ? fmtMs(lin.elapsedMs) : ''
        lines.push(`    ◇ ${lin.id.padEnd(18)} ${lColor}[${lin.state}]${RESET}  ${lElapsed.padEnd(6)}  (lineage)`)
      }
    }

    if (this._lastLineCount > 0) {
      process.stderr.write(`\x1b[${this._lastLineCount}A`)
    }
    process.stderr.write(lines.join('\n') + '\n')
    this._lastLineCount = lines.length
  }

  private printTimingSummary(wallMs: number, timings: StepTiming[], sequentialMs: number) {
    if (timings.length === 0) return
    const lines = ['', 'Step timing summary:']
    const maxLen = Math.max(...timings.map(t => t.id.length))
    for (const t of timings) {
      lines.push(`  ${t.id.padEnd(maxLen)}  ${fmtMs(t.elapsedMs)}`)
    }
    lines.push(`  ${'─'.repeat(maxLen + 8)}`)
    lines.push(`  total wall time  ${fmtMs(wallMs)}  (sequential would have been ${fmtMs(sequentialMs)})`)
    lines.push('')
    for (const l of lines) this.write(l)
  }

  private setState(id: string, state: StepState) {
    const row = this.rows.get(id)
    if (row) row.state = state
  }
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}
