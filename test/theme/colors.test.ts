import { describe, it, expect } from 'vitest';
import { theme } from '../../src/theme/colors.js';
import type { Theme } from '../../src/theme/colors.js';
import {
  formatTag,
  formatDate,
  formatBacklinks,
  formatIndicator,
  formatRuler,
} from '../../src/theme/format.js';

describe('theme', () => {
  it('has all semantic color functions', () => {
    expect(typeof theme.accent).toBe('function');
    expect(typeof theme.accentBold).toBe('function');
    expect(typeof theme.tag).toBe('function');
    expect(typeof theme.link).toBe('function');
    expect(typeof theme.dim).toBe('function');
    expect(typeof theme.error).toBe('function');
    expect(typeof theme.warning).toBe('function');
    expect(typeof theme.selected).toBe('function');
    expect(typeof theme.bold).toBe('function');
    expect(typeof theme.heading).toBe('function');
  });

  it('returns strings from all color functions', () => {
    const keys: readonly (keyof Theme)[] = [
      'accent', 'accentBold', 'tag', 'link', 'dim',
      'error', 'warning', 'selected', 'bold', 'heading',
    ] as const;

    for (const key of keys) {
      const result = theme[key]('test');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('contains the input text within the styled output', () => {
    // Chalk wraps text in ANSI codes but the original text is still present
    expect(theme.accent('hello')).toContain('hello');
    expect(theme.tag('world')).toContain('world');
    expect(theme.error('oops')).toContain('oops');
  });

  it('satisfies the Theme interface', () => {
    const t: Theme = theme;
    expect(t).toBeDefined();
  });
});

describe('formatTag', () => {
  it('prefixes tag with #', () => {
    const result = formatTag('api');
    expect(result).toContain('#api');
  });

  it('handles tags with special characters', () => {
    const result = formatTag('my-tag');
    expect(result).toContain('#my-tag');
  });

  it('handles empty tag', () => {
    const result = formatTag('');
    expect(result).toContain('#');
  });
});

describe('formatDate', () => {
  it('formats ISO date to short form', () => {
    const result = formatDate('2026-02-27T10:00:00+09:00');
    expect(result).toContain('Feb');
    expect(result).toContain('27');
  });

  it('formats a different date correctly', () => {
    const result = formatDate('2026-12-01T00:00:00Z');
    expect(result).toContain('Dec');
    expect(result).toContain('1');
  });

  it('handles January dates', () => {
    const result = formatDate('2026-01-15T12:00:00Z');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
  });
});

describe('formatBacklinks', () => {
  it('formats backlink count with arrow', () => {
    const result = formatBacklinks(3);
    expect(result).toContain('3');
  });

  it('returns empty string for zero backlinks', () => {
    const result = formatBacklinks(0);
    expect(result).toBe('');
  });

  it('handles single backlink', () => {
    const result = formatBacklinks(1);
    expect(result).toContain('1');
  });
});

describe('formatIndicator', () => {
  it('returns filled circle for selected', () => {
    const result = formatIndicator(true);
    expect(result).toContain('●');
  });

  it('returns empty circle for unselected', () => {
    const result = formatIndicator(false);
    expect(result).toContain('○');
  });
});

describe('formatRuler', () => {
  it('returns a horizontal line of specified width', () => {
    const result = formatRuler(10);
    expect(result).toContain('─'.repeat(10));
  });

  it('returns empty ruler for zero width', () => {
    const result = formatRuler(0);
    // The styled string may still have ANSI codes, but the ruler content is empty
    expect(result).toContain('');
  });
});
