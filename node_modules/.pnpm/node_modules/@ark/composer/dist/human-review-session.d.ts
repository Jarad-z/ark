export interface ReviewResult {
    wiringYaml: string;
    humanEdits: string | undefined;
    accepted: boolean;
}
/**
 * Presents the AI-proposed WiringPlan YAML to the user in the terminal.
 * Options: accept / edit in $EDITOR / reject and re-prompt.
 */
export declare class HumanReviewSession {
    review(rationale: string, wiringYaml: string): Promise<ReviewResult>;
    private printProposal;
    private prompt;
    private openInEditor;
    private validateOrThrow;
    private diffSummary;
}
//# sourceMappingURL=human-review-session.d.ts.map