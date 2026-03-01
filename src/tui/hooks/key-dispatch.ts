import type { NavigationStore } from './use-navigation.js';
import type { InputModeStore } from './use-input-mode.js';

interface KeyInfo {
  readonly escape: boolean;
  readonly ctrl: boolean;
}

export interface DispatchOptions {
  readonly nav: NavigationStore;
  readonly inputMode: InputModeStore;
  readonly currentScreen: string;
  readonly exit: () => void;
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
  const { nav, inputMode, currentScreen, exit, currentFilePath } = options;
  const mode = inputMode.current();

  // Esc — pop navigation stack (palette at root is a no-op)
  // Skip for editor screen — EditorScreen handles its own Esc (dirty confirmation)
  if (key.escape && currentScreen !== 'editor') {
    if (nav.stackDepth() <= 1) {
      // At root (palette) — do nothing; use q to quit
      return;
    }
    nav.pop();
    return;
  }

  // In text mode, only Esc is handled globally
  if (mode === 'text') return;

  // Ctrl+Q — quit from any screen (navigation mode only)
  if (input === 'q' && key.ctrl) {
    exit();
    return;
  }

  // q — quit from palette only (navigation mode only)
  if (input === 'q' && currentScreen === 'palette') {
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

  // e — edit note (notePreview only) — opens built-in editor
  if (input === 'e' && currentScreen === 'notePreview' && currentFilePath) {
    nav.push('editor', { filePath: currentFilePath });
  }
}
