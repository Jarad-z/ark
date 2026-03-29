export interface WrapOptions {
    /** npm-style package id, e.g. "@my-org/cli-feishu-adapter" */
    id: string;
    /** third-party CLI binary name, e.g. "feishu" */
    cli: string;
    /** full CLI subcommand to invoke, e.g. "message send" */
    cmd: string;
    /** output directory (absolute or relative to cwd) */
    outDir: string;
    /** monorepo root (for resolving relative outDir) */
    monorepoRoot: string;
}
/**
 * Scaffolds a leaf CLI adapter package that wraps a third-party CLI binary.
 *
 * Generated structure:
 *   <outDir>/
 *     src/index.ts
 *     src/types.ts
 *     ark-descriptor.yaml
 *     package.json
 *     tsconfig.json
 */
export declare function wrapCli(options: WrapOptions): void;
//# sourceMappingURL=wrap.d.ts.map