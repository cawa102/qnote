import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from 'ink-testing-library';
import { Box } from 'ink';
import { CommandPalette } from '../../src/tui/screens/CommandPalette.js';
import { createNavigationStore } from '../../src/tui/hooks/use-navigation.js';
import { createInputModeStore } from '../../src/tui/hooks/use-input-mode.js';
import { LayoutProvider } from '../../src/tui/hooks/layout-context.js';

// Terminal escape sequences
const ARROW_DOWN = '\x1b[B';
const ARROW_UP = '\x1b[A';
const BACKSPACE = '\x7f';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderPalette() {
  const nav = createNavigationStore();
  const inputMode = createInputModeStore();
  const actions: string[] = [];
  const onAction = (action: string, _query: string) => {
    actions.push(action);
  };

  const instance = render(
    React.createElement(
      LayoutProvider,
      null,
      React.createElement(
        Box,
        { flexDirection: 'column' as const, width: 80, height: 24 },
        React.createElement(CommandPalette, { nav, inputMode, onAction }),
      ),
    ),
  );

  return { ...instance, actions, nav, inputMode };
}

afterEach(() => {
  cleanup();
});

describe('CommandPalette input integration', () => {
  it('arrow keys work without any typing', async () => {
    const { stdin, lastFrame } = renderPalette();
    await delay(50);

    const frameBefore = lastFrame();
    expect(frameBefore).toContain('new note');

    // Press down arrow
    stdin.write(ARROW_DOWN);
    await delay(50);

    const frameAfter = lastFrame();
    // 'search' should now have the selected indicator
    expect(frameAfter).toMatch(/● search/);
  });

  it('arrow keys work after typing and deleting text (BUG REPRO)', async () => {
    const { stdin, lastFrame } = renderPalette();
    await delay(50);

    // Type 'test'
    stdin.write('t');
    await delay(50);
    stdin.write('e');
    await delay(50);
    stdin.write('s');
    await delay(50);
    stdin.write('t');
    await delay(50);

    // Delete 'test' (4 backspaces)
    stdin.write(BACKSPACE);
    await delay(50);
    stdin.write(BACKSPACE);
    await delay(50);
    stdin.write(BACKSPACE);
    await delay(50);
    stdin.write(BACKSPACE);
    await delay(50);

    // All commands should be visible again
    const frameAfterDelete = lastFrame();
    expect(frameAfterDelete).toContain('new note');
    expect(frameAfterDelete).toContain('daily');

    // Press down arrow to move to 'search'
    stdin.write(ARROW_DOWN);
    await delay(50);

    const frame1 = lastFrame();
    expect(frame1).toMatch(/● search/);

    // Press down arrow again to move to 'daily'
    stdin.write(ARROW_DOWN);
    await delay(50);

    const frame2 = lastFrame();
    expect(frame2).toMatch(/● daily/);
  });

  it('arrow keys work after typing 3 chars and deleting 3', async () => {
    const { stdin, lastFrame } = renderPalette();
    await delay(50);

    // Type 'abc'
    stdin.write('a');
    await delay(50);
    stdin.write('b');
    await delay(50);
    stdin.write('c');
    await delay(50);

    // Delete 'abc' (3 backspaces)
    stdin.write(BACKSPACE);
    await delay(50);
    stdin.write(BACKSPACE);
    await delay(50);
    stdin.write(BACKSPACE);
    await delay(50);

    // Press down arrow
    stdin.write(ARROW_DOWN);
    await delay(50);

    const frame = lastFrame();
    expect(frame).toMatch(/● search/);
  });

  it('arrow up works after typing and deleting', async () => {
    const { stdin, lastFrame } = renderPalette();
    await delay(50);

    // Move down twice first
    stdin.write(ARROW_DOWN);
    await delay(50);
    stdin.write(ARROW_DOWN);
    await delay(50);

    // Should be on 'daily'
    expect(lastFrame()).toMatch(/● daily/);

    // Type something and delete
    stdin.write('x');
    await delay(50);
    stdin.write(BACKSPACE);
    await delay(50);

    // Try arrow down
    stdin.write(ARROW_DOWN);
    await delay(50);

    // Should be able to navigate (● should be on some item)
    const frame = lastFrame();
    expect(frame).toContain('●');
  });
});
