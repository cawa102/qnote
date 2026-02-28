import type { NavigationStore } from './use-navigation.js';
import type { InputModeStore } from './use-input-mode.js';

interface KeyInfo {
  readonly escape: boolean;
}

export interface DispatchOptions {
  readonly nav: NavigationStore;
  readonly inputMode: InputModeStore;
  readonly currentScreen: string;
  readonly exit: () => void;
  readonly onRequestEditor?: (filePath: string) => void;
  readonly currentFilePath?: string;
}

/**
 * Pure dispatch function for global keyboard shortcuts.
 * Extracted from useGlobalKeys hook for testability.
 */
export function dispatchGlobalKey(
  input: string,
  key: KeyInfo,
  options: DispatchOptions,
): void {
  const { nav, inputMode, currentScreen, exit, onRequestEditor, currentFilePath } = options;
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

  // c — open capture (not from palette or capture)
  if (input === 'c' && currentScreen !== 'capture' && currentScreen !== 'palette') {
    nav.push('capture');
    return;
  }

  // e — edit note (notePreview only)
  if (input === 'e' && currentScreen === 'notePreview' && onRequestEditor && currentFilePath) {
    onRequestEditor(currentFilePath);
  }
}
