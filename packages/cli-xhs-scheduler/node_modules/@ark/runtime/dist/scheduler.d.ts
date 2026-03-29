export interface SchedulerOptions {
    dag: Map<string, string[]>;
    concurrency: number;
    parallelBehavior: 'failFast' | 'waitAll';
    runStep: (id: string, signal: AbortSignal) => Promise<void>;
}
export declare class Scheduler {
    private opts;
    private done;
    private failed;
    private running;
    private controller;
    constructor(opts: SchedulerOptions);
    run(): Promise<void>;
}
//# sourceMappingURL=scheduler.d.ts.map