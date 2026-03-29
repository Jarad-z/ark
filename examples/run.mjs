#!/usr/bin/env node
/**
 * 运行 Chapter 5 示例：
 *   node examples/run.mjs 1              # 5.1 sequential
 *   node examples/run.mjs 2              # 5.2 dag
 *   node examples/run.mjs 3              # 5.3 branch
 *   node examples/run.mjs 4              # 5.4 parallel-map
 *   node examples/run.mjs 5              # 5.5 streaming
 */
import { PipelineRunner } from '../packages/runtime/dist/index.js'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ch = process.argv[2]

const configs = {
  '1': {
    yaml: 'examples/ch5-1-sequential.yaml',
    args: ['--city', 'Shanghai', '--dry-run'],
    desc: '5.1 Sequential — 天气播报（dry-run，跳过真实 AI 调用）',
  },
  '2': {
    yaml: 'examples/ch5-2-dag.yaml',
    args: ['--dry-run'],
    desc: '5.2 DAG — 三城市天气对比（dry-run）',
  },
  '3': {
    yaml: 'examples/ch5-3-branch.yaml',
    args: ['--text', 'Hello world'],
    desc: '5.3 Branch — 翻译→路由→发布（短文本，走 post 路径）',
  },
  '3l': {
    yaml: 'examples/ch5-3-branch.yaml',
    args: ['--text', 'x'.repeat(201)],
    desc: '5.3 Branch — 翻译→路由→人工审核（长文本 >200 字，走 review 路径）',
  },
  '4': {
    yaml: 'examples/ch5-4-parallel-map.yaml',
    args: ['--articles', JSON.stringify(['Hello world', 'Good morning', 'How are you'])],
    desc: '5.4 Parallel-map — 批量翻译三篇文章',
  },
  '5': {
    yaml: 'examples/ch5-5-streaming.yaml',
    args: ['--product-id', 'ITEM-001', '--threshold', '100'],
    desc: '5.5 Streaming — 持续监控价格，低于 100 元时告警',
  },
}

const cfg = configs[ch]
if (!cfg) {
  process.stderr.write(`用法: node examples/run.mjs <编号>\n`)
  process.stderr.write(`编号: ${Object.keys(configs).join(', ')}\n`)
  process.exit(1)
}

console.log(`\n▶  ${cfg.desc}`)
console.log(`   yaml: ${cfg.yaml}`)
console.log(`   args: ${cfg.args.join(' ')}\n`)

const runner = new PipelineRunner({
  wiringPath: resolve(ROOT, cfg.yaml),
  composedCliId: '@ark/example',
  monorepoRoot: ROOT,
})

const result = await runner.run(cfg.args)

console.log('\n── 结果 ──────────────────────────────')
console.log('success:', result.success)
if (result.error) console.log('error:', result.error)
if (Object.keys(result.bindings).length > 0)
  console.log('bindings:', JSON.stringify(result.bindings, null, 2))
if (!result.success) process.exit(1)
