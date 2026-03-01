import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { getHintsForScreen, Footer, formatHintEntry, formatHints } from '../../src/tui/components/Footer.js';
import type { ScreenName, HintEntry } from '../../src/types.js';
import stripAnsi from 'strip-ansi';

describe('getHintsForScreen', () => {
  it('returns palette hints as HintEntry array', () => {
    const hints = getHintsForScreen('palette');
    expect(Array.isArray(hints)).toBe(true);
    expect(hints).toContainEqual({ key: 'Enter', desc: 'select' });
    expect(hints).toContainEqual({ key: 'q', desc: 'quit' });
  });

  it('returns non-empty array for every screen name', () => {
    const screens: readonly ScreenName[] = ['palette', 'findFile', 'noteList', 'notePreview', 'search', 'capture', 'editor', 'tagList'];
    for (const screen of screens) {
      const hints = getHintsForScreen(screen);
      expect(Array.isArray(hints)).toBe(true);
      expect(hints.length).toBeGreaterThan(0);
    }
  });

  it('each entry has non-empty key and desc', () => {
    const screens: readonly ScreenName[] = ['palette', 'findFile', 'noteList', 'notePreview', 'search', 'capture', 'editor', 'tagList'];
    for (const screen of screens) {
      const hints = getHintsForScreen(screen);
      for (const entry of hints) {
        expect(entry.key.length).toBeGreaterThan(0);
        expect(entry.desc.length).toBeGreaterThan(0);
      }
    }
  });

  it('editor hints contain ^T, ^G, ^E entries', () => {
    const hints = getHintsForScreen('editor');
    const keys = hints.map((h) => h.key);
    expect(keys).toContain('^T');
    expect(keys).toContain('^G');
    expect(keys).toContain('^E');
  });

  it('editor hints contain tab switching entry', () => {
    const hints = getHintsForScreen('editor');
    expect(hints).toContainEqual({ key: '^ shift →/←', desc: 'tab' });
  });

  it('editor tab switching hint is positioned between ^E and ^T', () => {
    const hints = getHintsForScreen('editor');
    const keys = hints.map((h) => h.key);
    const eIndex = keys.indexOf('^E');
    const tabIndex = keys.indexOf('^ shift →/←');
    const tIndex = keys.indexOf('^T');
    expect(tabIndex).toBeGreaterThan(eIndex);
    expect(tabIndex).toBeLessThan(tIndex);
  });

  it('capture hints contain Enter, Tab, Esc entries', () => {
    const hints = getHintsForScreen('capture');
    const keys = hints.map((h) => h.key);
    expect(keys).toContain('Enter');
    expect(keys).toContain('Tab');
    expect(keys).toContain('Esc');
    expect(keys).not.toContain('^S');
  });

  it('noteList hints contain ^Q quit entry', () => {
    const hints = getHintsForScreen('noteList');
    expect(hints).toContainEqual({ key: '^Q', desc: 'quit' });
  });

  it('notePreview hints contain ^Q quit entry', () => {
    const hints = getHintsForScreen('notePreview');
    expect(hints).toContainEqual({ key: '^Q', desc: 'quit' });
  });

  it('palette hints use q (not ^Q) for quit', () => {
    const hints = getHintsForScreen('palette');
    expect(hints).toContainEqual({ key: 'q', desc: 'quit' });
    const keys = hints.map((h) => h.key);
    expect(keys).not.toContain('^Q');
  });

  it('returns tagList hints with Enter, ^R, Esc', () => {
    const hints = getHintsForScreen('tagList');
    expect(hints).toContainEqual({ key: 'Enter', desc: 'notes' });
    expect(hints).toContainEqual({ key: '^R', desc: 'rename' });
    expect(hints).toContainEqual({ key: 'Esc', desc: 'back' });
  });

  it('returns tag-filtered noteList hints when tag param is provided', () => {
    const hints = getHintsForScreen('noteList', undefined, 'typescript');
    expect(hints).toContainEqual({ key: 'Enter', desc: 'preview' });
    expect(hints).toContainEqual({ key: '^R', desc: 'rename' });
    expect(hints).toContainEqual({ key: 'Esc', desc: 'back' });
    // Should NOT contain default noteList hints
    const keys = hints.map((h) => h.key);
    expect(keys).not.toContain(':');
    expect(keys).not.toContain('/');
  });

  it('returns default noteList hints when tag param is undefined', () => {
    const hints = getHintsForScreen('noteList');
    expect(hints).toContainEqual({ key: ':', desc: 'cmd' });
    expect(hints).toContainEqual({ key: '/', desc: 'search' });
  });

  it('tag param is ignored for non-noteList screens', () => {
    const hintsWithTag = getHintsForScreen('palette', undefined, 'sometag');
    const hintsWithout = getHintsForScreen('palette');
    expect(hintsWithTag).toEqual(hintsWithout);
  });

  describe('editor hints with focus context', () => {
    it('shows "Esc: editor" when focus is headerTitle', () => {
      const hints = getHintsForScreen('editor', 'headerTitle');
      expect(hints).toContainEqual({ key: 'Esc', desc: 'editor' });
      const keys = hints.map((h) => h.key);
      // Should not contain the default "back" for Esc
      const escEntry = hints.find((h) => h.key === 'Esc');
      expect(escEntry?.desc).toBe('editor');
    });

    it('shows "Esc: editor" when focus is headerTags', () => {
      const hints = getHintsForScreen('editor', 'headerTags');
      expect(hints).toContainEqual({ key: 'Esc', desc: 'editor' });
    });

    it('shows "Esc: back" when focus is editor (default)', () => {
      const hints = getHintsForScreen('editor', 'editor');
      expect(hints).toContainEqual({ key: 'Esc', desc: 'back' });
    });

    it('shows "Esc: back" when no focus provided', () => {
      const hints = getHintsForScreen('editor');
      expect(hints).toContainEqual({ key: 'Esc', desc: 'back' });
    });

    it('shows "Enter: done" when focus is headerTitle', () => {
      const hints = getHintsForScreen('editor', 'headerTitle');
      expect(hints).toContainEqual({ key: 'Enter', desc: 'done' });
    });

    it('does not show "Enter: done" when focus is editor', () => {
      const hints = getHintsForScreen('editor', 'editor');
      const enterEntry = hints.find((h) => h.key === 'Enter');
      expect(enterEntry).toBeUndefined();
    });

    it('shows "Esc: editor" when focus is fileTree', () => {
      const hints = getHintsForScreen('editor', 'fileTree');
      expect(hints).toContainEqual({ key: 'Esc', desc: 'editor' });
    });
  });
});

