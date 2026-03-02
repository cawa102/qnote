import { resolve, sep } from 'node:path';
import { realpath } from 'node:fs/promises';
import { PathTraversalError } from '../types.js';

/**
 * Check if a resolved path is within the root directory.
 * Uses prefix + separator to prevent /notes-evil matching /notes.
 */
export function isWithinRoot(resolvedPath: string, resolvedRoot: string): boolean {
  // Normalize: strip trailing separator from root for consistent comparison
  const normalizedRoot = resolvedRoot.endsWith(sep) ? resolvedRoot.slice(0, -1) : resolvedRoot;
  const rootPrefix = `${normalizedRoot}${sep}`;
  return resolvedPath === normalizedRoot || resolvedPath.startsWith(rootPrefix);
}

/**
 * Resolve a file path and assert it is within the given root directory.
 * Throws PathTraversalError if the path escapes the root.
 *
 * Uses resolve() to normalize both paths (handling .. components).
 * For symlink protection, file-scanner and file-tree-builder use
 * isWithinRoot + realpath directly at scan time.
 */
export async function assertPathWithinRoot(filePath: string, rootDir: string): Promise<void> {
  // Resolve both to canonicalize .. components. Try realpath for existing
  // paths (handles macOS /var→/private/var), fall back to resolve.
  let resolvedPath: string;
  let resolvedRoot: string;
  try {
    resolvedRoot = await realpath(resolve(rootDir));
  } catch {
    resolvedRoot = resolve(rootDir);
  }
  try {
    resolvedPath = await realpath(resolve(filePath));
  } catch {
    // Path doesn't exist yet — use resolve to normalize, then re-apply
    // realpath prefix. On macOS /tmp → /private/tmp, resolve() returns
    // /var/... while realpath returns /private/var/.... Re-resolve relative
    // to the real root to stay consistent.
    const rawResolved = resolve(filePath);
    const rawRoot = resolve(rootDir);
    if (isWithinRoot(rawResolved, rawRoot)) {
      // Path is within unresolved root — reconstruct under resolved root
      const relative = rawResolved.slice(rawRoot.length);
      resolvedPath = resolvedRoot + relative;
    } else {
      resolvedPath = rawResolved;
    }
  }

  if (!isWithinRoot(resolvedPath, resolvedRoot)) {
    throw new PathTraversalError(resolvedPath, resolvedRoot);
  }
}
