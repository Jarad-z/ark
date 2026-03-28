export declare class ArkError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare class PortBindingError extends ArkError {
    constructor(message: string);
}
export declare class StepExecutionError extends ArkError {
    readonly stepId: string;
    readonly cause?: unknown | undefined;
    constructor(message: string, stepId: string, cause?: unknown | undefined);
}
export declare class ValidationError extends ArkError {
    readonly issues: string[];
    constructor(message: string, issues: string[]);
}
export declare class DescriptorNotFoundError extends ArkError {
    constructor(id: string);
}
//# sourceMappingURL=errors.d.ts.map