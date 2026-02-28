import { useInput, useApp } from 'ink';
import { dispatchGlobalKey } from './key-dispatch.js';
import type { NavigationStore } from './use-navigation.js';
import type { InputModeStore } from './use-input-mode.js';

interface UseGlobalKeysOptions {
  readonly nav: NavigationStore;
  readonly inputMode: InputModeStore;
  readonly currentScreen: string;
  readonly currentFilePath?: string;
}

export function useGlobalKeys({
  nav,
  inputMode,
  currentScreen,
  currentFilePath,
}: UseGlobalKeysOptions): void {
  const { exit } = useApp();

  useInput((input, key) => {
    dispatchGlobalKey(input, key, {
      nav,
      inputMode,
      currentScreen,
      exit,
      currentFilePath,
    });
  });
}
