/**
 * Helpers for the JSON-over-stdio contract between parent runtime and child CLIs.
 *
 * Protocol:
 *   - Parent passes input as JSON in env var ARK_INPUT_PAYLOAD
 *   - Child writes output as a sentinel-prefixed line to stdout:
 *       ARK_OUTPUT:<json>
 *   - Child exit codes: 0 = success, 1 = error, 2 = user-cancelled
 */

export const ARK_INPUT_ENV = 'ARK_INPUT_PAYLOAD'
export const ARK_OUTPUT_PREFIX = 'ARK_OUTPUT:'
export const EXIT_CODE_SUCCESS = 0
export const EXIT_CODE_ERROR = 1
export const EXIT_CODE_CANCELLED = 2

/**
 * Read and parse the input payload from the environment.
 * Call this at the start of any leaf CLI that participates in Ark pipelines.
 */
export function readInputPayload<T = Record<string, unknown>>(): T | undefined {
  const raw = process.env[ARK_INPUT_ENV]
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    process.stderr.write(`[ark] Failed to parse ARK_INPUT_PAYLOAD: ${raw}\n`)
    return undefined
  }
}

/**
 * Write the output payload to stdout using the ARK_OUTPUT: sentinel prefix.
 * This must be called before process.exit(0) in any leaf CLI.
 */
export function writeOutput(output: unknown): void {
  process.stdout.write(`${ARK_OUTPUT_PREFIX}${JSON.stringify(output)}\n`)
}

/**
 * Parse an ARK_OUTPUT line from a child process's stdout.
 * Returns undefined if the line is not an ARK_OUTPUT line.
 */
export function parseOutputLine(line: string): unknown | undefined {
  if (!line.startsWith(ARK_OUTPUT_PREFIX)) return undefined
  const json = line.slice(ARK_OUTPUT_PREFIX.length)
  return JSON.parse(json)
}
