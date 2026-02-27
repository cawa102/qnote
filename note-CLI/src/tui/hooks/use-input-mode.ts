export type InputMode = 'navigation' | 'text';

export interface InputModeStore {
  current(): InputMode;
  set(mode: InputMode): void;
  subscribe(listener: () => void): () => void;
}

export function createInputModeStore(): InputModeStore {
  let mode: InputMode = 'navigation';
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    current() {
      return mode;
    },

    set(newMode: InputMode) {
      if (mode !== newMode) {
        mode = newMode;
        notify();
      }
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
