import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isWithinRoot, assertPathWithinRoot } from '../../src/storage/path-utils.js';
import { PathTraversalError } from '../../src/types.js';

describe('isWithinRoot', () => {
  it('returns true for exact root match', () => {
    expect(isWithinRoot('/home/user/notes', '/home/user/notes')).toBe(true);
  });

  it('returns true for child path', () => {
    expect(isWithinRoot('/home/user/notes/file.md', '/home/user/notes')).toBe(true);
  });

  it('returns true for deeply nested child', () => {
    expect(isWithinRoot('/home/user/notes/sub/deep/file.md', '/home/user/notes')).toBe(true);
  });

  it('rejects prefix-match sibling (/notes-evil vs /notes)', () => {
    expect(isWithinRoot('/home/user/notes-evil/secret.md', '/home/user/notes')).toBe(false);
  });

  it('rejects completely unrelated path', () => {
    expect(isWithinRoot('/etc/passwd', '/home/user/notes')).toBe(false);
  });

  it('rejects parent directory', () => {
    expect(isWithinRoot('/home/user', '/home/user/notes')).toBe(false);
  });

  it('handles root with trailing slash', () => {
    expect(isWithinRoot('/home/user/notes/file.md', '/home/user/notes/')).toBe(true);
  });

  it('handles root with trailing slash — exact match', () => {
    expect(isWithinRoot('/home/user/notes', '/home/user/notes/')).toBe(true);
  });

  it('rejects sibling when root has trailing slash', () => {
    expect(isWithinRoot('/home/user/notes-evil', '/home/user/notes/')).toBe(false);
  });
});

describe('assertPathWithinRoot', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'qnote-pathutil-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('resolves and accepts a path within root', async () => {
    const sub = join(tempDir, 'sub');
    mkdirSync(sub);
    await expect(assertPathWithinRoot(sub, tempDir)).resolves.toBeUndefined();
  });

  it('throws PathTraversalError for path outside root', async () => {
    await expect(assertPathWithinRoot('/etc/passwd', tempDir)).rejects.toThrow(PathTraversalError);
  });

  it('throws PathTraversalError for directory traversal', async () => {
    // Use the real parent dir (which exists) to test traversal
    const traversal = join(tempDir, '..');
    await expect(assertPathWithinRoot(traversal, tempDir)).rejects.toThrow(PathTraversalError);
  });
});
