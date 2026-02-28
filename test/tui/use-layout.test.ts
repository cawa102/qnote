import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { Text } from 'ink';
import { render, cleanup } from 'ink-testing-library';

// Store original descriptors for cleanup
const originalDescriptors: Record<string, PropertyDescriptor | undefined> = {};

function mockStdout(overrides: {
  columns?: number;
  rows?: number;
  isTTY?: boolean;
}): void {
  for (const key of ['columns', 'rows', 'isTTY'] as const) {
    if (overrides[key] !== undefined) {
      originalDescriptors[key] = Object.getOwnPropertyDescriptor(process.stdout, key);
      Object.defineProperty(process.stdout, key, {
        get: () => overrides[key],
        configurable: true,
      });
    }
  }
}

function restoreStdout(): void {
  for (const key of Object.keys(originalDescriptors)) {
    const desc = originalDescriptors[key];
    if (desc) {
      Object.defineProperty(process.stdout, key, desc);
    } else {
      // Property didn't exist originally — delete the mock
      delete (process.stdout as Record<string, unknown>)[key];
    }
  }
  // Clear stored descriptors
  for (const key of Object.keys(originalDescriptors)) {
    delete originalDescriptors[key];
  }
}

describe('useLayout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset module cache so each test gets a fresh import
    vi.resetModules();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    restoreStdout();
  });

  it('returns default 80×24 with contentWidth=72 when stdout dimensions undefined', async () => {
    mockStdout({ columns: undefined as unknown as number, rows: undefined as unknown as number, isTTY: false });
    // Override to simulate undefined columns/rows
    Object.defineProperty(process.stdout, 'columns', {
      get: () => undefined,
      configurable: true,
    });
    Object.defineProperty(process.stdout, 'rows', {
      get: () => undefined,
      configurable: true,
    });

    const { useLayout } = await import('../../src/tui/hooks/use-layout.js');

    function TestComponent() {
      const layout = useLayout();
      return React.createElement(
        Text,
        null,
        `cols:${layout.columns},rows:${layout.rows},cw:${layout.contentWidth},tty:${layout.isTTY}`,
      );
    }

    const { lastFrame } = render(React.createElement(TestComponent));
    expect(lastFrame()).toContain('cols:80');
    expect(lastFrame()).toContain('rows:24');
    expect(lastFrame()).toContain('cw:72');
    expect(lastFrame()).toContain('tty:false');
  });

  it('returns actual dimensions when available', async () => {
    mockStdout({ columns: 120, rows: 40, isTTY: true });

    const { useLayout } = await import('../../src/tui/hooks/use-layout.js');

    function TestComponent() {
      const layout = useLayout();
      return React.createElement(
        Text,
        null,
        `cols:${layout.columns},rows:${layout.rows}`,
      );
    }

    const { lastFrame } = render(React.createElement(TestComponent));
    expect(lastFrame()).toContain('cols:120');
    expect(lastFrame()).toContain('rows:40');
  });

  it('contentWidth respects maxWidth parameter', async () => {
    mockStdout({ columns: 120, rows: 40, isTTY: true });

    const { useLayout } = await import('../../src/tui/hooks/use-layout.js');

    function TestComponent() {
      const layout = useLayout(60);
      return React.createElement(Text, null, `cw:${layout.contentWidth}`);
    }

    const { lastFrame } = render(React.createElement(TestComponent));
    // Math.max(20, Math.min(120 - 8, 60)) = Math.max(20, 60) = 60
    expect(lastFrame()).toContain('cw:60');
  });

  it('contentWidth has minimum of 20 (never 0 or negative)', async () => {
    mockStdout({ columns: 15, rows: 24, isTTY: true });

    const { useLayout } = await import('../../src/tui/hooks/use-layout.js');

    function TestComponent() {
      const layout = useLayout();
      return React.createElement(Text, null, `cw:${layout.contentWidth}`);
    }

    const { lastFrame } = render(React.createElement(TestComponent));
    // Math.max(20, Math.min(15 - 8, 100)) = Math.max(20, 7) = 20
    expect(lastFrame()).toContain('cw:20');
  });

  it('showTitleArt is false when columns < 60', async () => {
    mockStdout({ columns: 59, rows: 24, isTTY: true });

    const { useLayout } = await import('../../src/tui/hooks/use-layout.js');

    function TestComponent() {
      const layout = useLayout();
      return React.createElement(Text, null, `show:${layout.showTitleArt}`);
    }

    const { lastFrame } = render(React.createElement(TestComponent));
    expect(lastFrame()).toContain('show:false');
  });

  it('showTitleArt is false when rows < 20', async () => {
    mockStdout({ columns: 80, rows: 19, isTTY: true });

    const { useLayout } = await import('../../src/tui/hooks/use-layout.js');

    function TestComponent() {
      const layout = useLayout();
      return React.createElement(Text, null, `show:${layout.showTitleArt}`);
    }

    const { lastFrame } = render(React.createElement(TestComponent));
    expect(lastFrame()).toContain('show:false');
  });

  it('showTitleArt is false when not TTY', async () => {
    mockStdout({ columns: 80, rows: 24, isTTY: false });

    const { useLayout } = await import('../../src/tui/hooks/use-layout.js');

    function TestComponent() {
      const layout = useLayout();
      return React.createElement(Text, null, `show:${layout.showTitleArt}`);
    }

    const { lastFrame } = render(React.createElement(TestComponent));
    expect(lastFrame()).toContain('show:false');
  });

  it('showTitleArt is true when TTY and columns >= 60 and rows >= 20', async () => {
    mockStdout({ columns: 80, rows: 24, isTTY: true });

    const { useLayout } = await import('../../src/tui/hooks/use-layout.js');

    function TestComponent() {
      const layout = useLayout();
      return React.createElement(Text, null, `show:${layout.showTitleArt}`);
    }

    const { lastFrame } = render(React.createElement(TestComponent));
    expect(lastFrame()).toContain('show:true');
  });

  it('re-renders on terminal resize event (debounced)', async () => {
    mockStdout({ columns: 80, rows: 24, isTTY: true });

    const { useLayout } = await import('../../src/tui/hooks/use-layout.js');

    function TestComponent() {
      const layout = useLayout();
      return React.createElement(Text, null, `cols:${layout.columns}`);
    }

    const { lastFrame } = render(React.createElement(TestComponent));
    expect(lastFrame()).toContain('cols:80');

    // Simulate resize by changing mock and emitting event
    Object.defineProperty(process.stdout, 'columns', {
      get: () => 120,
      configurable: true,
    });

    React.act(() => {
      process.stdout.emit('resize');
    });

    // Before debounce, should still show old value
    expect(lastFrame()).toContain('cols:80');

    // After debounce delay
    React.act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(lastFrame()).toContain('cols:120');
  });

  it('cleanup removes resize listener on unmount', async () => {
    mockStdout({ columns: 80, rows: 24, isTTY: true });

    const { useLayout } = await import('../../src/tui/hooks/use-layout.js');

    function TestComponent() {
      const layout = useLayout();
      return React.createElement(Text, null, `cols:${layout.columns}`);
    }

    const removeSpy = vi.spyOn(process.stdout, 'removeListener');

    const { unmount } = render(React.createElement(TestComponent));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('debounces rapid resize events (only last value applied)', async () => {
    mockStdout({ columns: 80, rows: 24, isTTY: true });

    const { useLayout } = await import('../../src/tui/hooks/use-layout.js');

    function TestComponent() {
      const layout = useLayout();
      return React.createElement(Text, null, `cols:${layout.columns}`);
    }

    const { lastFrame } = render(React.createElement(TestComponent));
    expect(lastFrame()).toContain('cols:80');

    // Fire first resize
    Object.defineProperty(process.stdout, 'columns', {
      get: () => 100,
      configurable: true,
    });
    React.act(() => {
      process.stdout.emit('resize');
    });

    // Fire second resize before debounce completes (cancels previous)
    Object.defineProperty(process.stdout, 'columns', {
      get: () => 140,
      configurable: true,
    });
    React.act(() => {
      process.stdout.emit('resize');
    });

    // After debounce, should show the last value
    React.act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(lastFrame()).toContain('cols:140');
  });

  it('clears pending timer on unmount during debounce', async () => {
    mockStdout({ columns: 80, rows: 24, isTTY: true });

    const { useLayout } = await import('../../src/tui/hooks/use-layout.js');

    function TestComponent() {
      const layout = useLayout();
      return React.createElement(Text, null, `cols:${layout.columns}`);
    }

    const { lastFrame, unmount } = render(React.createElement(TestComponent));
    expect(lastFrame()).toContain('cols:80');

    // Fire resize event to start debounce timer
    React.act(() => {
      process.stdout.emit('resize');
    });

    // Unmount while timer is pending — should not throw
    unmount();

    // Advance timers — timer was cleared, no error
    React.act(() => {
      vi.advanceTimersByTime(200);
    });
  });
});
