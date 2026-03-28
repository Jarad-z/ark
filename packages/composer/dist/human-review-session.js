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
exports.HumanReviewSession = void 0;
const node_readline_1 = require("node:readline");
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const core_1 = require("@ark/core");
const yaml = __importStar(require("js-yaml"));
/**
 * Presents the AI-proposed WiringPlan YAML to the user in the terminal.
 * Options: accept / edit in $EDITOR / reject and re-prompt.
 */
class HumanReviewSession {
    async review(rationale, wiringYaml) {
        while (true) {
            this.printProposal(rationale, wiringYaml);
            const choice = await this.prompt('\n[ark:composer] Accept this wiring plan? [y]es / [e]dit / [r]eject: ');
            if (choice === 'y' || choice === 'yes') {
                this.validateOrThrow(wiringYaml);
                return { wiringYaml, humanEdits: undefined, accepted: true };
            }
            if (choice === 'e' || choice === 'edit') {
                const edited = this.openInEditor(wiringYaml);
                if (edited === wiringYaml) {
                    process.stderr.write('[ark:composer] No changes made.\n');
                    continue;
                }
                this.validateOrThrow(edited);
                return {
                    wiringYaml: edited,
                    humanEdits: this.diffSummary(wiringYaml, edited),
                    accepted: true,
                };
            }
            if (choice === 'r' || choice === 'reject') {
                return { wiringYaml, humanEdits: undefined, accepted: false };
            }
            process.stderr.write('Please enter y, e, or r.\n');
        }
    }
    printProposal(rationale, wiringYaml) {
        process.stdout.write('\n' + '─'.repeat(60) + '\n');
        if (rationale) {
            process.stdout.write('AI RATIONALE:\n\n' + rationale + '\n\n');
            process.stdout.write('─'.repeat(60) + '\n');
        }
        process.stdout.write('PROPOSED WIRING PLAN:\n\n```yaml\n' + wiringYaml + '\n```\n');
        process.stdout.write('─'.repeat(60) + '\n');
    }
    prompt(question) {
        return new Promise((resolve) => {
            const rl = (0, node_readline_1.createInterface)({
                input: process.stdin,
                output: process.stdout,
                terminal: false,
            });
            process.stdout.write(question);
            rl.once('line', (line) => {
                rl.close();
                resolve(line.trim().toLowerCase());
            });
        });
    }
    openInEditor(content) {
        const tmpFile = (0, node_path_1.join)((0, node_os_1.tmpdir)(), `ark-wiring-${Date.now()}.yaml`);
        (0, node_fs_1.writeFileSync)(tmpFile, content, 'utf8');
        const editor = process.env['EDITOR'] ?? process.env['VISUAL'] ?? 'notepad';
        (0, node_child_process_1.spawnSync)(editor, [tmpFile], { stdio: 'inherit' });
        const edited = (0, node_fs_1.readFileSync)(tmpFile, 'utf8');
        (0, node_fs_1.unlinkSync)(tmpFile);
        return edited;
    }
    validateOrThrow(wiringYaml) {
        let raw;
        try {
            raw = yaml.load(wiringYaml);
        }
        catch (err) {
            throw new core_1.ValidationError(`Wiring YAML is not valid YAML: ${String(err)}`, []);
        }
        const result = core_1.WiringPlanSchema.safeParse(raw);
        if (!result.success) {
            const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
            throw new core_1.ValidationError('Wiring plan failed schema validation', issues);
        }
    }
    diffSummary(original, edited) {
        const origLines = original.split('\n');
        const editLines = edited.split('\n');
        const added = editLines.filter((l) => !origLines.includes(l)).length;
        const removed = origLines.filter((l) => !editLines.includes(l)).length;
        return `Human edited: +${added} lines, -${removed} lines`;
    }
}
exports.HumanReviewSession = HumanReviewSession;
//# sourceMappingURL=human-review-session.js.map