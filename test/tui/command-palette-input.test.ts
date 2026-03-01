import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from 'ink-testing-library';
import { Box } from 'ink';
import { CommandPalette, PALETTE_COMMANDS } from '../../src/tui/screens/CommandPalette.js';
import { createInputModeStore } from '../../src/tui/hooks/use-input-mode.js';
import { LayoutProvider } from '../../src/tui/hooks/layout-context.js';

const ARROW_DOWN = '\x1b[B';
const ARROW_UP = '\x1b[A';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderPalette() {
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
        { flexDirection: 'column' as const, width: 80, height: 24 },
        React.createElement(CommandPalette, { inputMode, onAction }),
      ),
    ),
  );

  return { ...instance, actions, inputMode };
}

afterEach(() => {
  cleanup();
});

describe('CommandPalette navigation', () => {
  it('renders all commands', async () => {
    const { lastFrame } = renderPalette();
    await delay(50);

    const frame = lastFrame();
    for (const cmd of PALETTE_COMMANDS) {
      expect(frame).toContain(cmd.label);
    }
  });

  it('first command is selected by default', async () => {
    const { lastFrame } = renderPalette();
    await delay(50);

    expect(lastFrame()).toMatch(/● new note/);
  });

  it('arrow down moves selection', async () => {
    const { stdin, lastFrame } = renderPalette();
    await delay(50);

    stdin.write(ARROW_DOWN);
    await delay(50);

    expect(lastFrame()).toMatch(/● find file/);
  });

  it('arrow up moves selection back', async () => {
    const { stdin, lastFrame } = renderPalette();
    await delay(50);

    stdin.write(ARROW_DOWN);
    await delay(50);
    stdin.write(ARROW_UP);
    await delay(50);

    expect(lastFrame()).toMatch(/● new note/);
  });

  it('arrow up at top stays at first item', async () => {
    const { stdin, lastFrame } = renderPalette();
    await delay(50);

    stdin.write(ARROW_UP);
    await delay(50);

    expect(lastFrame()).toMatch(/● new note/);
  });

  it('arrow down at bottom stays at last item', async () => {
    const { stdin, lastFrame } = renderPalette();
    await delay(50);

    // Press down enough times to reach the last item
    for (let i = 0; i < PALETTE_COMMANDS.length + 2; i++) {
      stdin.write(ARROW_DOWN);
      await delay(20);
    }

    expect(lastFrame()).toMatch(/● tags/);
  });

  it('enter triggers onAction with selected command', async () => {
    const { stdin, actions } = renderPalette();
    await delay(50);

    stdin.write(ARROW_DOWN); // select 'find file'
    await delay(50);
    stdin.write('\r'); // enter
    await delay(50);

    expect(actions).toEqual(['findFile']);
  });

  it('does not render a text input', async () => {
    const { lastFrame } = renderPalette();
    await delay(50);

    const frame = lastFrame();
    expect(frame).not.toContain('type a command');
    expect(frame).not.toContain('> ');
  });

  it('sets input mode to navigation', async () => {
    const { inputMode } = renderPalette();
    await delay(50);

    expect(inputMode.current()).toBe('navigation');
  });
});
