import type { ComposeRequest, CliDescriptor } from '@ark/core';
import type { LineageData } from './lineage-writer.js';
export interface ScaffoldOptions {
    monorepoRoot: string;
    request: ComposeRequest;
    descriptors: Map<string, CliDescriptor>;
    /** Single wiring YAML (single-command) or map of command→wiring (multi-command) */
    wiringYaml: string | Map<string, string>;
    lineage: LineageData;
}
/**
 * Creates the composed CLI package directory with all required files.
 */
export declare class PackageScaffolder {
    scaffold(options: ScaffoldOptions): string;
    private writeDescriptor;
    private writeWiring;
    private writePackageJson;
    private writeTsConfig;
    private writeEntrypoint;
    private inferFlags;
}
//# sourceMappingURL=package-scaffolder.d.ts.map