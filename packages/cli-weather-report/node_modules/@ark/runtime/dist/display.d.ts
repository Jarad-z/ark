export interface StepTiming {
    id: string;
    elapsedMs: number;
}
export interface DisplayOptions {
    isTTY?: boolean;
    write?: (line: string) => void;
}
export type StepState = 'pending' | 'waiting' | 'running' | 'done' | 'failed' | 'skipped' | 'cancelled';
export declare class Display {
    private isTTY;
    private write;
    private rows;
    private pipelineRunId;
    private pipelineMode;
    private timer?;
    private _lastLineCount;
    constructor(opts?: DisplayOptions);
    pipelineStart(opts: {
        runId: string;
        mode: string;
        stepCount: number;
    }): void;
    pipelineDone(wallMs: number, timings: StepTiming[], sequentialMs: number): void;
    pipelineFailed(wallMs: number, err: Error): void;
    registerStep(id: string, uses: string, deps: string[]): void;
    stepWaiting(id: string): void;
    stepStart(id: string, uses: string, deps: string[]): void;
    stepDone(id: string, elapsedMs: number): void;
    stepFailed(id: string, err: Error, elapsedMs: number): void;
    stepSkipped(id: string): void;
    stepCancelled(id: string): void;
    lineageStep(stepId: string, lineageId: string, state: StepState, elapsedMs?: number): void;
    private startPanel;
    private stopPanel;
    private render;
    private printTimingSummary;
    private setState;
}
//# sourceMappingURL=display.d.ts.map