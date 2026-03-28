import { createInterface } from 'node:readline';
/**
 * builtin/human-review
 * Presents the payload to the user and waits for approval or inline edit.
 * In --dry-run mode, auto-approves without prompting.
 */
export async function humanReview(inputs, ctx) {
    if (ctx.dryRun) {
        process.stdout.write('[ark:runtime] [dry-run] Skipping human-review step.\n');
        return { output: { approved: inputs['payload'] } };
    }
    const payload = inputs['payload'];
    process.stdout.write('\n' + '─'.repeat(60) + '\n');
    process.stdout.write('REVIEW REQUIRED:\n\n');
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    process.stdout.write('─'.repeat(60) + '\n');
    const choice = await promptLine('[ark:runtime] Approve? [y]es / [e]dit (as JSON) / [n]o cancel: ');
    if (choice === 'n' || choice === 'no') {
        process.exit(2); // EXIT_CODE_CANCELLED
    }
    if (choice === 'e' || choice === 'edit') {
        const raw = await promptLine('Enter edited JSON (single line): ');
        try {
            const edited = JSON.parse(raw);
            return { output: { approved: edited } };
        }
        catch {
            process.stderr.write('[ark:runtime] Invalid JSON, using original payload.\n');
        }
    }
    return { output: { approved: payload } };
}
/**
 * builtin/log
 * Writes a message to stdout.
 */
export async function log(inputs) {
    const message = typeof inputs['message'] === 'string' ? inputs['message'] : JSON.stringify(inputs['message']);
    process.stdout.write(message + '\n');
    return { output: {} };
}
/**
 * builtin/conditional
 * Passes `value` through if `condition` is truthy, otherwise skips.
 */
export async function conditional(inputs) {
    if (inputs['condition']) {
        return { output: { value: inputs['value'] } };
    }
    return { output: {}, skipped: true };
}
function promptLine(question) {
    return new Promise((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
        process.stdout.write(question);
        rl.once('line', (line) => {
            rl.close();
            resolve(line.trim().toLowerCase());
        });
    });
}
//# sourceMappingURL=builtin-steps.js.map