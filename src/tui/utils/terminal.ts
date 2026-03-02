/**
 * Restore terminal state by exiting alternate screen and showing cursor.
 * Called by signal handlers when TUI crashes or is interrupted.
 * Note: fullscreen-ink handles normal alternate screen lifecycle;
 * this is a safety net for abnormal termination (SIGINT, SIGTERM, uncaughtException).
 */
export function restoreTerminal(): void {
  process.stdout.write('\x1b[0m\x1b[?1049l\x1b[?25h');
}

