import { writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { ReportResult } from './generate-report.js'

export function saveReport(report: ReportResult, outputDir: string): string {
  const absDir = resolve(outputDir)
  mkdirSync(absDir, { recursive: true })

  const date = new Date(report.generatedAt)
  const dateStr = date.toISOString().slice(0, 10) // YYYY-MM-DD
  const safeCity = report.city.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')
  const filename = `${dateStr}_${safeCity}.md`
  const filepath = join(absDir, filename)

  const content = `# ${report.city} 天气日报 ${dateStr}\n\n${report.report}\n\n---\n_生成时间：${report.generatedAt}_\n`
  writeFileSync(filepath, content, 'utf8')

  return filepath
}
