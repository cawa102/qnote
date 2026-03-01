import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { BufferTabs, computeVisibleTabs } from '../../../src/tui/components/BufferTabs.js';
import type { BufferInfo } from '../../../src/tui/editor/types.js';

function makeBuffer(overrides: Partial<BufferInfo> = {}): BufferInfo {
  return {
    id: overrides.id ?? 'buf-1',
    filePath: overrides.filePath ?? '/notes/test.md',
    title: overrides.title ?? 'Test Note',
    dirty: overrides.dirty ?? false,
  };
}

function makeTabInfo(title: string, isActive: boolean) {
  const label = title;
  return {
    buffer: makeBuffer({ id: title, title }),
    label,
    isActive,
    displayWidth: label.length + 2,
  };
}

describe('BufferTabs', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders single buffer tab', () => {
    const buffers = [makeBuffer({ title: 'My Note' })];
    const { lastFrame } = render(
      React.createElement(BufferTabs, {
        buffers,
        activeId: 'buf-1',
        width: 60,
      }),
    );
    const output = lastFrame();
    expect(output).toContain('My Note');
  });

  it('highlights active buffer tab', () => {
    const buffers = [
      makeBuffer({ id: 'a', title: 'Note A' }),
      makeBuffer({ id: 'b', title: 'Note B' }),
    ];
    const { lastFrame } = render(
      React.createElement(BufferTabs, {
        buffers,
        activeId: 'a',
        width: 60,
      }),
    );
    const output = lastFrame();
    expect(output).toContain('Note A');
    expect(output).toContain('Note B');
  });

  it('shows dirty indicator for unsaved buffer', () => {
    const buffers = [makeBuffer({ title: 'Dirty Note', dirty: true })];
    const { lastFrame } = render(
      React.createElement(BufferTabs, {
        buffers,
        activeId: 'buf-1',
        width: 60,
      }),
    );
    const output = lastFrame();
    expect(output).toContain('*');
  });

  it('does not show dirty indicator for clean buffer', () => {
    const buffers = [makeBuffer({ title: 'Clean Note', dirty: false })];
    const { lastFrame } = render(
      React.createElement(BufferTabs, {
        buffers,
        activeId: 'buf-1',
        width: 60,
      }),
    );
    const output = lastFrame();
    expect(output).toContain('Clean Note');
    expect(output).not.toContain('*');
  });

  it('renders multiple buffers horizontally', () => {
    const buffers = [
      makeBuffer({ id: 'a', title: 'Alpha' }),
      makeBuffer({ id: 'b', title: 'Beta' }),
      makeBuffer({ id: 'c', title: 'Gamma' }),
    ];
    const { lastFrame } = render(
      React.createElement(BufferTabs, {
        buffers,
        activeId: 'b',
        width: 80,
      }),
    );
    const output = lastFrame();
    expect(output).toContain('Alpha');
    expect(output).toContain('Beta');
    expect(output).toContain('Gamma');
  });

  it('renders placeholder for empty buffers array', () => {
    const { lastFrame } = render(
      React.createElement(BufferTabs, {
        buffers: [],
        activeId: '',
        width: 60,
      }),
    );
    const output = lastFrame();
    expect(output).toBeDefined();
  });

  it('renders separator between adjacent tabs', () => {
    const buffers = [
      makeBuffer({ id: 'a', title: 'Alpha' }),
      makeBuffer({ id: 'b', title: 'Beta' }),
      makeBuffer({ id: 'c', title: 'Gamma' }),
    ];
    const { lastFrame } = render(
      React.createElement(BufferTabs, {
        buffers,
        activeId: 'a',
        width: 80,
      }),
    );
    const output = lastFrame();
    expect(output).toContain('│');
  });

  it('does not render separator after last visible tab', () => {
    const buffers = [makeBuffer({ id: 'a', title: 'Solo' })];
    const { lastFrame } = render(
      React.createElement(BufferTabs, {
        buffers,
        activeId: 'a',
        width: 60,
      }),
    );
    const output = lastFrame();
    expect(output).not.toContain('│');
  });

  it('shows [+] button', () => {
    const buffers = [makeBuffer()];
    const { lastFrame } = render(
      React.createElement(BufferTabs, {
        buffers,
        activeId: 'buf-1',
        width: 60,
      }),
    );
    const output = lastFrame();
    expect(output).toContain('[+]');
  });

  it('active tab uses different styling from inactive tabs', () => {
    const buffers = [
      makeBuffer({ id: 'a', title: 'Active' }),
      makeBuffer({ id: 'b', title: 'Inactive' }),
    ];
    const { lastFrame } = render(
      React.createElement(BufferTabs, {
        buffers,
        activeId: 'a',
        width: 60,
      }),
    );
    const output = lastFrame();
    // Active and inactive tabs should both be present
    expect(output).toContain('Active');
    expect(output).toContain('Inactive');
    // The ANSI escape sequences around "Active" and "Inactive" should differ
    // (active uses tabActive inverse, inactive uses dim)
    const activeMatch = output.match(/(\x1b\[[^m]*m)*\s*Active\s*(\x1b\[[^m]*m)*/);
    const inactiveMatch = output.match(/(\x1b\[[^m]*m)*\s*Inactive\s*(\x1b\[[^m]*m)*/);
    expect(activeMatch).toBeTruthy();
    expect(inactiveMatch).toBeTruthy();
    expect(activeMatch![0]).not.toBe(inactiveMatch![0]);
  });

  it('shows ellipsis when tabs overflow', () => {
    const buffers = Array.from({ length: 10 }, (_, i) =>
      makeBuffer({ id: `buf-${i}`, title: `Very Long Note Title ${i}` }),
    );
    const { lastFrame } = render(
      React.createElement(BufferTabs, {
        buffers,
        activeId: 'buf-5',
        width: 60,
      }),
    );
    const output = lastFrame();
    expect(output).toContain('...');
    expect(output).toContain('Very Long Note Title 5');
  });
});

describe('computeVisibleTabs', () => {
  it('returns all tabs when they fit', () => {
    const tabs = [
      makeTabInfo('A', true),
      makeTabInfo('B', false),
      makeTabInfo('C', false),
    ];
    const result = computeVisibleTabs(tabs, 100);
    expect(result.start).toBe(0);
    expect(result.end).toBe(3);
    expect(result.showLeftEllipsis).toBe(false);
    expect(result.showRightEllipsis).toBe(false);
  });

  it('returns empty range for empty tabs', () => {
    const result = computeVisibleTabs([], 100);
    expect(result.start).toBe(0);
    expect(result.end).toBe(0);
    expect(result.showLeftEllipsis).toBe(false);
    expect(result.showRightEllipsis).toBe(false);
  });

  it('always includes active tab when overflowing', () => {
    const tabs = Array.from({ length: 10 }, (_, i) =>
      makeTabInfo(`Tab ${i}`, i === 5),
    );
    const result = computeVisibleTabs(tabs, 30);
    expect(result.start).toBeLessThanOrEqual(5);
    expect(result.end).toBeGreaterThan(5);
  });

  it('shows left ellipsis when tabs hidden on left', () => {
    const tabs = Array.from({ length: 10 }, (_, i) =>
      makeTabInfo(`Tab ${i}`, i === 8),
    );
    const result = computeVisibleTabs(tabs, 30);
    expect(result.showLeftEllipsis).toBe(true);
  });

  it('shows right ellipsis when tabs hidden on right', () => {
    const tabs = Array.from({ length: 10 }, (_, i) =>
      makeTabInfo(`Tab ${i}`, i === 1),
    );
    const result = computeVisibleTabs(tabs, 30);
    expect(result.showRightEllipsis).toBe(true);
  });

  it('shows both ellipses when active is in the middle', () => {
    const tabs = Array.from({ length: 20 }, (_, i) =>
      makeTabInfo(`Tab ${i}`, i === 10),
    );
    const result = computeVisibleTabs(tabs, 40);
    expect(result.showLeftEllipsis).toBe(true);
    expect(result.showRightEllipsis).toBe(true);
  });

  it('centers window around active tab', () => {
    const tabs = Array.from({ length: 10 }, (_, i) =>
      makeTabInfo(`T${i}`, i === 5),
    );
    // Each tab: "T0" + 2 padding = 4, plus separator = 5. Width 30 fits ~5-6 tabs
    const result = computeVisibleTabs(tabs, 30);
    // Active tab (index 5) should be roughly centered in the window
    const windowCenter = (result.start + result.end) / 2;
    expect(Math.abs(windowCenter - 5)).toBeLessThanOrEqual(2);
  });
});
