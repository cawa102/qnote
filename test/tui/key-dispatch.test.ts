import { describe, it, expect, vi } from 'vitest';
import { dispatchGlobalKey } from '../../src/tui/hooks/key-dispatch.js';
import { createNavigationStore } from '../../src/tui/hooks/use-navigation.js';
import { createInputModeStore } from '../../src/tui/hooks/use-input-mode.js';

function createOptions(overrides: {
  currentScreen?: string;
  mode?: 'navigation' | 'text';
  currentFilePath?: string;
} = {}) {
  const nav = createNavigationStore();
  const inputMode = createInputModeStore();
  const exit = vi.fn();

  if (overrides.mode === 'text') {
    inputMode.set('text');
  }

  if (overrides.currentScreen === 'notePreview') {
    nav.push('notePreview', { filePath: overrides.currentFilePath ?? '/notes/test.md' });
  } else if (overrides.currentScreen === 'noteList') {
    nav.push('noteList');
  } else if (overrides.currentScreen === 'search') {
    nav.push('search');
  } else if (overrides.currentScreen === 'capture') {
    nav.push('capture');
  } else if (overrides.currentScreen === 'editor') {
    nav.push('editor', { filePath: '/notes/test.md' });
  }

  return {
    nav,
    inputMode,
    exit,
    currentScreen: overrides.currentScreen ?? 'palette',
    currentFilePath: overrides.currentFilePath,
  };
}

describe('dispatchGlobalKey', () => {
  describe('Esc key', () => {
    it('does nothing on palette at root (stack depth 1)', () => {
      const nav = createNavigationStore();
      const exit = vi.fn();

      dispatchGlobalKey('', { escape: true }, {
        nav,
        inputMode: createInputModeStore(),
        currentScreen: 'palette',
        exit,
      });

      expect(exit).not.toHaveBeenCalled();
      expect(nav.stackDepth()).toBe(1);
    });

    it('pops navigation when stack depth > 1', () => {
      const opts = createOptions({ currentScreen: 'noteList' });

      dispatchGlobalKey('', { escape: true }, opts);

      expect(opts.nav.current().screen).toBe('palette');
      expect(opts.exit).not.toHaveBeenCalled();
    });

    it('works in text mode', () => {
      const opts = createOptions({ currentScreen: 'search', mode: 'text' });

      dispatchGlobalKey('', { escape: true }, opts);

      // Esc should still work in text mode — it pops
      expect(opts.nav.current().screen).not.toBe('search');
    });

    it('does not handle Esc on editor screen (EditorScreen handles its own)', () => {
      const opts = createOptions({ currentScreen: 'editor' });
      const depthBefore = opts.nav.stackDepth();

      dispatchGlobalKey('', { escape: true }, opts);

      // Esc should NOT pop — EditorScreen handles its own Esc
      expect(opts.nav.stackDepth()).toBe(depthBefore);
      expect(opts.exit).not.toHaveBeenCalled();
    });
  });

  describe('q key', () => {
    it('exits in navigation mode', () => {
      const opts = createOptions();

      dispatchGlobalKey('q', { escape: false }, opts);

      expect(opts.exit).toHaveBeenCalled();
    });

    it('is ignored in text mode', () => {
      const opts = createOptions({ mode: 'text' });

      dispatchGlobalKey('q', { escape: false }, opts);

      expect(opts.exit).not.toHaveBeenCalled();
    });
  });

  describe(': key', () => {
    it('pushes palette when not already on palette', () => {
      const opts = createOptions({ currentScreen: 'noteList' });

      dispatchGlobalKey(':', { escape: false }, opts);

      expect(opts.nav.current().screen).toBe('palette');
    });

    it('does not push palette when already on palette', () => {
      const opts = createOptions({ currentScreen: 'palette' });
      const depthBefore = opts.nav.stackDepth();

      dispatchGlobalKey(':', { escape: false }, opts);

      expect(opts.nav.stackDepth()).toBe(depthBefore);
    });
  });

  describe('/ key', () => {
    it('pushes search when not on search', () => {
      const opts = createOptions({ currentScreen: 'noteList' });

      dispatchGlobalKey('/', { escape: false }, opts);

      expect(opts.nav.current().screen).toBe('search');
    });

    it('pushes search from palette', () => {
      const opts = createOptions({ currentScreen: 'palette' });

      dispatchGlobalKey('/', { escape: false }, opts);

      expect(opts.nav.current().screen).toBe('search');
    });
  });

  describe('c key', () => {
    it('pushes capture from noteList', () => {
      const opts = createOptions({ currentScreen: 'noteList' });

      dispatchGlobalKey('c', { escape: false }, opts);

      expect(opts.nav.current().screen).toBe('capture');
    });

    it('does not push capture from palette', () => {
      const opts = createOptions({ currentScreen: 'palette' });
      const depthBefore = opts.nav.stackDepth();

      dispatchGlobalKey('c', { escape: false }, opts);

      expect(opts.nav.stackDepth()).toBe(depthBefore);
    });
  });

  describe('e key — opens built-in editor', () => {
    it('pushes editor screen with filePath when on notePreview', () => {
      const opts = createOptions({
        currentScreen: 'notePreview',
        currentFilePath: '/notes/my-note.md',
      });

      dispatchGlobalKey('e', { escape: false }, opts);

      const entry = opts.nav.current();
      expect(entry.screen).toBe('editor');
      if (entry.screen === 'editor') {
        expect(entry.filePath).toBe('/notes/my-note.md');
      }
    });

    it('does not push editor when not on notePreview', () => {
      const opts = createOptions({ currentScreen: 'noteList' });
      const depthBefore = opts.nav.stackDepth();

      dispatchGlobalKey('e', { escape: false }, opts);

      expect(opts.nav.stackDepth()).toBe(depthBefore);
    });

    it('does not push editor when currentFilePath is undefined', () => {
      const opts = createOptions({ currentScreen: 'notePreview' });
      const depthBefore = opts.nav.stackDepth();

      dispatchGlobalKey('e', { escape: false }, opts);

      expect(opts.nav.stackDepth()).toBe(depthBefore);
    });

    it('is ignored in text mode', () => {
      const opts = createOptions({
        currentScreen: 'notePreview',
        currentFilePath: '/notes/test.md',
        mode: 'text',
      });
      const depthBefore = opts.nav.stackDepth();

      dispatchGlobalKey('e', { escape: false }, opts);

      expect(opts.nav.stackDepth()).toBe(depthBefore);
    });
  });
});
