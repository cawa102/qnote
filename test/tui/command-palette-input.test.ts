import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from 'ink-testing-library';
import { Box } from 'ink';
import stringWidth from 'string-width';
import { CommandPalette, PALETTE_COMMANDS } from '../../src/tui/screens/CommandPalette.js';
import { createNavigationStore } from '../../src/tui/hooks/use-navigation.js';
import { createInputModeStore } from '../../src/tui/hooks/use-input-mode.js';
import { LayoutProvider } from '../../src/tui/hooks/layout-context.js';
import { stripAnsi } from '../helpers/strip-ansi.js';

const ARROW_DOWN = '\x1b[B';
const ARROW_UP = '\x1b[A';
const ENTER = '\r';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderPalette(width = 80) {
  const nav = createNavigationStore();
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
        React.createElement(CommandPalette, { nav, inputMode, onAction }),
      ),
    ),
  );

  return { ...instance, actions, nav, inputMode };
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

  it('all 7 shortcut keys fire correct actions', async () => {
    const expected: [string, string][] = [
      ['n', 'new'],
      ['f', 'findFile'],
      ['s', 'search'],
      ['d', 'daily'],
      ['r', 'recent'],
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

describe('CommandPalette cursor navigation', () => {
  it('arrow down moves selection', async () => {
    const { stdin, lastFrame } = renderPalette();
    await delay(50);

    stdin.write(ARROW_DOWN);
    await delay(50);

    const frame = lastFrame();
    expect(frame).toMatch(/● find file/);
  });

  it('arrow up from second item returns to first', async () => {
    const { stdin, lastFrame } = renderPalette();
    await delay(50);

    stdin.write(ARROW_DOWN);
    await delay(50);
    stdin.write(ARROW_UP);
    await delay(50);

    const frame = lastFrame();
    expect(frame).toMatch(/● new note/);
  });

  it('Enter selects the current item', async () => {
    const { stdin, actions } = renderPalette();
    await delay(50);

    // Move to 'find file' (index 1) and press Enter
    stdin.write(ARROW_DOWN);
    await delay(50);
    stdin.write(ENTER);
    await delay(50);

    expect(actions).toEqual(['findFile']);
  });

  it('arrow up at top stays at first item', async () => {
    const { stdin, lastFrame } = renderPalette();
    await delay(50);

    stdin.write(ARROW_UP);
    await delay(50);

    const frame = lastFrame();
    expect(frame).toMatch(/● new note/);
  });
});

describe('CommandPalette layout alignment', () => {
  it('aligns all selection circles in the same column', async () => {
    const { lastFrame } = renderPalette();
    await delay(50);

    const frame = lastFrame();
    const lines = frame.split('\n');

    const circleLines = lines
      .map((line) => stripAnsi(line))
      .filter((line) => line.includes('●') || line.includes('○'));

    expect(circleLines.length).toBe(PALETTE_COMMANDS.length);

    const circleColumns = circleLines.map((line) => {
      const idxSelected = line.indexOf('●');
      const idxUnselected = line.indexOf('○');
      return idxSelected >= 0 ? idxSelected : idxUnselected;
    });

    const firstColumn = circleColumns[0]!;
    for (const col of circleColumns) {
      expect(col).toBe(firstColumn);
    }
  });

  it('all rows have the same display width (right edge aligned)', async () => {
    const { lastFrame } = renderPalette();
    await delay(50);

    const frame = lastFrame();
    const lines = frame.split('\n');

    const circleLines = lines
      .map((line) => stripAnsi(line))
      .filter((line) => line.includes('●') || line.includes('○'));

    const widths = circleLines.map((line) => stringWidth(line.trimEnd()));
    const firstWidth = widths[0]!;
    for (const w of widths) {
      expect(w).toBe(firstWidth);
    }
  });

  it('centers the options block within the content area', async () => {
    const { lastFrame } = renderPalette();
    await delay(50);

    const frame = lastFrame();
    const lines = frame.split('\n');

    const circleLines = lines
      .map((line) => stripAnsi(line))
      .filter((line) => line.includes('●') || line.includes('○'));

    const firstCircleCol = circleLines[0]!.indexOf('●');
    expect(firstCircleCol).toBeGreaterThan(2);
  });
});
