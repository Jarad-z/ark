#!/usr/bin/env node
import { PipelineRunner } from '@ark/runtime';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const runner = new PipelineRunner({
    wiringPath: join(__dirname, '..', 'ark-wiring.yaml'),
    composedCliId: '@ark/cli-weather-report',
    monorepoRoot: join(__dirname, '..', '..', '..'),
});
const result = await runner.run(process.argv.slice(2));
if (!result.success) {
    process.exit(1);
}
//# sourceMappingURL=index.js.map