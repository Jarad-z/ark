"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiPlannerSession = void 0;
const composition_prompt_builder_js_1 = require("./composition-prompt-builder.js");
class AiPlannerSession {
    bridge;
    builder = new composition_prompt_builder_js_1.CompositionPromptBuilder();
    constructor(bridge) {
        this.bridge = bridge;
    }
    async run(request, descriptors) {
        const prompt = this.builder.build(request, descriptors);
        process.stderr.write('[ark:composer] Calling AI to generate wiring plan...\n');
        const result = await this.bridge.planComposition(prompt);
        process.stderr.write('[ark:composer] AI response received.\n');
        return { ...result, prompt };
    }
}
exports.AiPlannerSession = AiPlannerSession;
//# sourceMappingURL=ai-planner-session.js.map