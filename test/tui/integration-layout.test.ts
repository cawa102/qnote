import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC_DIR = join(import.meta.dirname, '..', '..', 'src', 'tui');

function readScreen(relativePath: string): string {
  return readFileSync(join(SRC_DIR, relativePath), 'utf-8');
}

describe('CenteredLayout integration', () => {
  describe('App.tsx wraps content in CenteredLayout with LayoutProvider', () => {
    const source = readScreen('../tui/App.tsx');

    it('imports CenteredLayout', () => {
      expect(source).toContain("import { CenteredLayout }");
    });

    it('imports LayoutProvider', () => {
      expect(source).toContain("LayoutProvider");
      expect(source).toContain("from './hooks/layout-context.js'");
    });

    it('wraps screen content in CenteredLayout', () => {
      expect(source).toContain('<CenteredLayout>');
    });

    it('wraps Footer in CenteredLayout', () => {
      // Footer should be wrapped in its own CenteredLayout
      const footerMatch = source.match(/<CenteredLayout>[\s\S]*?<Footer[\s\S]*?<\/CenteredLayout>/);
      expect(footerMatch).not.toBeNull();
    });

    it('wraps everything in LayoutProvider', () => {
      expect(source).toContain('<LayoutProvider>');
      expect(source).toContain('</LayoutProvider>');
    });
  });

  describe('screens use dynamic layout via useLayoutContext', () => {
    it('CommandPalette uses useLayoutContext and TitleBanner instead of hardcoded header', () => {
      const source = readScreen('screens/CommandPalette.tsx');
      expect(source).toContain('useLayoutContext');
      expect(source).toContain('TitleBanner');
      expect(source).toContain('contentWidth');
      expect(source).not.toContain('formatRuler(30)');
    });

    it('NoteList uses useLayoutContext with dynamic ruler', () => {
      const source = readScreen('screens/NoteList.tsx');
      expect(source).toContain('useLayoutContext');
      expect(source).toContain('contentWidth');
      expect(source).not.toContain('formatRuler(30)');
    });

    it('NotePreview uses useLayoutContext with dynamic ruler', () => {
      const source = readScreen('screens/NotePreview.tsx');
      expect(source).toContain('useLayoutContext');
      expect(source).toContain('contentWidth');
      expect(source).not.toContain('formatRuler(40)');
    });

    it('SearchScreen uses useLayoutContext with dynamic ruler', () => {
      const source = readScreen('screens/SearchScreen.tsx');
      expect(source).toContain('useLayoutContext');
      expect(source).toContain('contentWidth');
      expect(source).not.toContain('formatRuler(35)');
    });

    it('CaptureScreen uses useLayoutContext with dynamic ruler', () => {
      const source = readScreen('screens/CaptureScreen.tsx');
      expect(source).toContain('useLayoutContext');
      expect(source).toContain('contentWidth');
      expect(source).not.toContain('formatRuler(20)');
    });
  });

  describe('screens no longer have hardcoded padding={1}', () => {
    it('CommandPalette has no padding={1}', () => {
      const source = readScreen('screens/CommandPalette.tsx');
      expect(source).not.toContain('padding={1}');
    });

    it('NoteList has no padding={1}', () => {
      const source = readScreen('screens/NoteList.tsx');
      expect(source).not.toContain('padding={1}');
    });

    it('NotePreview has no padding={1}', () => {
      const source = readScreen('screens/NotePreview.tsx');
      expect(source).not.toContain('padding={1}');
    });

    it('SearchScreen has no padding={1}', () => {
      const source = readScreen('screens/SearchScreen.tsx');
      expect(source).not.toContain('padding={1}');
    });

    it('CaptureScreen has no padding={1}', () => {
      const source = readScreen('screens/CaptureScreen.tsx');
      expect(source).not.toContain('padding={1}');
    });
  });

  describe('no duplicate useLayout calls (H-1 fix)', () => {
    it('CenteredLayout uses context instead of direct useLayout', () => {
      const source = readScreen('components/CenteredLayout.tsx');
      expect(source).toContain('useLayoutContext');
      expect(source).not.toContain("from '../hooks/use-layout.js'");
    });

    it('screens do not import useLayout directly', () => {
      const screens = [
        'screens/CommandPalette.tsx',
        'screens/NoteList.tsx',
        'screens/NotePreview.tsx',
        'screens/SearchScreen.tsx',
        'screens/CaptureScreen.tsx',
      ];
      for (const screen of screens) {
        const source = readScreen(screen);
        expect(source).not.toContain("from '../hooks/use-layout.js'");
        expect(source).toContain("from '../hooks/layout-context.js'");
      }
    });
  });
});
