import { describe, it, expect } from 'vitest';
import { highlightLine, highlightLines } from '../../../src/tui/editor/syntax-highlighter.js';
import type { Theme } from '../../../src/theme/colors.js';

// Mock theme that wraps text in identifiable markers for testing
const mockTheme: Theme = {
  accent: (text: string) => `[accent]${text}[/accent]`,
  accentBold: (text: string) => `[accentBold]${text}[/accentBold]`,
  tag: (text: string) => `[tag]${text}[/tag]`,
  link: (text: string) => `[link]${text}[/link]`,
  dim: (text: string) => `[dim]${text}[/dim]`,
  error: (text: string) => `[error]${text}[/error]`,
  warning: (text: string) => `[warning]${text}[/warning]`,
  selected: (text: string) => `[selected]${text}[/selected]`,
  bold: (text: string) => `[bold]${text}[/bold]`,
  heading: (text: string) => `[heading]${text}[/heading]`,
};

describe('SyntaxHighlighter', () => {
  describe('highlightLine', () => {
    describe('plain text', () => {
      it('returns plain text unchanged', () => {
        expect(highlightLine('Hello world', mockTheme)).toBe('Hello world');
      });

      it('returns empty string for empty line', () => {
        expect(highlightLine('', mockTheme)).toBe('');
      });
    });

    describe('headings', () => {
      it('highlights h1 heading', () => {
        const result = highlightLine('# Hello', mockTheme);
        expect(result).toBe('[heading][dim]# [/dim]Hello[/heading]');
      });

      it('highlights h2 heading', () => {
        const result = highlightLine('## Hello', mockTheme);
        expect(result).toBe('[heading][dim]## [/dim]Hello[/heading]');
      });

      it('highlights h3 heading', () => {
        const result = highlightLine('### Hello', mockTheme);
        expect(result).toBe('[heading][dim]### [/dim]Hello[/heading]');
      });

      it('highlights h4 heading', () => {
        const result = highlightLine('#### Hello', mockTheme);
        expect(result).toBe('[heading][dim]#### [/dim]Hello[/heading]');
      });

      it('does not treat lines without space after # as headings', () => {
        const result = highlightLine('#nospace', mockTheme);
        expect(result).toBe('#nospace');
      });
    });

    describe('bold', () => {
      it('highlights bold text with ** markers', () => {
        const result = highlightLine('Hello **bold** world', mockTheme);
        expect(result).toBe('Hello [dim]**[/dim][bold]bold[/bold][dim]**[/dim] world');
      });

      it('highlights multiple bold segments', () => {
        const result = highlightLine('**one** and **two**', mockTheme);
        expect(result).toBe(
          '[dim]**[/dim][bold]one[/bold][dim]**[/dim] and [dim]**[/dim][bold]two[/bold][dim]**[/dim]',
        );
      });
    });

    describe('italic', () => {
      it('highlights italic text with * markers', () => {
        const result = highlightLine('Hello *italic* world', mockTheme);
        expect(result).toBe('Hello [dim]*[/dim][accent]italic[/accent][dim]*[/dim] world');
      });

      it('highlights multiple italic segments', () => {
        const result = highlightLine('*one* and *two*', mockTheme);
        expect(result).toBe(
          '[dim]*[/dim][accent]one[/accent][dim]*[/dim] and [dim]*[/dim][accent]two[/accent][dim]*[/dim]',
        );
      });
    });

    describe('inline code', () => {
      it('highlights inline code', () => {
        const result = highlightLine('Use `code` here', mockTheme);
        expect(result).toBe('Use [dim]`[/dim][accentBold]code[/accentBold][dim]`[/dim] here');
      });

      it('highlights multiple inline code segments', () => {
        const result = highlightLine('`one` and `two`', mockTheme);
        expect(result).toBe(
          '[dim]`[/dim][accentBold]one[/accentBold][dim]`[/dim] and [dim]`[/dim][accentBold]two[/accentBold][dim]`[/dim]',
        );
      });
    });

    describe('list items', () => {
      it('highlights unordered list with -', () => {
        const result = highlightLine('- Item one', mockTheme);
        expect(result).toBe('[accent]- [/accent]Item one');
      });

      it('highlights unordered list with *', () => {
        const result = highlightLine('* Item one', mockTheme);
        expect(result).toBe('[accent]* [/accent]Item one');
      });

      it('highlights indented list items', () => {
        const result = highlightLine('  - Nested item', mockTheme);
        expect(result).toBe('  [accent]- [/accent]Nested item');
      });

      it('applies inline formatting within list items', () => {
        const result = highlightLine('- A **bold** item', mockTheme);
        expect(result).toBe(
          '[accent]- [/accent]A [dim]**[/dim][bold]bold[/bold][dim]**[/dim] item',
        );
      });
    });

    describe('blockquotes', () => {
      it('highlights blockquote', () => {
        const result = highlightLine('> Some quoted text', mockTheme);
        expect(result).toBe('[dim]> Some quoted text[/dim]');
      });

      it('highlights nested blockquote', () => {
        const result = highlightLine('>> Nested quote', mockTheme);
        expect(result).toBe('[dim]>> Nested quote[/dim]');
      });
    });

    describe('wikilinks', () => {
      it('highlights wikilink', () => {
        const result = highlightLine('See [[My Note]] for details', mockTheme);
        expect(result).toBe('See [dim][[[/dim][link]My Note[/link][dim]]][/dim] for details');
      });

      it('highlights multiple wikilinks', () => {
        const result = highlightLine('Link [[A]] and [[B]]', mockTheme);
        expect(result).toBe(
          'Link [dim][[[/dim][link]A[/link][dim]]][/dim] and [dim][[[/dim][link]B[/link][dim]]][/dim]',
        );
      });
    });

    describe('horizontal rule', () => {
      it('highlights --- horizontal rule', () => {
        const result = highlightLine('---', mockTheme);
        expect(result).toBe('[dim]---[/dim]');
      });

      it('highlights *** horizontal rule', () => {
        const result = highlightLine('***', mockTheme);
        expect(result).toBe('[dim]***[/dim]');
      });

      it('highlights ___ horizontal rule', () => {
        const result = highlightLine('___', mockTheme);
        expect(result).toBe('[dim]___[/dim]');
      });

      it('highlights longer horizontal rules', () => {
        const result = highlightLine('-----', mockTheme);
        expect(result).toBe('[dim]-----[/dim]');
      });
    });

    describe('nested formatting', () => {
      it('handles bold inside list item', () => {
        const result = highlightLine('- **Important** point', mockTheme);
        expect(result).toBe(
          '[accent]- [/accent][dim]**[/dim][bold]Important[/bold][dim]**[/dim] point',
        );
      });

      it('handles wikilink and bold in the same line', () => {
        const result = highlightLine('**Bold** and [[link]]', mockTheme);
        expect(result).toBe(
          '[dim]**[/dim][bold]Bold[/bold][dim]**[/dim] and [dim][[[/dim][link]link[/link][dim]]][/dim]',
        );
      });

      it('handles code and bold in the same line', () => {
        const result = highlightLine('`code` and **bold**', mockTheme);
        expect(result).toBe(
          '[dim]`[/dim][accentBold]code[/accentBold][dim]`[/dim] and [dim]**[/dim][bold]bold[/bold][dim]**[/dim]',
        );
      });
    });
  });

  describe('highlightLines', () => {
    it('highlights multiple lines', () => {
      const lines = ['# Title', 'Plain text', '- Item'];
      const result = highlightLines(lines, mockTheme);
      expect(result).toEqual([
        '[heading][dim]# [/dim]Title[/heading]',
        'Plain text',
        '[accent]- [/accent]Item',
      ]);
    });

    it('returns empty array for empty input', () => {
      expect(highlightLines([], mockTheme)).toEqual([]);
    });

    it('handles single line', () => {
      const result = highlightLines(['Hello'], mockTheme);
      expect(result).toEqual(['Hello']);
    });
  });
});