describe('formatHintEntry', () => {
  it('produces string containing both key and desc', () => {
    const entry: HintEntry = { key: 'Enter', desc: 'select' };
    const result = stripAnsi(formatHintEntry(entry));
    expect(result).toContain('Enter');
    expect(result).toContain('select');
  });

  it('pads key with spaces inside the badge', () => {
    const entry: HintEntry = { key: 'q', desc: 'quit' };
    const result = stripAnsi(formatHintEntry(entry));
    expect(result).toContain(' q ');
  });
});

describe('formatHints', () => {
  it('joins entries with separator', () => {
    const entries: readonly HintEntry[] = [
      { key: 'Enter', desc: 'select' },
      { key: 'q', desc: 'quit' },
    ];
    const result = stripAnsi(formatHints(entries));
    expect(result).toContain('Enter');
    expect(result).toContain('select');
    expect(result).toContain('q');
    expect(result).toContain('quit');
  });

  it('separates entries with double space', () => {
    const entries: readonly HintEntry[] = [
      { key: 'a', desc: 'first' },
      { key: 'b', desc: 'second' },
    ];
    const result = stripAnsi(formatHints(entries));
    // Between first pair's desc and second pair's badge there should be 2 spaces
    expect(result).toMatch(/first\s{2,}/);
  });
});

describe('Footer component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders key names and descriptions for palette screen', () => {
    const { lastFrame } = render(React.createElement(Footer, { screen: 'palette' }));
    const frame = stripAnsi(lastFrame());
    expect(frame).toContain('Enter');
    expect(frame).toContain('select');
    expect(frame).toContain('q');
    expect(frame).toContain('quit');
  });

  it('renders tag-filtered hints when tag prop is provided on noteList screen', () => {
    const { lastFrame } = render(React.createElement(Footer, { screen: 'noteList', tag: 'typescript' }));
    const frame = stripAnsi(lastFrame());
    expect(frame).toContain('preview');
    expect(frame).toContain('^R');
    expect(frame).not.toContain('cmd');
  });

  it('renders different content per screen', () => {
    const { lastFrame: paletteFrame } = render(React.createElement(Footer, { screen: 'palette' }));
    cleanup();
    const { lastFrame: editorFrame } = render(React.createElement(Footer, { screen: 'editor' }));
    const p = stripAnsi(paletteFrame());
    const e = stripAnsi(editorFrame());
    expect(p).not.toBe(e);
  });
});
