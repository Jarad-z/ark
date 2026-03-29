"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiPlannerSession = void 0;
const core_1 = require("@ark/core");
const yaml = __importStar(require("js-yaml"));
const composition_prompt_builder_js_1 = require("./composition-prompt-builder.js");
/**
 * Returns true if stepB depends on an output binding produced by stepA.
 */
function hasDataDependency(stepA, stepB) {
    const aBindings = new Set(Object.keys(stepA.outputs?.bind ?? {}));
    const bInputValues = Object.values(stepB.inputs ?? {});
    return bInputValues.some(v => typeof v === 'string' && [...aBindings].some(b => v.includes(`ctx.bindings.${b}`)));
}
/**
 * Returns steps that do not consume any output binding from any other step
 * in the plan (i.e. steps with no inferred data dependencies).
 */
function findIndependentSteps(steps) {
    return steps.filter(step => !steps.some(other => other.id !== step.id && hasDataDependency(other, step)));
}
function detectParallelSuggestion(wiringYaml) {
    const parsed = core_1.WiringPlanSchema.safeParse(yaml.load(wiringYaml));
    if (!parsed.success) {
        return undefined;
    }
    const steps = parsed.data.steps;
    const independentSteps = findIndependentSteps(steps);
    if (independentSteps.length < 2) {
        return undefined;
    }
    // If all independent steps produce bindings that are consumed downstream → failFast
    const allOutputsUsed = independentSteps.every(s => Object.keys(s.outputs?.bind ?? {}).some(binding => steps.some(other => other.id !== s.id &&
        JSON.stringify(other.inputs ?? {}).includes(`ctx.bindings.${binding}`))));
    return {
        stepIds: independentSteps.map(s => s.id),
        sequentialMs: 0,
        recommendation: allOutputsUsed ? 'failFast' : 'waitAll',
        reason: allOutputsUsed
            ? 'All parallel results are required downstream — failFast avoids wasted work on failure.'
            : 'Not all results are required downstream — waitAll allows partial success.',
    };
}
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
        const parallelSuggestion = detectParallelSuggestion(result.wiringYaml);
        return {
            ...result,
            prompt,
            ...(parallelSuggestion !== undefined ? { parallelSuggestion } : {}),
        };
    }
}
exports.AiPlannerSession = AiPlannerSession;
//# sourceMappingURL=ai-planner-session.js.map