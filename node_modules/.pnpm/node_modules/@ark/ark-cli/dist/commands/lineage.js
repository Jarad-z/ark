import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadDescriptor } from '@ark/core';
export function showLineage(id, monorepoRoot) {
    const tree = buildTree(id, monorepoRoot, 0, new Set());
    process.stdout.write('\nLineage tree for ' + id + '\n\n');
    process.stdout.write(tree + '\n');
}
function buildTree(id, monorepoRoot, depth, visited) {
    if (visited.has(id))
        return indent(depth) + id + ' (circular)\n';
    visited.add(id);
    const name = id.includes('/') ? id.split('/').slice(1).join('/') : id;
    const searchDirs = [
        join(monorepoRoot, 'packages', name),
        join(monorepoRoot, 'tools', name),
    ];
    let pkgDir = null;
    for (const dir of searchDirs) {
        if (existsSync(join(dir, 'ark-descriptor.yaml'))) {
            pkgDir = dir;
            break;
        }
    }
    if (!pkgDir) {
        return indent(depth) + `${id} (not found)\n`;
    }
    let desc;
    try {
        desc = loadDescriptor(pkgDir);
    }
    catch {
        return indent(depth) + `${id} (invalid descriptor)\n`;
    }
    const { lineage: l, functional: f } = desc;
    const tag = l.kind === 'composed' ? '◆' : '◇';
    let result = indent(depth) + `${tag} ${id} v${f.version} [${l.kind}]\n`;
    if (l.kind === 'composed') {
        for (const parent of l.parents) {
            result += buildTree(parent.id, monorepoRoot, depth + 1, new Set(visited));
        }
    }
    return result;
}
function indent(depth) {
    return '  '.repeat(depth);
}
//# sourceMappingURL=lineage.js.map