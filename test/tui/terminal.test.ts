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
  it('includes ANSI reset sequence to clear all attributes', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    restoreTerminal();

    const output = writeSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('\x1b[0m');
    writeSpy.mockRestore();
  });

  it('includes alternate screen exit sequence', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    restoreTerminal();

    const output = writeSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('\x1b[?1049l');
    writeSpy.mockRestore();
  });

  it('includes cursor show sequence', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    restoreTerminal();

    const output = writeSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('\x1b[?25h');
    writeSpy.mockRestore();
  });

  it('resets attributes before exiting alternate screen', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    restoreTerminal();

    const output = writeSpy.mock.calls[0]?.[0] as string;
    const resetIndex = output.indexOf('\x1b[0m');
    const altScreenIndex = output.indexOf('\x1b[?1049l');
    expect(resetIndex).toBeLessThan(altScreenIndex);
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
