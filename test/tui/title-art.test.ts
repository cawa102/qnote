import { describe, it, expect, beforeEach } from 'vitest';
import stringWidth from 'string-width';

describe('title-art', () => {
  let TITLE_ART: readonly string[];
  let TITLE_WIDTH: number;
  let STAR_TOP_COUNT: number;
  let STAR_BOTTOM_COUNT: number;
  let colorizeTitle: (lines: readonly string[]) => string;

  beforeEach(async () => {
    const mod = await import('../../src/tui/assets/title-art.js');
    TITLE_ART = mod.TITLE_ART;
    TITLE_WIDTH = mod.TITLE_WIDTH;
    STAR_TOP_COUNT = mod.STAR_TOP_COUNT;
    STAR_BOTTOM_COUNT = mod.STAR_BOTTOM_COUNT;
    colorizeTitle = mod.colorizeTitle;
  });

  describe('TITLE_ART', () => {
    it('has star field lines above and below block art (3 top + 6 art + 2 bottom)', () => {
      expect(STAR_TOP_COUNT).toBe(3);
      expect(STAR_BOTTOM_COUNT).toBe(2);
      expect(TITLE_ART.length).toBe(STAR_TOP_COUNT + 6 + STAR_BOTTOM_COUNT);
    });

    it('all rows have consistent display width', () => {
      const widths = TITLE_ART.map((line) => stringWidth(line));
      const maxWidth = Math.max(...widths);
      for (const w of widths) {
        expect(w).toBe(maxWidth);
      }
    });

    it('block art lines contain box-drawing and block characters', () => {
      const blockChars = /[█╗╔║╚╝═▄▀]/;
      const blockLines = TITLE_ART.slice(STAR_TOP_COUNT, STAR_TOP_COUNT + 6);
      for (const line of blockLines) {
        expect(line).toMatch(blockChars);
      }
    });

    it('star field lines contain scattered star characters', () => {
      const starChars = /[✦✧♛·]/;
      const starLines = [
        ...TITLE_ART.slice(0, STAR_TOP_COUNT),
        ...TITLE_ART.slice(STAR_TOP_COUNT + 6),
      ];
      for (const line of starLines) {
        expect(line).toMatch(starChars);
      }
    });

    it('renders QUEEN NOTE as a single cohesive block', () => {
      const firstArtLine = TITLE_ART[STAR_TOP_COUNT];
      expect(firstArtLine).toContain('██████╗');  // Q start
      expect(firstArtLine).toContain('███████╗'); // E end
    });
  });

  describe('TITLE_WIDTH', () => {
    it('matches the widest row display width', () => {
      const maxWidth = Math.max(...TITLE_ART.map((line) => stringWidth(line)));
      expect(TITLE_WIDTH).toBe(maxWidth);
    });

    it('is between 80 and 90 characters for the combined QUEEN NOTE art', () => {
      expect(TITLE_WIDTH).toBeGreaterThanOrEqual(80);
      expect(TITLE_WIDTH).toBeLessThanOrEqual(90);
    });
  });

  describe('colorizeTitle', () => {
    it('returns a non-empty string', () => {
      const result = colorizeTitle(TITLE_ART);
      expect(result.length).toBeGreaterThan(0);
    });

    it('output contains ANSI color codes when chalk level >= 1', async () => {
      const chalk = (await import('chalk')).default;
      if (chalk.level >= 1) {
        const result = colorizeTitle(TITLE_ART);
        expect(result).toMatch(/\x1b\[/);
      }
    });

    it('returns string joined by newlines with correct line count', () => {
      const result = colorizeTitle(TITLE_ART);
      const lines = result.split('\n');
      expect(lines.length).toBe(TITLE_ART.length);
    });

    it('returns fallback for empty lines', () => {
      const result = colorizeTitle([]);
      expect(result).toContain('Queen Note');
    });
  });
});
