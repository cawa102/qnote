import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { getHintsForScreen, Footer } from '../../src/tui/components/Footer.js';
import type { ScreenName } from '../../src/types.js';

describe('getHintsForScreen', () => {
  it('returns palette hints', () => {
    const hints = getHintsForScreen('palette');
    expect(hints).toContain('Enter');
    expect(hints).toContain('Esc');
  });

  it('returns noteList hints', () => {
    const hints = getHintsForScreen('noteList');
    expect(hints).toContain(': cmd');
    expect(hints).toContain('/ search');
    expect(hints).toContain('n new');
  });

  it('returns notePreview hints', () => {
    const hints = getHintsForScreen('notePreview');
    expect(hints).toContain('e edit');
    expect(hints).toContain('p raw');
  });

  it('returns search hints', () => {
    const hints = getHintsForScreen('search');
    expect(hints).toContain('Enter');
    expect(hints).toContain('Esc');
  });

  it('returns capture hints', () => {
    const hints = getHintsForScreen('capture');
    expect(hints).toContain('Ctrl+S');
    expect(hints).toContain('Esc');
  });

  it('returns findFile hints', () => {
    const hints = getHintsForScreen('findFile');
    expect(hints).toContain('Enter');
    expect(hints).toContain('Esc');
  });

  it('returns a string for every screen name', () => {
    const screens: readonly ScreenName[] = ['palette', 'findFile', 'noteList', 'notePreview', 'search', 'capture'];
    for (const screen of screens) {
      const hints = getHintsForScreen(screen);
      expect(typeof hints).toBe('string');
      expect(hints.length).toBeGreaterThan(0);
    }
  });
});

describe('Footer component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders hint text for the given screen', () => {
    const { lastFrame } = render(React.createElement(Footer, { screen: 'palette' }));
    expect(lastFrame()).toContain('Enter select');
    expect(lastFrame()).toContain('Esc quit');
  });

  it('renders different hints for each screen', () => {
    const screens: ScreenName[] = ['findFile', 'noteList', 'notePreview', 'search', 'capture'];
    for (const screen of screens) {
      const { lastFrame, unmount } = render(React.createElement(Footer, { screen }));
      const expected = getHintsForScreen(screen);
      expect(lastFrame()).toContain(expected);
      unmount();
    }
  });
});
