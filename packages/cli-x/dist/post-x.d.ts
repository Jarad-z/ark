import type { XInput, XOutput } from './types.js';
interface BuildCommandsOptions {
    sessionPath: string;
    input: XInput;
}
export declare function buildAgentBrowserCommands(options: BuildCommandsOptions): string[];
export declare function postToX(input: XInput, sessionPath: string): Promise<XOutput>;
export {};
//# sourceMappingURL=post-x.d.ts.map