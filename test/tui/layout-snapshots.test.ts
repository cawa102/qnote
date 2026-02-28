import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { Box, Text } from 'ink';
import { render, cleanup } from 'ink-testing-library';

// Mock useLayoutContext to control terminal dimensions
vi.mock('../../src/tui/hooks/layout-context.js', () => ({
  useLayoutContext: vi.fn(),
}));

import type { LayoutInfo } from '../../src/tui/hooks/use-layout.js';
import { useLayoutContext } from '../../src/tui/hooks/layout-context.js';
import { CenteredLayout } from '../../src/tui/components/CenteredLayout.js';
import { TitleBanner } from '../../src/tui/components/TitleBanner.js';
import { TITLE_WIDTH } from '../../src/tui/assets/title-art.js';

const mockUseLayoutContext = vi.mocked(useLayoutContext);

function makeLayout(overrides: Partial<LayoutInfo> = {}): LayoutInfo {
  const columns = overrides.columns ?? 80;
  const rows = overrides.rows ?? 24;
  const isTTY = overrides.isTTY ?? true;
  const contentWidth = overrides.contentWidth ?? Math.max(20, Math.min(columns - 8, 100));
  const showTitleArt = overrides.showTitleArt ?? (isTTY && columns >= 60 && rows >= 20);
  return { columns, rows, contentWidth, isTTY, showTitleArt };
}

function SampleContent({ label }: { readonly label: string }): React.ReactElement {
  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Text, null, `=== ${label} ===`),
    React.createElement(Text, null, 'Sample content line'),
  );
}

