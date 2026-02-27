import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

describe('resolveEditor', () => {
  const mockedExecSync = vi.mocked(execSync);
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockedExecSync.mockReset();
    delete process.env.VISUAL;
    delete process.env.EDITOR;
  });

  afterEach(() => {
    process.env.VISUAL = originalEnv.VISUAL;
    process.env.EDITOR = originalEnv.EDITOR;
  });

  it('returns $VISUAL when set and available', async () => {
    process.env.VISUAL = 'code';
    mockedExecSync.mockImplementation(() => Buffer.from('/usr/bin/code'));

    const { resolveEditor } = await import('../../src/cli/resolve-editor.js');
    expect(resolveEditor()).toBe('code');
    expect(mockedExecSync).toHaveBeenCalledWith('which code', { stdio: 'ignore' });
  });

  it('falls back to $EDITOR when $VISUAL is not available', async () => {
    process.env.VISUAL = 'nonexistent-editor';
    process.env.EDITOR = 'vim';
    mockedExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('nonexistent-editor')) {
        throw new Error('not found');
      }
      return Buffer.from('/usr/bin/vim');
    });

    vi.resetModules();
    const { resolveEditor } = await import('../../src/cli/resolve-editor.js');
    expect(resolveEditor()).toBe('vim');
  });

  it('falls back to vi when no env vars are set', async () => {
    mockedExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('vi')) {
        return Buffer.from('/usr/bin/vi');
      }
      throw new Error('not found');
    });

    vi.resetModules();
    const { resolveEditor } = await import('../../src/cli/resolve-editor.js');
    expect(resolveEditor()).toBe('vi');
  });

  it('falls back to nano when vi is not available', async () => {
    mockedExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('nano')) {
        return Buffer.from('/usr/bin/nano');
      }
      throw new Error('not found');
    });

    vi.resetModules();
    const { resolveEditor } = await import('../../src/cli/resolve-editor.js');
    expect(resolveEditor()).toBe('nano');
  });

  it('throws EditorNotFoundError when no editor is found', async () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('not found');
    });

    vi.resetModules();
    const { resolveEditor } = await import('../../src/cli/resolve-editor.js');
    const { EditorNotFoundError } = await import('../../src/types.js');
    expect(() => resolveEditor()).toThrow(EditorNotFoundError);
  });
});
