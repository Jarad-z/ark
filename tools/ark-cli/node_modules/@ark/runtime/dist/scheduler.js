export class Scheduler {
    opts;
    done = new Set();
    failed = new Set();
    running = new Set();
    controller = new AbortController();
    constructor(opts) {
        this.opts = opts;
    }
    async run() {
        const { dag, concurrency, parallelBehavior, runStep } = this.opts;
        const errors = [];
        const promises = new Map();
        const isReady = (id) => !this.done.has(id) &&
            !this.running.has(id) &&
            !this.failed.has(id) &&
            (dag.get(id) ?? []).every(dep => this.done.has(dep));
        const startStep = (id) => {
            this.running.add(id);
            const p = runStep(id, this.controller.signal)
                .then(() => {
                this.running.delete(id);
                this.done.add(id);
            })
                .catch((err) => {
                this.running.delete(id);
                this.failed.add(id);
                errors.push(err instanceof Error ? err : new Error(String(err)));
                if (parallelBehavior === 'failFast') {
                    this.controller.abort();
                }
            });
            promises.set(id, p);
            return p;
        };
        while (this.done.size + this.failed.size < dag.size) {
            // Fill up to concurrency limit with ready steps
            for (const id of dag.keys()) {
                if (this.running.size >= concurrency)
                    break;
                if (isReady(id))
                    startStep(id);
            }
            if (this.running.size === 0) {
                // Deadlock: no steps running and not all done — remaining deps failed
                break;
            }
            // Wait for at least one running step to settle
            await Promise.race([...this.running].map(id => promises.get(id)));
        }
        // In waitAll mode, ensure all started steps have fully settled
        if (parallelBehavior === 'waitAll' && promises.size > 0) {
            await Promise.allSettled([...promises.values()]);
        }
        if (errors.length > 0)
            throw errors[0];
    }
}
//# sourceMappingURL=scheduler.js.map