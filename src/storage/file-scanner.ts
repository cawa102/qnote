// NOTE: file-tree-builder.ts と走査ロジックが重複。シンボリックリンク保護は同パターンを適用

import { readdir, realpath, stat } from 'fs/promises';
import { join, relative, resolve } from 'path';

export interface ScanOptions {
  readonly excludeDirs?: readonly string[];
}

export interface ScannedFile {
  readonly relativePath: string;  // e.g. "projects/todo-app.md"
  readonly absolutePath: string;  // full path for editor navigation
}

const DEFAULT_EXCLUDE_DIRS: readonly string[] = ['.git', '.qnote', 'node_modules'];

export async function scanNoteFiles(
  notesDir: string,
  options?: ScanOptions,
): Promise<readonly ScannedFile[]> {
  const realRootPath = await realpath(resolve(notesDir));
  const excludeSet = buildExcludeSet(options?.excludeDirs);
  const results: ScannedFile[] = [];

  await scanDirectory(realRootPath, realRootPath, excludeSet, results);

  results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return results;
}

function buildExcludeSet(
  additionalExcludes?: readonly string[],
): ReadonlySet<string> {
  const set = new Set<string>(DEFAULT_EXCLUDE_DIRS);
  if (additionalExcludes) {
    for (const dir of additionalExcludes) {
      set.add(dir);
    }
  }
  return set;
}

async function scanDirectory(
  dirPath: string,
  realRootPath: string,
  excludeSet: ReadonlySet<string>,
  results: ScannedFile[],
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    // Permission errors or other read failures — skip this directory
    return;
  }

  for (const entry of entries) {
    // Skip dot-prefixed hidden entries
    if (entry.name.startsWith('.')) {
      continue;
    }

    // Skip explicitly excluded directory names
    if (excludeSet.has(entry.name)) {
      continue;
    }

    const entryPath = join(dirPath, entry.name);

    // Path traversal protection: resolve symlinks and verify path stays within root
    let isDir: boolean;
    let isFile: boolean;

    try {
      if (entry.isSymbolicLink()) {
        const realTarget = await realpath(entryPath);
        if (!realTarget.startsWith(realRootPath)) {
          continue;
        }
        const targetStat = await stat(entryPath);
        isDir = targetStat.isDirectory();
        isFile = targetStat.isFile();
      } else {
        const realEntryPath = await realpath(entryPath);
        if (!realEntryPath.startsWith(realRootPath)) {
          continue;
        }
        isDir = entry.isDirectory();
        isFile = entry.isFile();
      }
    } catch {
      // Broken symlinks or permission errors — skip
      continue;
    }

    if (isDir) {
      await scanDirectory(entryPath, realRootPath, excludeSet, results);
    } else if (isFile && entry.name.endsWith('.md')) {
      const relativePath = relative(realRootPath, entryPath);
      results.push({
        relativePath,
        absolutePath: entryPath,
      });
    }
  }
}
