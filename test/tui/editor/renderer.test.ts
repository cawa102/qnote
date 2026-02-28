import { describe, it, expect } from 'vitest';
import {
  renderViewport,
  calculateScrollOffset,
  insertCursor,
} from '../../../src/tui/editor/renderer.js';
import type { RenderOptions } from '../../../src/tui/editor/renderer.js';

const REV_ON = '\x1b[7m';
const REV_OFF = '\x1b[27m';

/** Strip block cursor (reverse video) ANSI codes. */
const stripCursor = (s: string): string =>
  s.replace(/\x1b\[7m/g, '').replace(/\x1b\[27m/g, '');

const makeOptions = (overrides: Partial<RenderOptions> = {}): RenderOptions => ({
  lines: overrides.lines ?? ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'],
  highlightedLines: overrides.highlightedLines ?? overrides.lines ?? [
    'Line 1',
    'Line 2',
    'Line 3',
    'Line 4',
    'Line 5',
  ],
  cursor: overrides.cursor ?? { line: 0, col: 0 },
  viewportHeight: overrides.viewportHeight ?? 3,
  viewportWidth: overrides.viewportWidth ?? 40,
  scrollOffset: overrides.scrollOffset ?? 0,
});

describe('Renderer', () => {
  describe('calculateScrollOffset', () => {
    it('returns 0 when cursor is at the top', () => {
      expect(calculateScrollOffset({ line: 0, col: 0 }, 0, 10)).toBe(0);
    });

    it('scrolls down when cursor goes below viewport', () => {
      // Viewport height 5, scroll margin 3
      // Cursor at line 5 with offset 0 → cursor is past viewport bottom
      const result = calculateScrollOffset({ line: 5, col: 0 }, 0, 5);
      expect(result).toBeGreaterThan(0);
    });

    it('scrolls up when cursor goes above viewport', () => {
      // Cursor at line 1, but offset is 5 → cursor is above viewport
      const result = calculateScrollOffset({ line: 1, col: 0 }, 5, 5);
      expect(result).toBeLessThan(5);
    });

    it('does not produce negative scroll offset', () => {
      const result = calculateScrollOffset({ line: 0, col: 0 }, 0, 10);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('keeps cursor within scroll margin', () => {
      // With margin of 3, cursor at line 7 with offset 0 and viewport height 5
      // Should scroll so cursor isn't at the very edge
      const result = calculateScrollOffset({ line: 7, col: 0 }, 0, 5);
      // Cursor line (7) - viewportHeight (5) + margin (3) + 1 = 6
      expect(result).toBeGreaterThanOrEqual(3);
    });

    it('does not scroll unnecessarily when cursor is in middle of viewport', () => {
      // Cursor at line 3, offset 0, viewport 10 → cursor is well within view
      const result = calculateScrollOffset({ line: 3, col: 0 }, 0, 10);
      expect(result).toBe(0);
    });
  });

  describe('insertCursor (block cursor)', () => {
    it('highlights character at col with reverse video', () => {
      expect(insertCursor('hello', 0)).toBe(`${REV_ON}h${REV_OFF}ello`);
      expect(insertCursor('hello', 2)).toBe(`he${REV_ON}l${REV_OFF}lo`);
      expect(insertCursor('hello', 4)).toBe(`hell${REV_ON}o${REV_OFF}`);
    });

    it('appends reversed space at end of line', () => {
      expect(insertCursor('abc', 3)).toBe(`abc${REV_ON} ${REV_OFF}`);
      expect(insertCursor('', 0)).toBe(`${REV_ON} ${REV_OFF}`);
    });

    it('handles col beyond line length', () => {
      expect(insertCursor('ab', 10)).toBe(`ab${REV_ON} ${REV_OFF}`);
    });

    it('handles CJK characters', () => {
      expect(insertCursor('日本語', 0)).toBe(`${REV_ON}日${REV_OFF}本語`);
      expect(insertCursor('日本語', 1)).toBe(`日${REV_ON}本${REV_OFF}語`);
      expect(insertCursor('日本語', 3)).toBe(`日本語${REV_ON} ${REV_OFF}`);
    });

    it('handles ANSI codes without counting them', () => {
      const line = '\x1b[31mhello\x1b[0m';
      expect(insertCursor(line, 0)).toBe(`\x1b[31m${REV_ON}h${REV_OFF}ello\x1b[0m`);
      expect(insertCursor(line, 2)).toBe(`\x1b[31mhe${REV_ON}l${REV_OFF}lo\x1b[0m`);
    });

    it('appends reversed space at end of ANSI-styled line', () => {
      const line = '\x1b[31mhi\x1b[0m';
      expect(insertCursor(line, 2)).toBe(`\x1b[31mhi\x1b[0m${REV_ON} ${REV_OFF}`);
    });

    it('preserves all characters (no character replaced)', () => {
      const result = insertCursor('abc', 1);
      expect(stripCursor(result)).toBe('abc');
    });
  });

  describe('renderViewport', () => {
    it('shows only visible lines when content exceeds viewport', () => {
      const options = makeOptions({
        viewportHeight: 3,
        scrollOffset: 0,
      });
      const result = renderViewport(options);
      const contentLines = result.content.split('\n').map(stripCursor);
      expect(contentLines).toHaveLength(3);
      expect(contentLines[0]).toBe('Line 1');
      expect(contentLines[1]).toBe('Line 2');
      expect(contentLines[2]).toBe('Line 3');
    });

    it('renders from scroll offset', () => {
      const options = makeOptions({
        scrollOffset: 2,
        cursor: { line: 3, col: 0 }, // cursor within viewport so auto-scroll doesn't adjust
      });
      const result = renderViewport(options);
      const contentLines = result.content.split('\n').map(stripCursor);
      expect(contentLines[0]).toBe('Line 3');
      expect(contentLines[1]).toBe('Line 4');
      expect(contentLines[2]).toBe('Line 5');
    });

    it('renders empty lines when buffer is empty', () => {
      const options = makeOptions({
        lines: [''],
        highlightedLines: [''],
        viewportHeight: 3,
      });
      const result = renderViewport(options);
      const contentLines = result.content.split('\n');
      expect(contentLines).toHaveLength(3);
    });

    it('pads viewport with empty lines when content is shorter', () => {
      const options = makeOptions({
        lines: ['Line 1', 'Line 2'],
        highlightedLines: ['Line 1', 'Line 2'],
        viewportHeight: 5,
      });
      const result = renderViewport(options);
      const contentLines = result.content.split('\n').map(stripCursor);
      expect(contentLines).toHaveLength(5);
      expect(contentLines[0]).toBe('Line 1');
      expect(contentLines[1]).toBe('Line 2');
      expect(contentLines[2]).toBe('');
      expect(contentLines[3]).toBe('');
      expect(contentLines[4]).toBe('');
    });

    it('auto-scrolls when cursor is below viewport', () => {
      const options = makeOptions({
        cursor: { line: 4, col: 0 },
        viewportHeight: 3,
        scrollOffset: 0,
      });
      const result = renderViewport(options);
      // Scroll offset should have been updated to keep cursor visible
      expect(result.scrollOffset).toBeGreaterThan(0);
    });

    it('auto-scrolls when cursor is above viewport', () => {
      const options = makeOptions({
        cursor: { line: 0, col: 0 },
        scrollOffset: 3,
      });
      const result = renderViewport(options);
      expect(result.scrollOffset).toBe(0);
    });

    it('calculates cursor screen row relative to viewport', () => {
      const options = makeOptions({
        cursor: { line: 2, col: 0 },
        scrollOffset: 0,
        viewportHeight: 5,
      });
      const result = renderViewport(options);
      expect(result.cursorScreenRow).toBe(2);
    });

    it('calculates cursor screen row with scroll offset', () => {
      const options = makeOptions({
        cursor: { line: 3, col: 0 },
        scrollOffset: 1,
        viewportHeight: 5,
      });
      const result = renderViewport(options);
      expect(result.cursorScreenRow).toBe(2); // line 3 - offset 1
    });

    it('calculates cursor screen col', () => {
      const options = makeOptions({
        cursor: { line: 0, col: 5 },
      });
      const result = renderViewport(options);
      expect(result.cursorScreenCol).toBe(5);
    });

    it('clamps scroll offset to non-negative', () => {
      const options = makeOptions({
        scrollOffset: -5,
        cursor: { line: 0, col: 0 },
      });
      const result = renderViewport(options);
      expect(result.scrollOffset).toBeGreaterThanOrEqual(0);
    });

    it('clamps scroll offset to not exceed content', () => {
      const options = makeOptions({
        lines: ['A', 'B', 'C'],
        highlightedLines: ['A', 'B', 'C'],
        scrollOffset: 100,
        viewportHeight: 3,
        cursor: { line: 2, col: 0 },
      });
      const result = renderViewport(options);
      // Should clamp scroll to show at least some content
      expect(result.scrollOffset).toBeLessThanOrEqual(2);
    });

    it('uses highlighted lines for rendered content', () => {
      const options = makeOptions({
        lines: ['# Title'],
        highlightedLines: ['[styled]# Title[/styled]'],
        viewportHeight: 1,
      });
      const result = renderViewport(options);
      expect(stripCursor(result.content)).toBe('[styled]# Title[/styled]');
    });

    it('truncates lines that exceed viewport width', () => {
      const longLine = 'A'.repeat(50);
      const options = makeOptions({
        lines: [longLine],
        highlightedLines: [longLine],
        viewportWidth: 20,
        viewportHeight: 1,
      });
      const result = renderViewport(options);
      const contentLines = result.content.split('\n');
      // Should truncate, not soft-wrap (for MVP simplicity in display)
      expect(contentLines).toHaveLength(1);
    });

    it('truncates CJK double-width characters correctly', () => {
      // 5 CJK chars = 10 display columns
      const cjkLine = '日本語テスト';
      const options = makeOptions({
        lines: [cjkLine],
        highlightedLines: [cjkLine],
        viewportWidth: 6, // 3 CJK chars fit (6 columns)
        viewportHeight: 1,
      });
      const result = renderViewport(options);
      expect(stripCursor(result.content)).toBe('日本語');
    });

    it('does not count ANSI escape codes toward width', () => {
      const ansiLine = '\x1b[31mhello\x1b[0m';
      const options = makeOptions({
        lines: [ansiLine],
        highlightedLines: [ansiLine],
        viewportWidth: 10,
        viewportHeight: 1,
      });
      const result = renderViewport(options);
      // "hello" is 5 chars visible, fits in width 10
      expect(stripCursor(result.content)).toBe(ansiLine);
    });

    it('truncates text with ANSI codes preserving codes', () => {
      const ansiLine = '\x1b[31m' + 'A'.repeat(30) + '\x1b[0m';
      const options = makeOptions({
        lines: [ansiLine],
        highlightedLines: [ansiLine],
        viewportWidth: 10,
        viewportHeight: 1,
      });
      const result = renderViewport(options);
      // Should contain opening ANSI code + 10 A's
      expect(result.content).toContain('\x1b[31m');
      // Visible content should be 10 A's (cursor adds a space if at end)
      const stripped = stripCursor(result.content).replace(/\x1b\[[0-9;]*m/g, '');
      expect(stripped.length).toBe(10);
    });

    it('inserts block cursor at cursor position', () => {
      const options = makeOptions({
        lines: ['abc'],
        highlightedLines: ['abc'],
        cursor: { line: 0, col: 1 },
        viewportHeight: 1,
      });
      const result = renderViewport(options);
      expect(result.content).toBe(`a${REV_ON}b${REV_OFF}c`);
    });

    it('shows reversed space at end of line when cursor at end', () => {
      const options = makeOptions({
        lines: ['ab'],
        highlightedLines: ['ab'],
        cursor: { line: 0, col: 2 },
        viewportHeight: 1,
      });
      const result = renderViewport(options);
      expect(result.content).toBe(`ab${REV_ON} ${REV_OFF}`);
    });

    it('does not insert cursor on non-cursor lines', () => {
      const options = makeOptions({
        lines: ['AAA', 'BBB'],
        highlightedLines: ['AAA', 'BBB'],
        cursor: { line: 0, col: 0 },
        viewportHeight: 2,
      });
      const result = renderViewport(options);
      const lines = result.content.split('\n');
      expect(lines[1]).toBe('BBB');
    });
  });
});
