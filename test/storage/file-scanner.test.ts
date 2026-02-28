import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, symlink, chmod, realpath } from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanNoteFiles } from '../../src/storage/file-scanner.js';

describe('scanNoteFiles', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Resolve symlinks in tmpdir (e.g. macOS /var -> /private/var)
    tempDir = await realpath(mkdtempSync(join(tmpdir(), 'qnote-scanner-')));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ─── Basic scanning ──────────────────────────────────────────────

  it('detects .md files in a single directory', async () => {
    await writeFile(join(tempDir, 'note-a.md'), '# Note A');
    await writeFile(join(tempDir, 'note-b.md'), '# Note B');

    const results = await scanNoteFiles(tempDir);

    expect(results).toHaveLength(2);
    expect(results[0].relativePath).toBe('note-a.md');
    expect(results[1].relativePath).toBe('note-b.md');
    expect(results[0].absolutePath).toBe(join(tempDir, 'note-a.md'));
    expect(results[1].absolutePath).toBe(join(tempDir, 'note-b.md'));
  });

  it('recursively detects .md files in subdirectories', async () => {
    await mkdir(join(tempDir, 'projects'), { recursive: true });
    await mkdir(join(tempDir, 'daily'), { recursive: true });
    await writeFile(join(tempDir, 'root.md'), '# Root');
    await writeFile(join(tempDir, 'projects', 'todo-app.md'), '# Todo');
    await writeFile(join(tempDir, 'daily', 'journal.md'), '# Journal');

    const results = await scanNoteFiles(tempDir);

    expect(results).toHaveLength(3);
    const paths = results.map((r) => r.relativePath);
    expect(paths).toContain('root.md');
    expect(paths).toContain('projects/todo-app.md');
    expect(paths).toContain('daily/journal.md');
  });

  // ─── Filtering ───────────────────────────────────────────────────

  it('excludes non-.md files', async () => {
    await writeFile(join(tempDir, 'note.md'), '# Note');
    await writeFile(join(tempDir, 'readme.txt'), 'text');
    await writeFile(join(tempDir, 'image.png'), 'binary');
    await writeFile(join(tempDir, 'script.js'), 'code');

    const results = await scanNoteFiles(tempDir);

    expect(results).toHaveLength(1);
    expect(results[0].relativePath).toBe('note.md');
  });

  it('excludes dot-prefixed hidden directories (.git/, .qnote/)', async () => {
    await mkdir(join(tempDir, '.git'), { recursive: true });
    await mkdir(join(tempDir, '.qnote'), { recursive: true });
    await writeFile(join(tempDir, '.git', 'config.md'), 'git config');
    await writeFile(join(tempDir, '.qnote', 'index.md'), 'index');
    await writeFile(join(tempDir, 'visible.md'), '# Visible');

    const results = await scanNoteFiles(tempDir);

    expect(results).toHaveLength(1);
    expect(results[0].relativePath).toBe('visible.md');
  });

  it('excludes node_modules/ directory', async () => {
    await mkdir(join(tempDir, 'node_modules', 'some-pkg'), { recursive: true });
    await writeFile(join(tempDir, 'node_modules', 'some-pkg', 'readme.md'), '# Pkg');
    await writeFile(join(tempDir, 'note.md'), '# Note');

    const results = await scanNoteFiles(tempDir);

    expect(results).toHaveLength(1);
    expect(results[0].relativePath).toBe('note.md');
  });

  it('excludes custom excludeDirs', async () => {
    await mkdir(join(tempDir, 'archive'), { recursive: true });
    await mkdir(join(tempDir, 'drafts'), { recursive: true });
    await writeFile(join(tempDir, 'archive', 'old.md'), '# Old');
    await writeFile(join(tempDir, 'drafts', 'wip.md'), '# WIP');
    await writeFile(join(tempDir, 'note.md'), '# Note');

    const results = await scanNoteFiles(tempDir, {
      excludeDirs: ['archive', 'drafts'],
    });

    expect(results).toHaveLength(1);
    expect(results[0].relativePath).toBe('note.md');
  });

  // ─── Sorting ─────────────────────────────────────────────────────

  it('results sorted alphabetically by relativePath', async () => {
    await mkdir(join(tempDir, 'beta'), { recursive: true });
    await mkdir(join(tempDir, 'alpha'), { recursive: true });
    await writeFile(join(tempDir, 'zebra.md'), '# Z');
    await writeFile(join(tempDir, 'alpha', 'note.md'), '# A');
    await writeFile(join(tempDir, 'beta', 'note.md'), '# B');
    await writeFile(join(tempDir, 'apple.md'), '# Apple');

    const results = await scanNoteFiles(tempDir);

    const paths = results.map((r) => r.relativePath);
    const sorted = [...paths].sort((a, b) => a.localeCompare(b));
    expect(paths).toEqual(sorted);
  });

  // ─── Symlinks ────────────────────────────────────────────────────

  it('symlink pointing outside notesDir is skipped', async () => {
    const outsideDir = mkdtempSync(join(tmpdir(), 'qnote-outside-'));
    await writeFile(join(outsideDir, 'secret.md'), '# Secret');

    await writeFile(join(tempDir, 'local.md'), '# Local');
    await symlink(outsideDir, join(tempDir, 'external-link'));

    const results = await scanNoteFiles(tempDir);

    expect(results).toHaveLength(1);
    expect(results[0].relativePath).toBe('local.md');

    rmSync(outsideDir, { recursive: true, force: true });
  });

  it('circular symlinks do not crash', async () => {
    await mkdir(join(tempDir, 'dir-a'), { recursive: true });
    await writeFile(join(tempDir, 'dir-a', 'note.md'), '# Note');

    // Create circular symlink: dir-a/link -> tempDir
    await symlink(tempDir, join(tempDir, 'dir-a', 'circular'));

    const results = await scanNoteFiles(tempDir);

    // Should not hang or throw; should include the real .md file
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.relativePath === 'dir-a/note.md')).toBe(true);
  });

  // ─── Edge cases ──────────────────────────────────────────────────

  it('empty directory returns empty array', async () => {
    const results = await scanNoteFiles(tempDir);

    expect(results).toEqual([]);
  });

  it('CJK filenames are detected correctly', async () => {
    await writeFile(join(tempDir, '日本語ノート.md'), '# Japanese Note');
    await writeFile(join(tempDir, 'API認証のフロー.md'), '# API Auth');

    const results = await scanNoteFiles(tempDir);

    expect(results).toHaveLength(2);
    const paths = results.map((r) => r.relativePath);
    expect(paths).toContain('日本語ノート.md');
    expect(paths).toContain('API認証のフロー.md');
  });

  it('permission error directories are skipped, returns what was readable', async () => {
    // This test only works on non-root Unix systems
    if (process.getuid?.() === 0) {
      return;
    }

    await mkdir(join(tempDir, 'readable'), { recursive: true });
    await mkdir(join(tempDir, 'forbidden'), { recursive: true });
    await writeFile(join(tempDir, 'readable', 'ok.md'), '# OK');
    await writeFile(join(tempDir, 'forbidden', 'secret.md'), '# Secret');

    // Remove read+execute permissions
    await chmod(join(tempDir, 'forbidden'), 0o000);

    try {
      const results = await scanNoteFiles(tempDir);

      expect(results).toHaveLength(1);
      expect(results[0].relativePath).toBe('readable/ok.md');
    } finally {
      // Restore permissions for cleanup
      await chmod(join(tempDir, 'forbidden'), 0o755);
    }
  });
});
