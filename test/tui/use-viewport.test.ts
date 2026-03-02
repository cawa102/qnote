import { describe, it, expect } from 'vitest';
import React from 'react';
import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { useViewport } from '../../src/tui/hooks/use-viewport.js';

/**
 * Tiny wrapper component that renders the hook's output as text
 * so we can assert on it via ink-testing-library.
 */
function ViewportDisplay({
  totalItems,
  selectedIndex,
  maxVisible,
}: {
  totalItems: number;
  selectedIndex: number;
  maxVisible: number;
}): React.ReactElement {
  const { scrollOffset, visibleCount } = useViewport(totalItems, selectedIndex, maxVisible);
  return React.createElement(Text, null, `${scrollOffset},${visibleCount}`);
}

function getValues(totalItems: number, selectedIndex: number, maxVisible: number) {
  const { lastFrame } = render(
    React.createElement(ViewportDisplay, { totalItems, selectedIndex, maxVisible }),
  );
  const [offset, count] = lastFrame()!.split(',').map(Number);
  return { scrollOffset: offset!, visibleCount: count! };
}

describe('useViewport', () => {
  it('returns zero offset when items fit within viewport', () => {
    const { scrollOffset, visibleCount } = getValues(5, 0, 10);
    expect(scrollOffset).toBe(0);
    expect(visibleCount).toBe(5);
  });

  it('returns zero offset when selected index is within first page', () => {
    const { scrollOffset, visibleCount } = getValues(20, 3, 10);
    expect(scrollOffset).toBe(0);
    expect(visibleCount).toBe(10);
  });

  it('scrolls when selected index exceeds viewport', () => {
    const { scrollOffset, visibleCount } = getValues(20, 12, 10);
    // selectedIndex=12, maxVisible=10 → offset = 12 - 10 + 1 = 3
    expect(scrollOffset).toBe(3);
    expect(visibleCount).toBe(10);
  });

  it('keeps selected item at bottom of viewport when scrolling', () => {
    const { scrollOffset } = getValues(50, 25, 10);
    // offset = 25 - 10 + 1 = 16
    expect(scrollOffset).toBe(16);
  });

  it('handles selectedIndex at the last item', () => {
    const { scrollOffset, visibleCount } = getValues(20, 19, 10);
    // offset = 19 - 10 + 1 = 10
    expect(scrollOffset).toBe(10);
    expect(visibleCount).toBe(10);
  });

  it('handles negative selectedIndex', () => {
    const { scrollOffset } = getValues(10, -1, 5);
    expect(scrollOffset).toBe(0);
  });

  it('handles zero maxVisible', () => {
    const { scrollOffset, visibleCount } = getValues(10, 0, 0);
    expect(scrollOffset).toBe(0);
    expect(visibleCount).toBe(0);
  });

  it('handles negative maxVisible by clamping to 0', () => {
    const { scrollOffset, visibleCount } = getValues(10, 0, -5);
    expect(scrollOffset).toBe(0);
    expect(visibleCount).toBe(0);
  });

  it('handles empty list', () => {
    const { scrollOffset, visibleCount } = getValues(0, 0, 10);
    expect(scrollOffset).toBe(0);
    expect(visibleCount).toBe(0);
  });

  it('handles selectedIndex exactly at maxVisible boundary', () => {
    // selectedIndex=9, maxVisible=10 → still on first page (index < maxVisible)
    const { scrollOffset: offset1 } = getValues(20, 9, 10);
    expect(offset1).toBe(0);

    // selectedIndex=10, maxVisible=10 → just past first page
    const { scrollOffset: offset2 } = getValues(20, 10, 10);
    expect(offset2).toBe(1);
  });
});
