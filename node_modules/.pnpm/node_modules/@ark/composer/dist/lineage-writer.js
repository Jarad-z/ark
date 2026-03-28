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
exports.buildLineage = buildLineage;
const node_crypto_1 = require("node:crypto");
const yaml = __importStar(require("js-yaml"));
function buildLineage(request, descriptors, plannerResult, humanEdits) {
    const parents = request.parents.map(({ id }) => {
        const desc = descriptors.get(id);
        const serialized = yaml.dump(desc);
        const hash = 'sha256:' + (0, node_crypto_1.createHash)('sha256').update(serialized).digest('hex');
        return {
            id,
            version: desc.functional.version,
            descriptorHash: hash,
        };
    });
    return {
        kind: 'composed',
        createdAt: new Date().toISOString(),
        parents,
        aiPrompt: plannerResult.prompt,
        aiProposal: plannerResult.wiringYaml ?? '',
        approvedWiringRef: 'ark-wiring.yaml',
        humanEdits,
        usedAsParentIn: [],
    };
}
//# sourceMappingURL=lineage-writer.js.map