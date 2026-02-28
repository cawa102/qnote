import { spawnSync } from 'node:child_process';
import { resolveEditor } from './resolve-editor.js';

/**
 * Restore terminal state by exiting alternate screen and showing cursor.
 * Called by signal handlers when TUI crashes or is interrupted.
 * Note: fullscreen-ink handles normal alternate screen lifecycle;
 * this is a safety net for abnormal termination (SIGINT, SIGTERM, uncaughtException).
 */
export function restoreTerminal(): void {
  process.stdout.write('\x1b[?1049l\x1b[?25h');
}

/**
 * Spawn the user's preferred editor synchronously.
 * The editor gets full terminal control via inherited stdio.
 */
export function spawnEditorSync(filePath: string): void {
  const editor = resolveEditor();
  spawnSync(editor, [filePath], { stdio: 'inherit' });
}

/**
 * Extract the slug (filename without .md extension) from a file path.
 */
export function extractSlugFromPath(filePath: string): string {
  if (filePath === '') return '';

  const basename = filePath.split('/').pop() ?? '';
  if (basename.endsWith('.md')) {
    return basename.slice(0, -3);
  }
  return basename;
}
