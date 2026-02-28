import { describe, it, expect, beforeEach } from 'vitest';
import stringWidth from 'string-width';

describe('title-art', () => {
  let TITLE_ART: readonly string[];
  let TITLE_WIDTH: number;
  let colorizeTitle: (lines: readonly string[]) => string;

  beforeEach(async () => {
    const mod = await import('../../src/tui/assets/title-art.js');
    TITLE_ART = mod.TITLE_ART;
    TITLE_WIDTH = mod.TITLE_WIDTH;
    colorizeTitle = mod.colorizeTitle;
  });

  describe('TITLE_ART', () => {
    it('has 6 rows', () => {
      expect(TITLE_ART.length).toBe(6);
    });

    it('all rows have consistent display width', () => {
      const widths = TITLE_ART.map((line) => stringWidth(line));
      const maxWidth = Math.max(...widths);
      for (const w of widths) {
        expect(w).toBe(maxWidth);
      }
    });

    it('contains box-drawing and block characters for 3D effect', () => {
      const blockChars = /[█╗╔║╚╝═▄▀]/;
      for (const line of TITLE_ART) {
        expect(line).toMatch(blockChars);
      }
    });

    it('renders QUEEN NOTE as a single cohesive block', () => {
      // First line should contain both Q and E (last letter of NOTE)
      const firstLine = TITLE_ART[0];
      expect(firstLine).toContain('██████╗');  // Q start
      expect(firstLine).toContain('███████╗'); // E end
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
