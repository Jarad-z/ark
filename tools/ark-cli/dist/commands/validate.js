import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadDescriptor, WiringPlanSchema, ValidationError } from '@ark/core';
import { DescriptorNotFoundError } from '@ark/core';
import * as yaml from 'js-yaml';
export function validateCli(id, monorepoRoot) {
    const name = id.includes('/') ? id.split('/').slice(1).join('/') : id;
    const searchDirs = [
        join(monorepoRoot, 'packages', name),
        join(monorepoRoot, 'tools', name),
    ];
    let pkgDir = null;
    for (const dir of searchDirs) {
        if (existsSync(join(dir, 'ark-descriptor.yaml'))) {
            pkgDir = dir;
            break;
        }
    }
    if (!pkgDir)
        throw new DescriptorNotFoundError(id);
    const errors = [];
    // Validate descriptor
    try {
        loadDescriptor(pkgDir);
        process.stdout.write(`  ✓ ark-descriptor.yaml\n`);
    }
    catch (err) {
        if (err instanceof ValidationError) {
            errors.push(...err.issues.map((i) => `descriptor: ${i}`));
            process.stdout.write(`  ✗ ark-descriptor.yaml: ${err.message}\n`);
        }
    }
    // Validate wiring if present
    const wiringPath = join(pkgDir, 'ark-wiring.yaml');
    if (existsSync(wiringPath)) {
        try {
            const raw = yaml.load(readFileSync(wiringPath, 'utf8'));
            const result = WiringPlanSchema.safeParse(raw);
            if (result.success) {
                process.stdout.write(`  ✓ ark-wiring.yaml (${result.data.steps.length} steps)\n`);
            }
            else {
                const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
                errors.push(...issues.map((i) => `wiring: ${i}`));
                process.stdout.write(`  ✗ ark-wiring.yaml\n`);
                for (const issue of issues) {
                    process.stdout.write(`    - ${issue}\n`);
                }
            }
        }
        catch (err) {
            errors.push(`wiring: ${String(err)}`);
            process.stdout.write(`  ✗ ark-wiring.yaml: ${String(err)}\n`);
        }
    }
    if (errors.length === 0) {
        process.stdout.write(`\n✓ ${id} is valid.\n\n`);
    }
    else {
        process.stdout.write(`\n✗ ${id} has ${errors.length} error(s).\n\n`);
        process.exit(1);
    }
}
//# sourceMappingURL=validate.js.map