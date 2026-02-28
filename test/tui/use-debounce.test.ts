import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { useState } from 'react';
import { Text } from 'ink';
import { render, cleanup } from 'ink-testing-library';
import { debounce, useDebounce } from '../../src/tui/hooks/use-debounce.js';

describe('debounce', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays function execution', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 150);

    debounced('hello');
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(fn).toHaveBeenCalledWith('hello');
  });

  it('cancels previous call when called again within delay', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 150);

    debounced('first');
    vi.advanceTimersByTime(100);
    debounced('second');
    vi.advanceTimersByTime(150);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('second');
  });

  it('can be cancelled explicitly', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 150);

    debounced('hello');
    debounced.cancel();
    vi.advanceTimersByTime(200);

    expect(fn).not.toHaveBeenCalled();
  });

  it('cancel is a noop when no timer is active', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 150);

    // Cancel without ever calling debounced — should not throw
    expect(() => debounced.cancel()).not.toThrow();
  });
});

describe('useDebounce hook', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    function TestComponent() {
      const debouncedVal = useDebounce('initial', 100);
      return React.createElement(Text, null, debouncedVal);
    }

    const { lastFrame } = render(React.createElement(TestComponent));
    expect(lastFrame()).toContain('initial');
  });

  it('returns debounced value after delay', async () => {
    vi.useFakeTimers();

    let setValue: (v: string) => void = () => {};

    function TestComponent() {
      const [val, setVal] = useState('first');
      setValue = setVal;
      const debouncedVal = useDebounce(val, 100);
      return React.createElement(Text, null, `debounced:${debouncedVal}`);
    }

    const { lastFrame } = render(React.createElement(TestComponent));
    expect(lastFrame()).toContain('debounced:first');

    // Update value
    React.act(() => {
      setValue('second');
    });

    // Before delay, should still show old value
    expect(lastFrame()).toContain('debounced:first');

    // After delay, should show new value
    React.act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(lastFrame()).toContain('debounced:second');
  });
});
