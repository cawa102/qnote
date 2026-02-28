import { useState, useEffect } from 'react';

export interface DebouncedFn<T extends (...args: unknown[]) => void> {
  (...args: Parameters<T>): void;
  cancel(): void;
}

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number,
): DebouncedFn<T> {
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>): void => {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      fn(...args);
      timerId = null;
    }, delayMs);
  };

  debounced.cancel = (): void => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  return debounced as DebouncedFn<T>;
}

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
