import { readdir, realpath, stat } from 'fs/promises';
import { join, basename, resolve } from 'path';
import { isWithinRoot } from '../../storage/path-utils.js';
import type { FileTreeNode } from './types.js';

export interface FlatTreeEntry {
  readonly node: FileTreeNode;
  readonly depth: number;
}

export async function buildFileTree(dirPath: string): Promise<FileTreeNode> {
  const realRootPath = await realpath(resolve(dirPath));
  const children = await scanDirectory(dirPath, realRootPath);
  return {
    name: basename(dirPath),
    path: dirPath,
    type: 'directory',
    children,
    expanded: true,
  };
}

async function scanDirectory(
  dirPath: string,
  realRootPath: string,
): Promise<readonly FileTreeNode[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });

  const directories: FileTreeNode[] = [];
  const files: FileTreeNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const entryPath = join(dirPath, entry.name);

    // Path traversal protection: resolve symlinks and verify path stays within root
    let isDir: boolean;
    let isFile: boolean;

    if (entry.isSymbolicLink()) {
      const realTarget = await realpath(entryPath);
      if (!isWithinRoot(realTarget, realRootPath)) {
        continue;
      }
      // Symlink passed validation — stat the target to determine type
      const targetStat = await stat(entryPath);
      isDir = targetStat.isDirectory();
      isFile = targetStat.isFile();
    } else {
      // For non-symlinks, realpath the entry to compare against realRootPath
      const realEntryPath = await realpath(entryPath);
      if (!isWithinRoot(realEntryPath, realRootPath)) {
        continue;
      }
      isDir = entry.isDirectory();
      isFile = entry.isFile();
    }

    if (isDir) {
      const children = await scanDirectory(entryPath, realRootPath);
      directories.push({
        name: entry.name,
        path: entryPath,
        type: 'directory',
        children,
        expanded: true,
      });
    } else if (isFile && entry.name.endsWith('.md')) {
      files.push({
        name: entry.name,
        path: entryPath,
        type: 'file',
      });
    }
  }

  directories.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return [...directories, ...files];
}

export function flattenTree(
  node: FileTreeNode,
  depth: number = 0,
): readonly FlatTreeEntry[] {
  const result: FlatTreeEntry[] = [{ node, depth }];

  if (node.type === 'directory' && node.expanded && node.children) {
    for (const child of node.children) {
      const childEntries = flattenTree(child, depth + 1);
      result.push(...childEntries);
    }
  }

  return result;
}
