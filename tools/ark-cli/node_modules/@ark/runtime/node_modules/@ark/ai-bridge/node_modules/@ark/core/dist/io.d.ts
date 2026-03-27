/**
 * Helpers for the JSON-over-stdio contract between parent runtime and child CLIs.
 *
 * Protocol:
 *   - Parent passes input as JSON in env var ARK_INPUT_PAYLOAD
 *   - Child writes output as a sentinel-prefixed line to stdout:
 *       ARK_OUTPUT:<json>
 *   - Child exit codes: 0 = success, 1 = error, 2 = user-cancelled
 */
export declare const ARK_INPUT_ENV = "ARK_INPUT_PAYLOAD";
export declare const ARK_OUTPUT_PREFIX = "ARK_OUTPUT:";
export declare const EXIT_CODE_SUCCESS = 0;
export declare const EXIT_CODE_ERROR = 1;
export declare const EXIT_CODE_CANCELLED = 2;
/**
 * Read and parse the input payload from the environment.
 * Call this at the start of any leaf CLI that participates in Ark pipelines.
 */
export declare function readInputPayload<T = Record<string, unknown>>(): T | undefined;
/**
 * Write the output payload to stdout using the ARK_OUTPUT: sentinel prefix.
 * This must be called before process.exit(0) in any leaf CLI.
 */
export declare function writeOutput(output: unknown): void;
/**
 * Parse an ARK_OUTPUT line from a child process's stdout.
 * Returns undefined if the line is not an ARK_OUTPUT line.
 */
export declare function parseOutputLine(line: string): unknown | undefined;
//# sourceMappingURL=io.d.ts.map