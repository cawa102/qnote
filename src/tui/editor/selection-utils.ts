import type { CursorPosition } from './types.js';

/**
 * Return [start, end] pair where start is always before or equal to end.
 * Used by both text-buffer and renderer to normalize selection direction.
 */
export function normalizeSelection(
  anchor: CursorPosition,
  head: CursorPosition,
): [CursorPosition, CursorPosition] {
  if (
    anchor.line < head.line ||
    (anchor.line === head.line && anchor.col <= head.col)
  ) {
    return [anchor, head];
  }
  return [head, anchor];
}
