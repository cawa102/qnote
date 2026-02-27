import type { ScreenName } from '../../types.js';

export interface ScreenEntry {
  readonly screen: ScreenName;
  readonly params?: Record<string, unknown>;
}

export interface NavigationStore {
  current(): ScreenEntry;
  push(screen: ScreenName, params?: Record<string, unknown>): void;
  pop(): void;
  reset(): void;
  stackDepth(): number;
  subscribe(listener: () => void): () => void;
}

export function createNavigationStore(): NavigationStore {
  let stack: readonly ScreenEntry[] = [{ screen: 'palette' }];
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    current(): ScreenEntry {
      return stack[stack.length - 1]!;
    },

    push(screen: ScreenName, params?: Record<string, unknown>): void {
      stack = [...stack, { screen, params }];
      notify();
    },

    pop(): void {
      if (stack.length > 1) {
        stack = stack.slice(0, -1);
        notify();
      }
    },

    reset(): void {
      stack = [{ screen: 'palette' }];
      notify();
    },

    stackDepth(): number {
      return stack.length;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
