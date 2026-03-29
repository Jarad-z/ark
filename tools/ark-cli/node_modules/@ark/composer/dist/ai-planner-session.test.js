"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ai_planner_session_js_1 = require("./ai-planner-session.js");
const parallelPlanYaml = `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential
steps:
  - id: fetch-weather
    uses: "@ark/cli-weather"
    outputs:
      bind:
        weatherData: "."
  - id: fetch-news
    uses: "@ark/cli-news"
    outputs:
      bind:
        newsData: "."
  - id: generate
    uses: "@ark/cli-report"
    inputs:
      weather: "{{ ctx.bindings.weatherData }}"
      news: "{{ ctx.bindings.newsData }}"
`;
const mockBridge = {
    planComposition: vitest_1.vi.fn().mockResolvedValue({
        wiringYaml: parallelPlanYaml,
        rationale: 'test plan',
    }),
};
(0, vitest_1.describe)('AiPlannerSession parallel detection', () => {
    (0, vitest_1.it)('detects parallelizable steps and returns suggestion', async () => {
        const session = new ai_planner_session_js_1.AiPlannerSession(mockBridge);
        const result = await session.run({
            apiVersion: 'ark/v1',
            kind: 'ComposeRequest',
            output: { id: 'test', targetDirectory: '.' },
            parents: [],
            intent: 'test',
            constraints: [],
        }, new Map());
        (0, vitest_1.expect)(result.parallelSuggestion).toBeDefined();
        (0, vitest_1.expect)(result.parallelSuggestion?.stepIds).toContain('fetch-weather');
        (0, vitest_1.expect)(result.parallelSuggestion?.stepIds).toContain('fetch-news');
        (0, vitest_1.expect)(result.parallelSuggestion?.stepIds).not.toContain('generate');
        (0, vitest_1.expect)(result.parallelSuggestion?.recommendation).toBe('failFast');
    });
    (0, vitest_1.it)('returns no suggestion when all steps are sequential (chained)', async () => {
        const sequentialBridge = {
            planComposition: vitest_1.vi.fn().mockResolvedValue({
                wiringYaml: `
apiVersion: ark/v1
kind: WiringPlan
pipeline:
  mode: sequential
steps:
  - id: a
    uses: "@ark/cli-a"
    outputs:
      bind:
        aOut: "."
  - id: b
    uses: "@ark/cli-b"
    inputs:
      data: "{{ ctx.bindings.aOut }}"
`,
                rationale: 'sequential',
            }),
        };
        const session = new ai_planner_session_js_1.AiPlannerSession(sequentialBridge);
        const result = await session.run({
            apiVersion: 'ark/v1',
            kind: 'ComposeRequest',
            output: { id: 'test', targetDirectory: '.' },
            parents: [],
            intent: 'test',
            constraints: [],
        }, new Map());
        (0, vitest_1.expect)(result.parallelSuggestion).toBeUndefined();
    });
});
//# sourceMappingURL=ai-planner-session.test.js.map