describe('Layout Snapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('CenteredLayout at various terminal sizes', () => {
    it('80×24 standard terminal — centers content with padding', () => {
      const layout = makeLayout({ columns: 80, rows: 24 });
      mockUseLayoutContext.mockReturnValue(layout);

      const { lastFrame } = render(
        React.createElement(CenteredLayout, null,
          React.createElement(SampleContent, { label: 'Standard' }),
        ),
      );

      const frame = lastFrame()!;
      expect(frame).toMatchSnapshot();

      // Verify centering: paddingLeft = Math.floor((80 - 72) / 2) = 4
      const lines = frame.split('\n');
      const contentLine = lines.find(l => l.includes('Standard'))!;
      const leadingSpaces = contentLine.length - contentLine.trimStart().length;
      expect(leadingSpaces).toBe(4);
    });

    it('120×40 wide terminal — content stays at maxWidth=100', () => {
      const layout = makeLayout({ columns: 120, rows: 40 });
      mockUseLayoutContext.mockReturnValue(layout);

      const { lastFrame } = render(
        React.createElement(CenteredLayout, null,
          React.createElement(SampleContent, { label: 'Wide' }),
        ),
      );

      const frame = lastFrame()!;
      expect(frame).toMatchSnapshot();

      // paddingLeft = Math.floor((120 - 100) / 2) = 10
      const lines = frame.split('\n');
      const contentLine = lines.find(l => l.includes('Wide'))!;
      const leadingSpaces = contentLine.length - contentLine.trimStart().length;
      expect(leadingSpaces).toBe(10);
    });

    it('40×20 compact terminal — reduced content width, still centered', () => {
      const layout = makeLayout({ columns: 40, rows: 20 });
      mockUseLayoutContext.mockReturnValue(layout);

      const { lastFrame } = render(
        React.createElement(CenteredLayout, null,
          React.createElement(SampleContent, { label: 'Compact' }),
        ),
      );

      const frame = lastFrame()!;
      expect(frame).toMatchSnapshot();

      // contentWidth = Math.min(40 - 8, 100) = 32
      // paddingLeft = Math.floor((40 - 32) / 2) = 4
      const lines = frame.split('\n');
      const contentLine = lines.find(l => l.includes('Compact'))!;
      const leadingSpaces = contentLine.length - contentLine.trimStart().length;
      expect(leadingSpaces).toBe(4);
    });

    it('25×15 minimal terminal — minimum contentWidth=20', () => {
      const layout = makeLayout({ columns: 25, rows: 15, contentWidth: 20 });
      mockUseLayoutContext.mockReturnValue(layout);

      const { lastFrame } = render(
        React.createElement(CenteredLayout, null,
          React.createElement(SampleContent, { label: 'Minimal' }),
        ),
      );

      const frame = lastFrame()!;
      expect(frame).toMatchSnapshot();

      // paddingLeft = Math.floor((25 - 20) / 2) = 2
      const lines = frame.split('\n');
      const contentLine = lines.find(l => l.includes('Minimal'))!;
      const leadingSpaces = contentLine.length - contentLine.trimStart().length;
      expect(leadingSpaces).toBe(2);
    });

    it('non-TTY — no centering, content is left-aligned', () => {
      const layout = makeLayout({ columns: 80, rows: 24, isTTY: false });
      mockUseLayoutContext.mockReturnValue(layout);

      const { lastFrame } = render(
        React.createElement(CenteredLayout, null,
          React.createElement(SampleContent, { label: 'NonTTY' }),
        ),
      );

      const frame = lastFrame()!;
      expect(frame).toMatchSnapshot();

      // No padding
      const lines = frame.split('\n');
      const contentLine = lines.find(l => l.includes('NonTTY'))!;
      const leadingSpaces = contentLine.length - contentLine.trimStart().length;
      expect(leadingSpaces).toBe(0);
    });
  });

  describe('Display tier flags', () => {
    it('80×24 TTY shows title art flag as true', () => {
      const layout = makeLayout({ columns: 80, rows: 24, isTTY: true });
      expect(layout.showTitleArt).toBe(true);
    });

    it('40×20 TTY shows title art flag as false (columns < 60)', () => {
      const layout = makeLayout({ columns: 40, rows: 20, isTTY: true });
      expect(layout.showTitleArt).toBe(false);
    });

    it('80×15 TTY shows title art flag as false (rows < 20)', () => {
      const layout = makeLayout({ columns: 80, rows: 15, isTTY: true });
      expect(layout.showTitleArt).toBe(false);
    });

    it('non-TTY shows title art flag as false regardless of size', () => {
      const layout = makeLayout({ columns: 120, rows: 40, isTTY: false });
      expect(layout.showTitleArt).toBe(false);
    });
  });

  describe('Progressive degradation', () => {
    it('renders centered content with art at large size', () => {
      const layout = makeLayout({ columns: 120, rows: 40 });
      mockUseLayoutContext.mockReturnValue(layout);

      expect(layout.showTitleArt).toBe(true);
      expect(layout.contentWidth).toBe(100);

      const { lastFrame } = render(
        React.createElement(CenteredLayout, null,
          React.createElement(Text, null,
            layout.showTitleArt ? 'ART MODE' : 'PLAIN MODE',
          ),
        ),
      );

      expect(lastFrame()).toContain('ART MODE');
    });

    it('renders left-aligned plain content at non-TTY', () => {
      const layout = makeLayout({ columns: 80, rows: 24, isTTY: false });
      mockUseLayoutContext.mockReturnValue(layout);

      expect(layout.showTitleArt).toBe(false);

      const { lastFrame } = render(
        React.createElement(CenteredLayout, null,
          React.createElement(Text, null,
            layout.showTitleArt ? 'ART MODE' : 'PLAIN MODE',
          ),
        ),
      );

      const frame = lastFrame()!;
      expect(frame).toContain('PLAIN MODE');
      // Verify no centering padding
      const lines = frame.split('\n');
      const contentLine = lines.find(l => l.includes('PLAIN'))!;
      expect(contentLine.length - contentLine.trimStart().length).toBe(0);
    });
  });

  describe('TitleBanner snapshots at each terminal size', () => {
    it('80×24 standard — shows plain text (contentWidth 72 < title width 83)', () => {
      const layout = makeLayout({ columns: 80, rows: 24 });

      const { lastFrame } = render(
        React.createElement(TitleBanner, {
          contentWidth: layout.contentWidth,
          showTitleArt: layout.showTitleArt,
        }),
      );

      const frame = lastFrame()!;
      expect(frame).toContain('Queen Note');
      expect(frame).not.toMatch(/[╗╔║╚╝═]/);
      expect(frame).toMatchSnapshot();
    });

    it('40×20 compact — shows plain text (columns < 60)', () => {
      const layout = makeLayout({ columns: 40, rows: 20 });

      const { lastFrame } = render(
        React.createElement(TitleBanner, {
          contentWidth: layout.contentWidth,
          showTitleArt: layout.showTitleArt,
        }),
      );

      const frame = lastFrame()!;
      expect(frame).toContain('Queen Note');
      expect(frame).not.toMatch(/[█▀▄▌▐]/);
      expect(frame).toMatchSnapshot();
    });

    it('120×40 wide — shows block art title', () => {
      const layout = makeLayout({ columns: 120, rows: 40 });

      const { lastFrame } = render(
        React.createElement(TitleBanner, {
          contentWidth: layout.contentWidth,
          showTitleArt: layout.showTitleArt,
        }),
      );

      const frame = lastFrame()!;
      expect(frame).toMatch(/[█▀▄▌▐]/);
      expect(frame).toMatch(/[╗╔║╚╝═]/);
      expect(frame).toMatchSnapshot();
    });

    it('25×15 minimal — shows plain text fallback', () => {
      const layout = makeLayout({ columns: 25, rows: 15, contentWidth: 20 });

      const { lastFrame } = render(
        React.createElement(TitleBanner, {
          contentWidth: layout.contentWidth,
          showTitleArt: layout.showTitleArt,
        }),
      );

      const frame = lastFrame()!;
      expect(frame).toContain('Queen Note');
      expect(frame).not.toMatch(/[█▀▄▌▐]/);
      expect(frame).toMatchSnapshot();
    });

    it('non-TTY — shows plain text regardless of size', () => {
      const layout = makeLayout({ columns: 80, rows: 24, isTTY: false });

      const { lastFrame } = render(
        React.createElement(TitleBanner, {
          contentWidth: layout.contentWidth,
          showTitleArt: layout.showTitleArt,
        }),
      );

      const frame = lastFrame()!;
      expect(frame).toContain('Queen Note');
      expect(frame).not.toMatch(/[█▀▄▌▐]/);
    });
  });

  describe('TITLE_WIDTH boundary', () => {
    it('block art shown when contentWidth equals TITLE_WIDTH exactly', () => {
      const { lastFrame } = render(
        React.createElement(TitleBanner, {
          contentWidth: TITLE_WIDTH,
          showTitleArt: true,
        }),
      );
      expect(lastFrame()).toMatch(/[█▀▄▌▐]/);
    });

    it('plain text shown when contentWidth is one below TITLE_WIDTH', () => {
      const { lastFrame } = render(
        React.createElement(TitleBanner, {
          contentWidth: TITLE_WIDTH - 1,
          showTitleArt: true,
        }),
      );
      expect(lastFrame()).toContain('Queen Note');
      expect(lastFrame()).not.toMatch(/[█▀▄▌▐]/);
    });
  });
});
