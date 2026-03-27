"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicBridge = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const WIRING_YAML_FENCE_RE = /```yaml\n([\s\S]*?)```/;
const RATIONALE_RE = /^([\s\S]*?)```yaml/;
class AnthropicBridge {
    client;
    model;
    constructor(options) {
        this.client = new sdk_1.default({
            apiKey: options?.apiKey ?? process.env['ANTHROPIC_API_KEY'],
        });
        this.model =
            options?.model ??
                process.env['ARK_AI_MODEL'] ??
                'claude-sonnet-4-6';
    }
    async planComposition(prompt) {
        const message = await this.client.messages.create({
            model: this.model,
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
        });
        const text = extractText(message.content);
        // Extract rationale (text before the yaml fence) and the YAML block
        const rationaleMatch = RATIONALE_RE.exec(text);
        const yamlMatch = WIRING_YAML_FENCE_RE.exec(text);
        if (!yamlMatch) {
            // AI returned plain YAML without fences — treat whole response as YAML
            return { rationale: '', wiringYaml: text.trim() };
        }
        return {
            rationale: rationaleMatch ? rationaleMatch[1].trim() : '',
            wiringYaml: yamlMatch[1].trim(),
        };
    }
    async makeRuntimeDecision(prompt, context) {
        const fullPrompt = `${prompt}\n\nCurrent pipeline context:\n${JSON.stringify(context, null, 2)}\n\nRespond with a JSON object containing the key/value bindings to inject. Example:\n{"topic": "秋季护肤攻略", "schedule": "2025-03-01T19:00:00+08:00"}`;
        const message = await this.client.messages.create({
            model: this.model,
            max_tokens: 512,
            messages: [{ role: 'user', content: fullPrompt }],
        });
        const text = extractText(message.content);
        // Extract JSON from the response (may be wrapped in ```json ... ```)
        const jsonMatch = /```json\n([\s\S]*?)```/.exec(text) ??
            /(\{[\s\S]*\})/.exec(text);
        if (!jsonMatch) {
            throw new Error(`AI runtime decision did not return valid JSON.\nResponse: ${text}`);
        }
        const bindings = JSON.parse(jsonMatch[1]);
        return { bindings, reasoning: text };
    }
    async generateContent(prompt) {
        const message = await this.client.messages.create({
            model: this.model,
            max_tokens: 2048,
            messages: [{ role: 'user', content: prompt }],
        });
        return {
            content: extractText(message.content),
            usage: {
                inputTokens: message.usage.input_tokens,
                outputTokens: message.usage.output_tokens,
            },
        };
    }
}
exports.AnthropicBridge = AnthropicBridge;
function extractText(content) {
    return content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
}
//# sourceMappingURL=anthropic-bridge.js.map