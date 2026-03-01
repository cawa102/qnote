import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from 'ink-testing-library';
import { Box } from 'ink';
import { CommandPalette, PALETTE_COMMANDS } from '../../src/tui/screens/CommandPalette.js';
import { createInputModeStore } from '../../src/tui/hooks/use-input-mode.js';
import { LayoutProvider } from '../../src/tui/hooks/layout-context.js';
import { stripAnsi } from '../helpers/strip-ansi.js';

const ARROW_DOWN = '\x1b[B';
const ARROW_UP = '\x1b[A';
const ARROW_RIGHT = '\x1b[C';
const ARROW_LEFT = '\x1b[D';
const ENTER = '\r';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderPalette(width = 80) {
  const inputMode = createInputModeStore();
  const actions: string[] = [];
  const onAction = (action: string) => {
    actions.push(action);
  };

  const instance = render(
    React.createElement(
      LayoutProvider,
      null,
      React.createElement(
        Box,
        { flexDirection: 'column' as const, width, height: 24 },
        React.createElement(CommandPalette, { inputMode, onAction }),
      ),
    ),
  );

  return { ...instance, actions, inputMode };
}

afterEach(() => {
  cleanup();
});

describe('CommandPalette shortcut keys', () => {
  it('pressing "n" fires onAction("new")', async () => {
    const { stdin, actions } = renderPalette();
    await delay(50);
    stdin.write('n');
    await delay(50);
    expect(actions).toEqual(['new']);
  });

  it('pressing "f" fires onAction("findFile")', async () => {
    const { stdin, actions } = renderPalette();
    await delay(50);
    stdin.write('f');
    await delay(50);
    expect(actions).toEqual(['findFile']);
  });

  it('all 6 shortcut keys fire correct actions (no recent)', async () => {
    const expected: [string, string][] = [
      ['n', 'new'],
      ['f', 'findFile'],
      ['s', 'search'],
      ['d', 'daily'],
      ['c', 'capture'],
      ['t', 'tags'],
    ];

    for (const [key, action] of expected) {
      const { stdin, actions } = renderPalette();
      await delay(50);
      stdin.write(key);
      await delay(50);
      expect(actions).toEqual([action]);
      cleanup();
    }
  });

  it('pressing undefined key "x" does not fire onAction', async () => {
    const { stdin, actions } = renderPalette();
    await delay(50);
    stdin.write('x');
    await delay(50);
    expect(actions).toEqual([]);
  });
});

