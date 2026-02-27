import { describe, it, expect } from 'vitest';
import { buildSearchHint } from '../../src/tui/screens/SearchScreen.js';

describe('buildSearchHint', () => {
  it('returns minimum-length hint when query is too short', () => {
    const hint = buildSearchHint('a', false);
    expect(hint).toBe('もう少し入力してください');
  });

  it('returns results count when search was performed', () => {
    const hint = buildSearchHint('abc', true, 5);
    expect(hint).toBe('5 results');
  });

  it('returns no results message for zero results', () => {
    const hint = buildSearchHint('abc', true, 0);
    expect(hint).toBe('0 results');
  });

  it('returns empty string for empty query', () => {
    const hint = buildSearchHint('', false);
    expect(hint).toBe('');
  });

  it('returns results count with undefined count defaulting to 0', () => {
    const hint = buildSearchHint('abc', true);
    expect(hint).toBe('0 results');
  });
});
