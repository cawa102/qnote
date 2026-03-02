import { describe, it, expect, vi } from 'vitest';
import { restoreTerminal } from '../../src/tui/utils/terminal.js';

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

