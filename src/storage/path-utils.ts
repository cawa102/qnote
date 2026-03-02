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
 * Uses realpath on both paths to handle symlinks (e.g. macOS /var → /private/var).
 */
export async function assertPathWithinRoot(filePath: string, rootDir: string): Promise<void> {
  const resolvedPath = await realpath(resolve(filePath));
  const resolvedRoot = await realpath(rootDir);

  if (!isWithinRoot(resolvedPath, resolvedRoot)) {
    throw new PathTraversalError(resolvedPath, resolvedRoot);
  }
}
