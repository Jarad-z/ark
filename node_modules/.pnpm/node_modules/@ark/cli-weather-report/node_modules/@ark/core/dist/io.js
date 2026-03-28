"use strict";
/**
 * Helpers for the JSON-over-stdio contract between parent runtime and child CLIs.
 *
 * Protocol:
 *   - Parent passes input as JSON in env var ARK_INPUT_PAYLOAD
 *   - Child writes output as a sentinel-prefixed line to stdout:
 *       ARK_OUTPUT:<json>
 *   - Child exit codes: 0 = success, 1 = error, 2 = user-cancelled
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXIT_CODE_CANCELLED = exports.EXIT_CODE_ERROR = exports.EXIT_CODE_SUCCESS = exports.ARK_OUTPUT_PREFIX = exports.ARK_INPUT_ENV = void 0;
exports.readInputPayload = readInputPayload;
exports.writeOutput = writeOutput;
exports.parseOutputLine = parseOutputLine;
exports.ARK_INPUT_ENV = 'ARK_INPUT_PAYLOAD';
exports.ARK_OUTPUT_PREFIX = 'ARK_OUTPUT:';
exports.EXIT_CODE_SUCCESS = 0;
exports.EXIT_CODE_ERROR = 1;
exports.EXIT_CODE_CANCELLED = 2;
/**
 * Read and parse the input payload from the environment.
 * Call this at the start of any leaf CLI that participates in Ark pipelines.
 */
function readInputPayload() {
    const raw = process.env[exports.ARK_INPUT_ENV];
    if (!raw)
        return undefined;
    try {
        return JSON.parse(raw);
    }
    catch {
        process.stderr.write(`[ark] Failed to parse ARK_INPUT_PAYLOAD: ${raw}\n`);
        return undefined;
    }
}
/**
 * Write the output payload to stdout using the ARK_OUTPUT: sentinel prefix.
 * This must be called before process.exit(0) in any leaf CLI.
 */
function writeOutput(output) {
    process.stdout.write(`${exports.ARK_OUTPUT_PREFIX}${JSON.stringify(output)}\n`);
}
/**
 * Parse an ARK_OUTPUT line from a child process's stdout.
 * Returns undefined if the line is not an ARK_OUTPUT line.
 */
function parseOutputLine(line) {
    if (!line.startsWith(exports.ARK_OUTPUT_PREFIX))
        return undefined;
    const json = line.slice(exports.ARK_OUTPUT_PREFIX.length);
    return JSON.parse(json);
}
//# sourceMappingURL=io.js.map