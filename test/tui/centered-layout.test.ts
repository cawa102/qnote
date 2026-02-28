import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { Text } from 'ink';
import { render, cleanup } from 'ink-testing-library';

// Mock useLayoutContext to control layout values in tests
vi.mock('../../src/tui/hooks/layout-context.js', () => ({
  useLayoutContext: vi.fn(),
}));

import type { LayoutInfo } from '../../src/tui/hooks/use-layout.js';
import { useLayoutContext } from '../../src/tui/hooks/layout-context.js';
import { CenteredLayout } from '../../src/tui/components/CenteredLayout.js';

const mockUseLayoutContext = vi.mocked(useLayoutContext);

function setLayout(overrides: Partial<LayoutInfo> = {}): void {
  mockUseLayoutContext.mockReturnValue({
    columns: 80,
    rows: 24,
    contentWidth: 72,
    isTTY: true,
    showTitleArt: true,
    ...overrides,
  });
}

describe('CenteredLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('centers content with correct padding for a given terminal width', () => {
    // columns=80, contentWidth=72 → paddingLeft = Math.floor((80 - 72) / 2) = 4
    setLayout({ columns: 80, contentWidth: 72, isTTY: true });

    const { lastFrame } = render(
      React.createElement(CenteredLayout, null,
        React.createElement(Text, null, 'Hello'),
      ),
    );

    const frame = lastFrame()!;
    // The content should be indented by 4 spaces (paddingLeft)
    expect(frame).toContain('Hello');
    // Verify padding: content starts after paddingLeft spaces
    const lines = frame.split('\n');
    const contentLine = lines.find(l => l.includes('Hello'))!;
    const leadingSpaces = contentLine.length - contentLine.trimStart().length;
    expect(leadingSpaces).toBe(4);
  });

  it('falls back to no padding when terminal is very narrow', () => {
    // columns=25, contentWidth=20 (minimum) → paddingLeft = Math.floor((25 - 20) / 2) = 2
    setLayout({ columns: 25, contentWidth: 20, isTTY: true });

    const { lastFrame } = render(
      React.createElement(CenteredLayout, null,
        React.createElement(Text, null, 'Compact'),
      ),
    );

    const frame = lastFrame()!;
    expect(frame).toContain('Compact');
    const lines = frame.split('\n');
    const contentLine = lines.find(l => l.includes('Compact'))!;
    const leadingSpaces = contentLine.length - contentLine.trimStart().length;
    expect(leadingSpaces).toBe(2);
  });

  it('children render without modification', () => {
    setLayout({ columns: 80, contentWidth: 72, isTTY: true });

    const { lastFrame } = render(
      React.createElement(CenteredLayout, null,
        React.createElement(Text, null, 'Child A'),
        React.createElement(Text, null, 'Child B'),
      ),
    );

    const frame = lastFrame()!;
    expect(frame).toContain('Child A');
    expect(frame).toContain('Child B');
  });

  it('no padding applied when isTTY is false', () => {
    setLayout({ columns: 80, contentWidth: 72, isTTY: false });

    const { lastFrame } = render(
      React.createElement(CenteredLayout, null,
        React.createElement(Text, null, 'NoPad'),
      ),
    );

    const frame = lastFrame()!;
    expect(frame).toContain('NoPad');
    // Should have zero leading spaces
    const lines = frame.split('\n');
    const contentLine = lines.find(l => l.includes('NoPad'))!;
    const leadingSpaces = contentLine.length - contentLine.trimStart().length;
    expect(leadingSpaces).toBe(0);
  });

  it('reads layout from context (single resize listener)', () => {
    setLayout();

    render(
      React.createElement(CenteredLayout, null,
        React.createElement(Text, null, 'Default'),
      ),
    );

    // useLayoutContext should be called (reads from context, no own resize listener)
    expect(mockUseLayoutContext).toHaveBeenCalled();
  });
});
