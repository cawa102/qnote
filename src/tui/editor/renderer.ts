import stringWidth from 'string-width';
import type { CursorPosition, Selection } from './types.js';

const SCROLL_MARGIN = 3;

// Regex to match ANSI escape sequences
const ANSI_RE = /\x1b\[[0-9;]*m/g;

// ANSI reverse video for block cursor
const REVERSE_ON = '\x1b[7m';
const REVERSE_OFF = '\x1b[27m';

export interface RenderOptions {
  readonly lines: readonly string[];
  readonly highlightedLines: readonly string[];
  readonly cursor: CursorPosition;
  readonly viewportHeight: number;
  readonly viewportWidth: number;
  readonly scrollOffset: number;
  readonly selection?: Selection | null;
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
 * Apply block cursor (reverse video) at the given column position
 * in a line that may contain ANSI escape codes.
 *
 * The character at col is wrapped with reverse video. If col is at or
 * past the end of the line, a reversed space is appended.
 */
export function insertCursor(highlightedLine: string, col: number): string {
  let visibleIndex = 0;
  let i = 0;
  let result = '';
  let cursorApplied = false;

  while (i < highlightedLine.length) {
    // Skip ANSI escape sequences
    const ansiMatch = highlightedLine.slice(i).match(/^\x1b\[[0-9;]*m/);
    if (ansiMatch) {
      result += ansiMatch[0];
      i += ansiMatch[0].length;
      continue;
    }

    // Wrap the character at col with reverse video
    if (visibleIndex === col && !cursorApplied) {
      const cp = highlightedLine.codePointAt(i)!;
      const char = String.fromCodePoint(cp);
      result += REVERSE_ON + char + REVERSE_OFF;
      i += char.length;
      visibleIndex++;
      cursorApplied = true;
      continue;
    }

    const cp = highlightedLine.codePointAt(i)!;
    const char = String.fromCodePoint(cp);
    result += char;
    i += char.length;
    visibleIndex++;
  }

  // Cursor at or past end of line — append reversed space
  if (!cursorApplied) {
    result += REVERSE_ON + ' ' + REVERSE_OFF;
  }

  return result;
}

/**
 * Apply selection highlight background to a line.
 * Walks ANSI codes by skipping escape sequences and wrapping visible
 * characters within the selection range with selectionBg().
 */
export function applySelectionHighlight(
  highlightedLine: string,
  lineIndex: number,
  selection: Selection | null,
  selectionBg: (text: string) => string,
): string {
  if (!selection) {
    return highlightedLine;
  }

  const [start, end] = normalizeSelectionPos(selection.anchor, selection.head);

  // Empty selection
  if (start.line === end.line && start.col === end.col) {
    return highlightedLine;
  }

  // Line completely outside selection range
  if (lineIndex < start.line || lineIndex > end.line) {
    return highlightedLine;
  }

  // Determine which columns to highlight on this line
  let selStart: number;
  let selEnd: number; // exclusive
  let trailingBg = false;

  if (start.line === end.line && lineIndex === start.line) {
    // Single-line selection
    selStart = start.col;
    selEnd = end.col;
  } else if (lineIndex === start.line) {
    // First line of multi-line selection
    selStart = start.col;
    selEnd = Infinity;
    trailingBg = true;
  } else if (lineIndex === end.line) {
    // Last line of multi-line selection
    selStart = 0;
    selEnd = end.col;
  } else {
    // Middle line — fully selected
    selStart = 0;
    selEnd = Infinity;
    trailingBg = true;
  }

  let visibleIndex = 0;
  let i = 0;
  let result = '';

  while (i < highlightedLine.length) {
    const ansiMatch = highlightedLine.slice(i).match(/^\x1b\[[0-9;]*m/);
    if (ansiMatch) {
      result += ansiMatch[0];
      i += ansiMatch[0].length;
      continue;
    }

    const cp = highlightedLine.codePointAt(i)!;
    const char = String.fromCodePoint(cp);

    if (visibleIndex >= selStart && visibleIndex < selEnd) {
      result += selectionBg(char);
    } else {
      result += char;
    }
    i += char.length;
    visibleIndex++;
  }

  // Trailing background space for multi-line selection newline indication
  if (trailingBg || (lineIndex < end.line && lineIndex >= start.line && lineIndex !== end.line)) {
    result += selectionBg(' ');
  }

  return result;
}

function normalizeSelectionPos(
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

/**
 * Render the text editor viewport as a string.
 * Handles scroll offset, line truncation, cursor display, and viewport padding.
 */
export function renderViewport(options: RenderOptions): RenderedOutput {
  const { highlightedLines, cursor, viewportHeight, viewportWidth, selection } = options;

  // Calculate the updated scroll offset
  const scrollOffset = calculateScrollOffset(cursor, options.scrollOffset, viewportHeight);

  // Build viewport lines with cursor indicator
  const viewportLines: string[] = [];
  for (let i = 0; i < viewportHeight; i++) {
    const lineIndex = scrollOffset + i;
    if (lineIndex < highlightedLines.length) {
      let line = highlightedLines[lineIndex]!;
      // Apply selection highlighting before cursor and truncation
      if (selection) {
        line = applySelectionHighlight(line, lineIndex, selection, (t) => `\x1b[48;2;38;79;120m${t}\x1b[49m`);
      }
      line = truncateToWidth(line, viewportWidth);
      if (lineIndex === cursor.line) {
        line = insertCursor(line, cursor.col);
      }
      viewportLines.push(line);
    } else {
      if (lineIndex === cursor.line) {
        viewportLines.push(REVERSE_ON + ' ' + REVERSE_OFF);
      } else {
        viewportLines.push('');
      }
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
