"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DescriptorResolver = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const core_1 = require("@ark/core");
const core_2 = require("@ark/core");
/**
 * Finds ark-descriptor.yaml files for parent CLI IDs within the monorepo.
 *
 * Resolution order:
 * 1. packages/<name> where name = id without @scope/  (e.g. @ark/cli-xhs → packages/cli-xhs)
 * 2. tools/<name>
 * 3. Any direct path passed in searchRoots
 */
class DescriptorResolver {
    searchRoots;
    constructor(monorepoRoot, extraSearchRoots = []) {
        this.searchRoots = [
            (0, node_path_1.join)(monorepoRoot, 'packages'),
            (0, node_path_1.join)(monorepoRoot, 'tools'),
            ...extraSearchRoots,
        ];
    }
    resolve(id) {
        const packageDir = this.findPackageDir(id);
        if (!packageDir) {
            throw new core_2.DescriptorNotFoundError(id);
        }
        return (0, core_1.loadDescriptor)(packageDir);
    }
    resolveAll(ids) {
        const map = new Map();
        for (const id of ids) {
            map.set(id, this.resolve(id));
        }
        return map;
    }
    findPackageDir(id) {
        // Strip scope: @ark/cli-xhs → cli-xhs
        const name = id.includes('/') ? id.split('/').slice(1).join('/') : id;
        for (const root of this.searchRoots) {
            const candidate = (0, node_path_1.resolve)(root, name);
            if ((0, node_fs_1.existsSync)((0, node_path_1.join)(candidate, 'ark-descriptor.yaml'))) {
                return candidate;
            }
        }
        return null;
    }
}
exports.DescriptorResolver = DescriptorResolver;
//# sourceMappingURL=descriptor-resolver.js.map