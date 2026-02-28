import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import stringWidth from 'string-width';

describe('title-art', () => {
  let TITLE_ART: readonly string[];
  let TITLE_SUBTITLE: string;
  let TITLE_WIDTH: number;
  let colorizeTitle: (lines: readonly string[], subtitle: string) => string;

  beforeEach(async () => {
    const mod = await import('../../src/tui/assets/title-art.js');
    TITLE_ART = mod.TITLE_ART;
    TITLE_SUBTITLE = mod.TITLE_SUBTITLE;
    TITLE_WIDTH = mod.TITLE_WIDTH;
    colorizeTitle = mod.colorizeTitle;
  });

  describe('TITLE_ART', () => {
    it('has 5-6 rows', () => {
      expect(TITLE_ART.length).toBeGreaterThanOrEqual(5);
      expect(TITLE_ART.length).toBeLessThanOrEqual(6);
    });

    it('all rows have consistent display width', () => {
      const widths = TITLE_ART.map((line) => stringWidth(line));
      const maxWidth = Math.max(...widths);
      for (const w of widths) {
        expect(w).toBe(maxWidth);
      }
    });

    it('contains only block characters, spaces, and no box-drawing characters', () => {
      const boxDrawing = /[┌┐└┘│─┤├┬┴┼╔╗╚╝║═╠╣╦╩╬]/;
      const allowedChars = /^[█▀▄▌▐ ]+$/;

      for (const line of TITLE_ART) {
        expect(line).not.toMatch(boxDrawing);
        expect(line).toMatch(allowedChars);
      }
    });
  });

  describe('TITLE_SUBTITLE', () => {
    it('is "N O T E" in spaced letters', () => {
      expect(TITLE_SUBTITLE).toBe('N O T E');
    });
  });

  describe('TITLE_WIDTH', () => {
    it('matches the widest row display width', () => {
      const maxWidth = Math.max(...TITLE_ART.map((line) => stringWidth(line)));
      expect(TITLE_WIDTH).toBe(maxWidth);
    });

    it('is between 25 and 55 characters', () => {
      expect(TITLE_WIDTH).toBeGreaterThanOrEqual(25);
      expect(TITLE_WIDTH).toBeLessThanOrEqual(55);
    });
  });

  describe('colorizeTitle', () => {
    it('returns a non-empty string', () => {
      const result = colorizeTitle(TITLE_ART, TITLE_SUBTITLE);
      expect(result.length).toBeGreaterThan(0);
    });

    it('output contains ANSI color codes when chalk level >= 1', async () => {
      const chalk = (await import('chalk')).default;
      if (chalk.level >= 1) {
        const result = colorizeTitle(TITLE_ART, TITLE_SUBTITLE);
        // ANSI escape sequence starts with ESC[
        expect(result).toMatch(/\x1b\[/);
      }
    });

    it('contains the subtitle text', () => {
      const result = colorizeTitle(TITLE_ART, TITLE_SUBTITLE);
      expect(result).toContain('N O T E');
    });

    it('returns string joined by newlines', () => {
      const result = colorizeTitle(TITLE_ART, TITLE_SUBTITLE);
      const lines = result.split('\n');
      // Should have at least the art lines + subtitle
      expect(lines.length).toBeGreaterThanOrEqual(TITLE_ART.length + 1);
    });
  });
});
