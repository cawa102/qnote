import { useInput, useApp } from 'ink';
import type { NavigationStore } from './use-navigation.js';
import type { InputModeStore } from './use-input-mode.js';

interface UseGlobalKeysOptions {
  readonly nav: NavigationStore;
  readonly inputMode: InputModeStore;
  readonly currentScreen: string;
}

export function useGlobalKeys({ nav, inputMode, currentScreen }: UseGlobalKeysOptions): void {
  const { exit } = useApp();

  useInput((input, key) => {
    const mode = inputMode.current();

    // Esc — always works: pop navigation stack or exit
    if (key.escape) {
      if (nav.stackDepth() <= 1) {
        exit();
      } else {
        nav.pop();
      }
      return;
    }

    // In text mode, only Esc is handled globally
    if (mode === 'text') return;

    // q — quit from any screen (navigation mode only)
    if (input === 'q') {
      exit();
      return;
    }

    // : — open command palette
    if (input === ':' && currentScreen !== 'palette') {
      nav.push('palette');
      return;
    }

    // / — open search
    if (input === '/' && currentScreen !== 'search') {
      nav.push('search');
      return;
    }

    // c — open capture
    if (input === 'c' && currentScreen !== 'capture' && currentScreen !== 'palette') {
      nav.push('capture');
    }
  });
}
