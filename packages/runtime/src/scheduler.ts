export interface SchedulerOptions {
  dag: Map<string, string[]>           // stepId → [dep stepIds]
  concurrency: number                  // max simultaneous steps (use Infinity for unlimited)
  parallelBehavior: 'failFast' | 'waitAll'
  runStep: (id: string, signal: AbortSignal) => Promise<void>
}

export class Scheduler {
  private opts: SchedulerOptions
  private done = new Set<string>()
  private failed = new Set<string>()
  private running = new Set<string>()
  private controller = new AbortController()

  constructor(opts: SchedulerOptions) {
    this.opts = opts
  }

  async run(): Promise<void> {
    const { dag, concurrency, parallelBehavior, runStep } = this.opts
    const errors: Error[] = []
    const promises = new Map<string, Promise<void>>()

    const isReady = (id: string) =>
      !this.done.has(id) &&
      !this.running.has(id) &&
      !this.failed.has(id) &&
      (dag.get(id) ?? []).every(dep => this.done.has(dep))

    const startStep = (id: string) => {
      this.running.add(id)
      const p = runStep(id, this.controller.signal)
        .then(() => {
          this.running.delete(id)
          this.done.add(id)
        })
        .catch((err: Error) => {
          this.running.delete(id)
          this.failed.add(id)
          errors.push(err)
          if (parallelBehavior === 'failFast') {
            this.controller.abort()
          }
        })
      promises.set(id, p)
      return p
    }

    while (this.done.size + this.failed.size < dag.size) {
      // Fill up to concurrency limit with ready steps
      for (const id of dag.keys()) {
        if (this.running.size >= concurrency) break
        if (isReady(id)) startStep(id)
      }

      if (this.running.size === 0) {
        // Deadlock: no steps running and not all done — remaining deps failed
        break
      }

      // Wait for at least one running step to settle
      await Promise.race([...this.running].map(id => promises.get(id)!))
    }

    // In waitAll mode, ensure all started steps have fully settled
    if (parallelBehavior === 'waitAll' && promises.size > 0) {
      await Promise.allSettled([...promises.values()])
    }

    if (errors.length > 0) throw errors[0]
  }
}
