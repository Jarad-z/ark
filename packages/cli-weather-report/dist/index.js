#!/usr/bin/env node
import { MultiCommandRunner } from '@ark/runtime';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const runner = new MultiCommandRunner({
    packageDir: join(__dirname, '..'),
    composedCliId: '@ark/cli-weather-report',
    monorepoRoot: join(__dirname, '..', '..', '..'),
});
const argv = process.argv.slice(2);
if (!argv[0] || argv[0] === '--help' || argv[0] === '-h') {
    runner.printHelp();
    process.exit(0);
}
const result = await runner.run(argv);
if (!result.success)
    process.exit(1);
//# sourceMappingURL=index.js.map