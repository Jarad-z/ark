import type { XhsInput, XhsOutput } from './types.js';
interface BuildCommandsOptions {
    sessionPath: string;
    input: XhsInput;
}
export declare function buildAgentBrowserCommands(options: BuildCommandsOptions): string[];
export declare function postToXhs(input: XhsInput, sessionPath: string): Promise<XhsOutput>;
export {};
//# sourceMappingURL=post-xhs.d.ts.map