"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interpolate = interpolate;
exports.resolveInputs = resolveInputs;
exports.applyBindings = applyBindings;
const errors_js_1 = require("./errors.js");
/**
 * Minimal template engine supporting {{ ctx.x }} and {{ ctx.a ?? ctx.b }}
 * style interpolation over a flat or nested context object.
 *
 * Supported syntax:
 *   {{ path }}                     – resolve path in context
 *   {{ path | default: 'value' }}  – resolve with fallback string
 *   {{ a ? b : c }}                – ternary (paths resolved, no eval)
 */
function interpolate(template, ctx) {
    // If the entire string is a single expression, return the resolved value
    // (preserving type). Otherwise replace all {{ }} with string values.
    const singleExpr = /^\s*\{\{(.+?)\}\}\s*$/.exec(template);
    if (singleExpr) {
        const expr = singleExpr[1].trim();
        return resolveExpr(expr, ctx);
    }
    // Multi-expression: stringify all resolved values
    return template.replace(/\{\{(.+?)\}\}/g, (_, expr) => {
        const val = resolveExpr(expr.trim(), ctx);
        return val === undefined || val === null ? '' : String(val);
    });
}
function resolveExpr(expr, ctx) {
    // Ternary: a == 'x' ? b : c  or  ctx.mode == 'manual' ? ctx.x : ctx.y
    const ternary = /^(.+?)\s*\?\s*(.+?)\s*:\s*(.+)$/.exec(expr);
    if (ternary) {
        const [, condExpr, thenExpr, elseExpr] = ternary;
        const cond = resolveExpr(condExpr.trim(), ctx);
        return cond ? resolveExpr(thenExpr.trim(), ctx) : resolveExpr(elseExpr.trim(), ctx);
    }
    // Pipe: path | default: 'fallback'
    const pipe = /^(.+?)\s*\|\s*default:\s*(.+)$/.exec(expr);
    if (pipe) {
        const [, pathExpr, fallbackExpr] = pipe;
        const val = resolvePath(pathExpr.trim(), ctx);
        if (val !== undefined && val !== null)
            return val;
        // Strip surrounding quotes from fallback literal
        const fallback = fallbackExpr.trim().replace(/^['"]|['"]$/g, '');
        return fallback;
    }
    // Equality check: path == 'literal' or path == number
    const eqStr = /^(.+?)\s*==\s*['"](.+?)['"]$/.exec(expr);
    if (eqStr) {
        const [, pathExpr, literal] = eqStr;
        return resolvePath(pathExpr.trim(), ctx) === literal;
    }
    const eqNum = /^(.+?)\s*==\s*(-?\d+(?:\.\d+)?)$/.exec(expr);
    if (eqNum) {
        const [, pathExpr, numStr] = eqNum;
        return Number(resolvePath(pathExpr.trim(), ctx)) === Number(numStr);
    }
    // Numeric comparisons: path > num/path, path < num/path, path >= num/path, path <= num/path
    const cmp = /^(.+?)\s*(>=|<=|>|<)\s*(.+)$/.exec(expr);
    if (cmp) {
        const [, leftExpr, op, rightExpr] = cmp;
        const leftRaw = resolvePath(leftExpr.trim(), ctx);
        // Right side: try as numeric literal first, then as a path
        const rightLiteral = /^-?\d+(?:\.\d+)?$/.exec(rightExpr.trim());
        const rightRaw = rightLiteral
            ? Number(rightLiteral[0])
            : resolvePath(rightExpr.trim(), ctx);
        const val = Number(leftRaw);
        const num = Number(rightRaw);
        if (!isNaN(val) && !isNaN(num)) {
            if (op === '>')
                return val > num;
            if (op === '<')
                return val < num;
            if (op === '>=')
                return val >= num;
            if (op === '<=')
                return val <= num;
        }
    }
    // Plain path or string literal
    return resolvePath(expr, ctx);
}
function resolvePath(expr, ctx) {
    // String literal: 'value' or "value"
    const literal = /^['"](.+?)['"]$/.exec(expr);
    if (literal)
        return literal[1];
    // Boolean/null literals
    if (expr === 'true')
        return true;
    if (expr === 'false')
        return false;
    if (expr === 'null')
        return null;
    // Dot-separated path into ctx (e.g. ctx.flags.topic or just flags.topic)
    const cleanPath = expr.startsWith('ctx.') ? expr.slice(4) : expr;
    const parts = cleanPath.split('.');
    let current = ctx;
    for (const part of parts) {
        if (current === null || current === undefined)
            return undefined;
        current = current[part];
    }
    return current;
}
/**
 * Resolve all input values in a step's inputs map against the pipeline context.
 */
function resolveInputs(inputs, ctx) {
    const resolved = {};
    for (const [key, value] of Object.entries(inputs)) {
        if (typeof value === 'string') {
            resolved[key] = interpolate(value, ctx);
        }
        else {
            resolved[key] = value;
        }
    }
    return resolved;
}
/**
 * Apply output bindings from a step result to the pipeline context.
 * bind: { generatedPost: "post" } means ctx.bindings.generatedPost = stepOutput.post
 */
function applyBindings(bind, stepOutput, ctx) {
    const bindings = (ctx['bindings'] ?? {});
    for (const [ctxKey, outputKeyOrConstant] of Object.entries(bind)) {
        if (typeof outputKeyOrConstant !== 'string') {
            // Non-string value: bind as a constant directly (e.g. {triggered: true})
            bindings[ctxKey] = outputKeyOrConstant;
        }
        else if (outputKeyOrConstant === '.') {
            // Special key: bind the entire step output object
            bindings[ctxKey] = stepOutput;
        }
        else {
            if (!(outputKeyOrConstant in stepOutput)) {
                throw new errors_js_1.PortBindingError(`Output binding failed: key "${outputKeyOrConstant}" not found in step output. ` +
                    `Available keys: ${Object.keys(stepOutput).join(', ')}`);
            }
            bindings[ctxKey] = stepOutput[outputKeyOrConstant];
        }
    }
    ctx['bindings'] = bindings;
}
//# sourceMappingURL=template-engine.js.map