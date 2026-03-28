#!/usr/bin/env node
import { readInputPayload, writeOutput } from '@ark/core';
import { postToX } from './post-x.js';
const payload = readInputPayload();
const args = process.argv.slice(2);
function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
}
const body = payload?.body ?? getFlag('--body');
const tagsRaw = payload?.tags ?? getFlag('--tags');
const tags = Array.isArray(tagsRaw)
    ? tagsRaw
    : typeof tagsRaw === 'string'
        ? tagsRaw.split(',').map(t => t.trim())
        : [];
if (!body) {
    process.stderr.write('[ark:cli-x] Error: body is required\n');
    process.exit(1);
}
const sessionPath = process.env['X_SESSION_PATH'];
if (!sessionPath) {
    process.stderr.write('[ark:cli-x] Error: X_SESSION_PATH env var is required\n');
    process.exit(1);
}
try {
    const result = await postToX({ body, tags }, sessionPath);
    writeOutput(result);
    process.exit(0);
}
catch (err) {
    process.stderr.write(`[ark:cli-x] Error: ${String(err)}\n`);
    process.exit(1);
}
//# sourceMappingURL=index.js.map