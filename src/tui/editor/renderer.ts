import stringWidth from 'string-width';
import type { CursorPosition } from './types.js';

const SCROLL_MARGIN = 3;

// Regex to match ANSI escape sequences
const ANSI_RE = /\x1b\[[0-9;]*m/g;

export interface RenderOptions {
  readonly lines: readonly string[];
  readonly highlightedLines: readonly string[];
  readonly cursor: CursorPosition;
  readonly viewportHeight: number;
  readonly viewportWidth: number;
  readonly scrollOffset: number;
}

export interface RenderedOutput {
  readonly content: string;
  readonly scrollOffset: number;
  readonly cursorScreenRow: number;
  readonly cursorScreenCol: number;
}

/**
 * Calculate the scroll offset to keep the cursor visible within the viewport,
 * maintaining a scroll margin of SCROLL_MARGIN lines from the edges.
 */
export function calculateScrollOffset(
  cursor: CursorPosition,
  currentOffset: number,
  viewportHeight: number,
): number {
  const margin = Math.min(SCROLL_MARGIN, Math.floor(viewportHeight / 2));
  let offset = currentOffset;

  // Cursor is above viewport (with margin)
  if (cursor.line < offset + margin) {
    offset = Math.max(0, cursor.line - margin);
  }

  // Cursor is below viewport (with margin)
  if (cursor.line >= offset + viewportHeight - margin) {
    offset = cursor.line - viewportHeight + margin + 1;
  }

  return Math.max(0, offset);
}

/**
 * Truncate a string to fit within a given display width.
 * Handles ANSI escape codes (not counted toward width) and CJK double-width characters.
 */
function truncateToWidth(text: string, width: number): string {
  if (stringWidth(text) <= width) {
    return text;
  }

  // Strip ANSI to work with visible characters, then rebuild with ANSI codes
  const stripped = text.replace(ANSI_RE, '');
  let visibleWidth = 0;
  let charIndex = 0;

  for (const char of stripped) {
    const charWidth = stringWidth(char);
    if (visibleWidth + charWidth > width) {
      break;
    }
    visibleWidth += charWidth;
    charIndex += char.length;
  }

  // If the text had no ANSI codes, simple slice
  if (stripped.length === text.length) {
    return stripped.slice(0, charIndex);
  }

  // Rebuild with ANSI codes preserved up to the truncation point
  let result = '';
  let visibleSeen = 0;
  let i = 0;
  while (i < text.length && visibleSeen < charIndex) {
    const ansiMatch = text.slice(i).match(/^\x1b\[[0-9;]*m/);
    if (ansiMatch) {
      result += ansiMatch[0];
      i += ansiMatch[0].length;
    } else {
      result += text[i];
      visibleSeen++;
      i++;
    }
  }
  // Include any trailing ANSI codes at the truncation boundary
  while (i < text.length) {
    const ansiMatch = text.slice(i).match(/^\x1b\[[0-9;]*m/);
    if (ansiMatch) {
      result += ansiMatch[0];
      i += ansiMatch[0].length;
    } else {
      break;
    }
  }

  return result;
}

/**
 * Render the text editor viewport as a string.
 * Handles scroll offset, line truncation, and viewport padding.
 */
export function renderViewport(options: RenderOptions): RenderedOutput {
  const { highlightedLines, cursor, viewportHeight, viewportWidth } = options;

  // Calculate the updated scroll offset
  const scrollOffset = calculateScrollOffset(cursor, options.scrollOffset, viewportHeight);

  // Build viewport lines
  const viewportLines: string[] = [];
  for (let i = 0; i < viewportHeight; i++) {
    const lineIndex = scrollOffset + i;
    if (lineIndex < highlightedLines.length) {
      viewportLines.push(truncateToWidth(highlightedLines[lineIndex], viewportWidth));
    } else {
      viewportLines.push('');
    }
  }

  // Calculate cursor screen position relative to viewport
  const cursorScreenRow = cursor.line - scrollOffset;
  const cursorScreenCol = cursor.col;

  return {
    content: viewportLines.join('\n'),
    scrollOffset,
    cursorScreenRow,
    cursorScreenCol,
  };
}
