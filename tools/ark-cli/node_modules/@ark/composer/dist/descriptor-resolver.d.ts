import type { CliDescriptor } from '@ark/core';
/**
 * Finds ark-descriptor.yaml files for parent CLI IDs within the monorepo.
 *
 * Resolution order:
 * 1. packages/<name> where name = id without @scope/  (e.g. @ark/cli-xhs → packages/cli-xhs)
 * 2. tools/<name>
 * 3. Any direct path passed in searchRoots
 */
export declare class DescriptorResolver {
    private searchRoots;
    constructor(monorepoRoot: string, extraSearchRoots?: string[]);
    resolve(id: string): CliDescriptor;
    resolveAll(ids: string[]): Map<string, CliDescriptor>;
    private findPackageDir;
}
//# sourceMappingURL=descriptor-resolver.d.ts.map