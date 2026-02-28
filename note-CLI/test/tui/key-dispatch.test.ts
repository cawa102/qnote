import { describe, it, expect, vi } from 'vitest';
import { dispatchGlobalKey } from '../../src/tui/hooks/key-dispatch.js';
import { createNavigationStore } from '../../src/tui/hooks/use-navigation.js';
import { createInputModeStore } from '../../src/tui/hooks/use-input-mode.js';

function createOptions(overrides: {
  currentScreen?: string;
  mode?: 'navigation' | 'text';
  onRequestEditor?: (filePath: string) => void;
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
  }

  return {
    nav,
    inputMode,
    exit,
    currentScreen: overrides.currentScreen ?? 'palette',
    onRequestEditor: overrides.onRequestEditor,
    currentFilePath: overrides.currentFilePath,
  };
}

describe('dispatchGlobalKey', () => {
  describe('Esc key', () => {
    it('calls exit when at root (stack depth 1)', () => {
      const opts = createOptions();
      // Reset to root only (palette)
      const nav = createNavigationStore();
      const exit = vi.fn();

      dispatchGlobalKey('', { escape: true }, {
        nav,
        inputMode: createInputModeStore(),
        currentScreen: 'palette',
        exit,
      });

      expect(exit).toHaveBeenCalled();
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

  describe('e key — onRequestEditor', () => {
    it('calls onRequestEditor with filePath when on notePreview', () => {
      const onRequestEditor = vi.fn();
      const opts = createOptions({
        currentScreen: 'notePreview',
        onRequestEditor,
        currentFilePath: '/notes/my-note.md',
      });

      dispatchGlobalKey('e', { escape: false }, opts);

      expect(onRequestEditor).toHaveBeenCalledWith('/notes/my-note.md');
    });

    it('does not call onRequestEditor when not on notePreview', () => {
      const onRequestEditor = vi.fn();
      const opts = createOptions({
        currentScreen: 'noteList',
        onRequestEditor,
      });

      dispatchGlobalKey('e', { escape: false }, opts);

      expect(onRequestEditor).not.toHaveBeenCalled();
    });

    it('does not error when onRequestEditor is undefined', () => {
      const opts = createOptions({ currentScreen: 'notePreview' });

      expect(() => {
        dispatchGlobalKey('e', { escape: false }, opts);
      }).not.toThrow();
    });

    it('is ignored in text mode', () => {
      const onRequestEditor = vi.fn();
      const opts = createOptions({
        currentScreen: 'notePreview',
        onRequestEditor,
        mode: 'text',
      });

      dispatchGlobalKey('e', { escape: false }, opts);

      expect(onRequestEditor).not.toHaveBeenCalled();
    });
  });
});
