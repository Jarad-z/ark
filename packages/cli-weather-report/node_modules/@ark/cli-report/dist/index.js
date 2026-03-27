#!/usr/bin/env node
import { readInputPayload, writeOutput } from '@ark/core';
import { createAiBridge } from '@ark/ai-bridge';
import { generateReport } from './generate-report.js';
import { saveReport } from './save-report.js';
const payload = readInputPayload();
// Argv fallback for direct invocation
const args = process.argv.slice(2);
function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
}
const style = payload?.style ?? getFlag('--style') ?? 'casual daily report';
const outputDir = payload?.outputDir ?? getFlag('--output-dir') ?? './reports';
const weatherData = payload?.weatherData;
if (!weatherData) {
    process.stderr.write('[ark:cli-report] Error: weatherData input is required.\n');
    process.exit(1);
}
try {
    const bridge = createAiBridge();
    const report = await generateReport(weatherData, style, bridge);
    const savedPath = saveReport(report, outputDir);
    process.stdout.write(`[ark:cli-report] Report saved to: ${savedPath}\n`);
    writeOutput({
        city: report.city,
        report: report.report,
        savedPath,
        generatedAt: report.generatedAt,
    });
    process.exit(0);
}
catch (err) {
    process.stderr.write(`[ark:cli-report] Error: ${String(err)}\n`);
    process.exit(1);
}
//# sourceMappingURL=index.js.map