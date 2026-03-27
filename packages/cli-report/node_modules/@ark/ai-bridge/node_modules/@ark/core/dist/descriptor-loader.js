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
exports.loadDescriptor = loadDescriptor;
exports.loadDescriptorFromYaml = loadDescriptorFromYaml;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const yaml = __importStar(require("js-yaml"));
const schemas_js_1 = require("./schemas.js");
const errors_js_1 = require("./errors.js");
function loadDescriptor(packageDir) {
    const filePath = (0, node_path_1.join)(packageDir, 'ark-descriptor.yaml');
    let raw;
    try {
        const content = (0, node_fs_1.readFileSync)(filePath, 'utf8');
        raw = yaml.load(content);
    }
    catch (err) {
        throw new errors_js_1.ValidationError(`Failed to read ark-descriptor.yaml at ${filePath}: ${String(err)}`, []);
    }
    const result = schemas_js_1.CliDescriptorSchema.safeParse(raw);
    if (!result.success) {
        const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
        throw new errors_js_1.ValidationError(`Invalid ark-descriptor.yaml at ${filePath}`, issues);
    }
    return result.data;
}
function loadDescriptorFromYaml(yamlContent) {
    let raw;
    try {
        raw = yaml.load(yamlContent);
    }
    catch (err) {
        throw new errors_js_1.ValidationError(`Failed to parse YAML: ${String(err)}`, []);
    }
    const result = schemas_js_1.CliDescriptorSchema.safeParse(raw);
    if (!result.success) {
        const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
        throw new errors_js_1.ValidationError('Invalid CliDescriptor YAML', issues);
    }
    return result.data;
}
//# sourceMappingURL=descriptor-loader.js.map