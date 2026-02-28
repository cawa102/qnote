import { describe, it, expect, vi } from 'vitest';
import { restoreTerminal, spawnEditorSync, extractSlugFromPath } from '../../src/tui/utils/terminal.js';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn().mockReturnValue({ status: 0 }),
  execSync: vi.fn(), // used by resolveEditor
}));

vi.mock('../../src/tui/utils/resolve-editor.js', () => ({
  resolveEditor: vi.fn().mockReturnValue('vim'),
}));

describe('restoreTerminal', () => {
  it('writes alternate screen exit and cursor show escape sequences', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    restoreTerminal();

    expect(writeSpy).toHaveBeenCalledWith('\x1b[?1049l\x1b[?25h');
    writeSpy.mockRestore();
  });
});

describe('spawnEditorSync', () => {
  it('spawns the resolved editor with the given file path and inherited stdio', async () => {
    const { spawnSync } = await import('node:child_process');
    const { resolveEditor } = await import('../../src/tui/utils/resolve-editor.js');

    spawnEditorSync('/notes/test.md');

    expect(resolveEditor).toHaveBeenCalled();
    expect(spawnSync).toHaveBeenCalledWith('vim', ['/notes/test.md'], { stdio: 'inherit' });
  });
});

describe('extractSlugFromPath', () => {
  it('extracts slug from a simple markdown file path', () => {
    expect(extractSlugFromPath('/home/user/notes/hello-world.md')).toBe('hello-world');
  });

  it('extracts slug from a nested path', () => {
    expect(extractSlugFromPath('/home/user/notes/daily/2026-02-27.md')).toBe('2026-02-27');
  });

  it('extracts slug from Japanese filename', () => {
    expect(extractSlugFromPath('/notes/メモ帳.md')).toBe('メモ帳');
  });

  it('handles path without .md extension', () => {
    expect(extractSlugFromPath('/notes/readme.txt')).toBe('readme.txt');
  });

  it('handles filename-only path', () => {
    expect(extractSlugFromPath('my-note.md')).toBe('my-note');
  });

  it('returns empty string for empty path', () => {
    expect(extractSlugFromPath('')).toBe('');
  });
});
