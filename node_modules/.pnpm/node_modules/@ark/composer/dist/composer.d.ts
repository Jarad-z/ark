import type { AiBridge } from '@ark/ai-bridge';
export interface ComposerOptions {
    monorepoRoot?: string;
    bridge?: AiBridge;
}
export declare class Composer {
    private monorepoRoot;
    private bridge;
    constructor(options?: ComposerOptions);
    compose(requestPath: string): Promise<string>;
    private loadRequest;
}
//# sourceMappingURL=composer.d.ts.map