import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as yaml from 'js-yaml'
import { CliDescriptorSchema, type CliDescriptor } from './schemas.js'
import { ValidationError } from './errors.js'

export function loadDescriptor(packageDir: string): CliDescriptor {
  const filePath = join(packageDir, 'ark-descriptor.yaml')
  let raw: unknown

  try {
    const content = readFileSync(filePath, 'utf8')
    raw = yaml.load(content)
  } catch (err) {
    throw new ValidationError(
      `Failed to read ark-descriptor.yaml at ${filePath}: ${String(err)}`,
      []
    )
  }

  const result = CliDescriptorSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.join('.')}: ${i.message}`
    )
    throw new ValidationError(
      `Invalid ark-descriptor.yaml at ${filePath}`,
      issues
    )
  }

  return result.data
}

export function loadDescriptorFromYaml(yamlContent: string): CliDescriptor {
  let raw: unknown
  try {
    raw = yaml.load(yamlContent)
  } catch (err) {
    throw new ValidationError(`Failed to parse YAML: ${String(err)}`, [])
  }

  const result = CliDescriptorSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.join('.')}: ${i.message}`
    )
    throw new ValidationError('Invalid CliDescriptor YAML', issues)
  }

  return result.data
}