describe('CommandPalette 2D grid navigation', () => {
  // In 3-column mode (width=80), 6 commands in 3x2 grid:
  // Row 0: [New Note(0), Quick Note(1), Daily Note(2)]
  // Row 1: [Find File(3), Search(4),    Tags(5)]

  it('arrow right moves selection from col 0 to col 1', async () => {
    const { stdin, actions } = renderPalette();
    await delay(50);

    // Start at index 0 (New Note), move right to index 1 (Quick Note)
    stdin.write(ARROW_RIGHT);
    await delay(50);
    stdin.write(ENTER);
    await delay(50);

    expect(actions).toEqual(['capture']);
  });

  it('arrow left at col 0 stays at col 0', async () => {
    const { stdin, actions } = renderPalette();
    await delay(50);

    // Start at index 0, arrow left should stay at 0
    stdin.write(ARROW_LEFT);
    await delay(50);
    stdin.write(ENTER);
    await delay(50);

    expect(actions).toEqual(['new']);
  });

  it('arrow down moves from row 0 to row 1 (same column)', async () => {
    const { stdin, actions } = renderPalette();
    await delay(50);

    // Start at index 0 (New Note), arrow down → index 3 (Find File)
    stdin.write(ARROW_DOWN);
    await delay(50);
    stdin.write(ENTER);
    await delay(50);

    expect(actions).toEqual(['findFile']);
  });

  it('arrow up at row 0 stays at row 0', async () => {
    const { stdin, actions } = renderPalette();
    await delay(50);

    // Start at index 0, arrow up should stay at row 0
    stdin.write(ARROW_UP);
    await delay(50);
    stdin.write(ENTER);
    await delay(50);

    expect(actions).toEqual(['new']);
  });

  it('arrow right then down navigates to row 1 col 1', async () => {
    const { stdin, actions } = renderPalette();
    await delay(50);

    // Start at (0,0), right → (0,1), down → (1,1) = index 4 (Search)
    stdin.write(ARROW_RIGHT);
    await delay(50);
    stdin.write(ARROW_DOWN);
    await delay(50);
    stdin.write(ENTER);
    await delay(50);

    expect(actions).toEqual(['search']);
  });

  it('arrow right at last column stays at last column', async () => {
    const { stdin, actions } = renderPalette();
    await delay(50);

    // Move to col 2 (right twice), then right again — should stay
    stdin.write(ARROW_RIGHT);
    await delay(50);
    stdin.write(ARROW_RIGHT);
    await delay(50);
    stdin.write(ARROW_RIGHT); // should not move past col 2
    await delay(50);
    stdin.write(ENTER);
    await delay(50);

    expect(actions).toEqual(['daily']);
  });

  it('arrow down at last row stays at last row', async () => {
    const { stdin, actions } = renderPalette();
    await delay(50);

    // Move to row 1, then down again — should stay
    stdin.write(ARROW_DOWN);
    await delay(50);
    stdin.write(ARROW_DOWN); // should not move past row 1
    await delay(50);
    stdin.write(ENTER);
    await delay(50);

    expect(actions).toEqual(['findFile']);
  });

  it('Enter on grid position fires correct action', async () => {
    const { stdin, actions } = renderPalette();
    await delay(50);

    // Navigate to last cell: (1,2) = Tags
    stdin.write(ARROW_DOWN);
    await delay(50);
    stdin.write(ARROW_RIGHT);
    await delay(50);
    stdin.write(ARROW_RIGHT);
    await delay(50);
    stdin.write(ENTER);
    await delay(50);

    expect(actions).toEqual(['tags']);
  });

  it('sets input mode to navigation', async () => {
    const { inputMode } = renderPalette();
    await delay(50);

    expect(inputMode.current()).toBe('navigation');
  });
});

describe('CommandPalette grid rendering', () => {
  it('renders emoji icons for each command', async () => {
    const { lastFrame } = renderPalette();
    await delay(50);

    const frame = stripAnsi(lastFrame());
    for (const cmd of PALETTE_COMMANDS) {
      expect(frame).toContain(cmd.icon);
    }
  });

  it('renders label with shortcut key in parentheses', async () => {
    const { lastFrame } = renderPalette();
    await delay(50);

    const frame = stripAnsi(lastFrame());
    for (const cmd of PALETTE_COMMANDS) {
      expect(frame).toContain(`${cmd.label} (${cmd.key})`);
    }
  });

  it('does not render ● or ○ indicators', async () => {
    const { lastFrame } = renderPalette();
    await delay(50);

    const frame = stripAnsi(lastFrame());
    expect(frame).not.toContain('●');
    expect(frame).not.toContain('○');
  });

  it('renders bordered cells with bold (heavy) lines', async () => {
    const { lastFrame } = renderPalette();
    await delay(50);

    const frame = stripAnsi(lastFrame());
    // Bold border style uses ┏ ┓ ┗ ┛ corners and ━ ┃ lines
    expect(frame).toContain('┏');
    expect(frame).toContain('┓');
    expect(frame).toContain('┗');
    expect(frame).toContain('┛');
    // Should NOT use round corners
    expect(frame).not.toContain('╭');
    expect(frame).not.toContain('╮');
    expect(frame).not.toContain('╰');
    expect(frame).not.toContain('╯');
  });
});
