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
exports.Composer = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const yaml = __importStar(require("js-yaml"));
const core_1 = require("@ark/core");
const ai_bridge_1 = require("@ark/ai-bridge");
const descriptor_resolver_js_1 = require("./descriptor-resolver.js");
const ai_planner_session_js_1 = require("./ai-planner-session.js");
const human_review_session_js_1 = require("./human-review-session.js");
const package_scaffolder_js_1 = require("./package-scaffolder.js");
const lineage_writer_js_1 = require("./lineage-writer.js");
class Composer {
    monorepoRoot;
    bridge;
    constructor(options = {}) {
        this.monorepoRoot = options.monorepoRoot ?? process.cwd();
        this.bridge = options.bridge ?? (0, ai_bridge_1.createAiBridge)();
    }
    async compose(requestPath) {
        // 1. Load and validate compose request
        const request = this.loadRequest(requestPath);
        // 2. Resolve parent descriptors
        const resolver = new descriptor_resolver_js_1.DescriptorResolver(this.monorepoRoot);
        const descriptors = resolver.resolveAll(request.parents.map((p) => p.id));
        // 3. AI generates wiring plan
        const planner = new ai_planner_session_js_1.AiPlannerSession(this.bridge);
        const plannerResult = await planner.run(request, descriptors);
        // 4. Human reviews (loop until accepted or rejected)
        const reviewer = new human_review_session_js_1.HumanReviewSession();
        let reviewResult = await reviewer.review(plannerResult.rationale, plannerResult.wiringYaml);
        while (!reviewResult.accepted) {
            process.stderr.write('[ark:composer] Plan rejected. Re-running AI with amended prompt...\n');
            const amendedResult = await planner.run(request, descriptors);
            reviewResult = await reviewer.review(amendedResult.rationale, amendedResult.wiringYaml);
        }
        // 5. Build lineage
        const lineage = (0, lineage_writer_js_1.buildLineage)(request, descriptors, plannerResult, reviewResult.humanEdits);
        // 6. Scaffold the package
        const scaffolder = new package_scaffolder_js_1.PackageScaffolder();
        const targetDir = scaffolder.scaffold({
            monorepoRoot: this.monorepoRoot,
            request,
            descriptors,
            wiringYaml: reviewResult.wiringYaml,
            lineage,
        });
        process.stdout.write(`\n[ark:composer] ✓ Created composed CLI at: ${targetDir}\n`);
        process.stdout.write(`[ark:composer] Next: pnpm install && pnpm --filter ${request.output.id} build\n`);
        return targetDir;
    }
    loadRequest(requestPath) {
        const absPath = (0, node_path_1.resolve)(requestPath);
        let raw;
        try {
            raw = yaml.load((0, node_fs_1.readFileSync)(absPath, 'utf8'));
        }
        catch (err) {
            throw new core_1.ValidationError(`Failed to read compose request at ${absPath}: ${String(err)}`, []);
        }
        const result = core_1.ComposeRequestSchema.safeParse(raw);
        if (!result.success) {
            const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
            throw new core_1.ValidationError('Invalid compose request', issues);
        }
        return result.data;
    }
}
exports.Composer = Composer;
//# sourceMappingURL=composer.js.map