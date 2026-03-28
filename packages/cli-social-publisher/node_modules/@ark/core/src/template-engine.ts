import { PortBindingError } from './errors.js'

/**
 * Minimal template engine supporting {{ ctx.x }} and {{ ctx.a ?? ctx.b }}
 * style interpolation over a flat or nested context object.
 *
 * Supported syntax:
 *   {{ path }}                     – resolve path in context
 *   {{ path | default: 'value' }}  – resolve with fallback string
 *   {{ a ? b : c }}                – ternary (paths resolved, no eval)
 */
export function interpolate(template: string, ctx: Record<string, unknown>): unknown {
  // If the entire string is a single expression, return the resolved value
  // (preserving type). Otherwise replace all {{ }} with string values.
  const singleExpr = /^\s*\{\{(.+?)\}\}\s*$/.exec(template)
  if (singleExpr) {
    const expr = singleExpr[1]!.trim()
    return resolveExpr(expr, ctx)
  }

  // Multi-expression: stringify all resolved values
  return template.replace(/\{\{(.+?)\}\}/g, (_, expr: string) => {
    const val = resolveExpr(expr.trim(), ctx)
    return val === undefined || val === null ? '' : String(val)
  })
}

function resolveExpr(expr: string, ctx: Record<string, unknown>): unknown {
  // Ternary: a == 'x' ? b : c  or  ctx.mode == 'manual' ? ctx.x : ctx.y
  const ternary = /^(.+?)\s*\?\s*(.+?)\s*:\s*(.+)$/.exec(expr)
  if (ternary) {
    const [, condExpr, thenExpr, elseExpr] = ternary
    const cond = resolveExpr(condExpr!.trim(), ctx)
    return cond ? resolveExpr(thenExpr!.trim(), ctx) : resolveExpr(elseExpr!.trim(), ctx)
  }

  // Pipe: path | default: 'fallback'
  const pipe = /^(.+?)\s*\|\s*default:\s*(.+)$/.exec(expr)
  if (pipe) {
    const [, pathExpr, fallbackExpr] = pipe
    const val = resolvePath(pathExpr!.trim(), ctx)
    if (val !== undefined && val !== null) return val
    // Strip surrounding quotes from fallback literal
    const fallback = fallbackExpr!.trim().replace(/^['"]|['"]$/g, '')
    return fallback
  }

  // Equality check: path == 'literal'
  const eq = /^(.+?)\s*==\s*['"](.+?)['"]$/.exec(expr)
  if (eq) {
    const [, pathExpr, literal] = eq
    return resolvePath(pathExpr!.trim(), ctx) === literal
  }

  // Plain path or string literal
  return resolvePath(expr, ctx)
}

function resolvePath(expr: string, ctx: Record<string, unknown>): unknown {
  // String literal: 'value' or "value"
  const literal = /^['"](.+?)['"]$/.exec(expr)
  if (literal) return literal[1]

  // Boolean/null literals
  if (expr === 'true') return true
  if (expr === 'false') return false
  if (expr === 'null') return null

  // Dot-separated path into ctx (e.g. ctx.flags.topic or just flags.topic)
  const cleanPath = expr.startsWith('ctx.') ? expr.slice(4) : expr
  const parts = cleanPath.split('.')

  let current: unknown = ctx
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/**
 * Resolve all input values in a step's inputs map against the pipeline context.
 */
export function resolveInputs(
  inputs: Record<string, unknown>,
  ctx: Record<string, unknown>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(inputs)) {
    if (typeof value === 'string') {
      resolved[key] = interpolate(value, ctx)
    } else {
      resolved[key] = value
    }
  }
  return resolved
}

/**
 * Apply output bindings from a step result to the pipeline context.
 * bind: { generatedPost: "post" } means ctx.bindings.generatedPost = stepOutput.post
 */
export function applyBindings(
  bind: Record<string, string>,
  stepOutput: Record<string, unknown>,
  ctx: Record<string, unknown>
): void {
  const bindings = (ctx['bindings'] ?? {}) as Record<string, unknown>
  for (const [ctxKey, outputKey] of Object.entries(bind)) {
    if (outputKey === '.') {
      // Special key: bind the entire step output object
      bindings[ctxKey] = stepOutput
    } else {
      if (!(outputKey in stepOutput)) {
        throw new PortBindingError(
          `Output binding failed: key "${outputKey}" not found in step output. ` +
            `Available keys: ${Object.keys(stepOutput).join(', ')}`
        )
      }
      bindings[ctxKey] = stepOutput[outputKey]
    }
  }
  ctx['bindings'] = bindings
}
