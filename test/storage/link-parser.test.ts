import { describe, it, expect } from 'vitest';
import { extractWikiLinks } from '../../src/storage/link-parser.js';
import type { WikiLink } from '../../src/types.js';

describe('extractWikiLinks', () => {
  it('extracts [[wikilinks]] from content', () => {
    const content = '参照: [[auth-flow]] と [[db-schema]] を確認。';
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(2);
    expect(links[0]!.target).toBe('auth-flow');
    expect(links[0]!.displayText).toBe('auth-flow');
    expect(links[1]!.target).toBe('db-schema');
    expect(links[1]!.displayText).toBe('db-schema');
  });

  it('returns empty array for content without links', () => {
    const links = extractWikiLinks('No links here.');
    expect(links).toEqual([]);
  });

  it('handles duplicate links (preserves all occurrences)', () => {
    const links = extractWikiLinks('[[a]] and [[a]] again');
    expect(links).toHaveLength(2);
    expect(links[0]!.target).toBe('a');
    expect(links[1]!.target).toBe('a');
  });

  it('captures position of each link', () => {
    const content = '[[first]] then [[second]]';
    const links = extractWikiLinks(content);
    expect(links[0]!.position).toBe(0);
    expect(links[1]!.position).toBeGreaterThan(0);
  });

  it('handles display text with pipe syntax [[target|Display Text]]', () => {
    const content = 'See [[auth-flow|認証フロー]] for details.';
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(1);
    expect(links[0]!.target).toBe('auth-flow');
    expect(links[0]!.displayText).toBe('認証フロー');
  });

  it('handles Japanese targets', () => {
    const content = '[[日本語ノート]] のリンク';
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(1);
    expect(links[0]!.target).toBe('日本語ノート');
  });

  it('handles empty brackets gracefully', () => {
    const content = 'Empty [[]] brackets.';
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(0);
  });

  it('handles nested brackets gracefully', () => {
    const content = 'Nested [[outer [[inner]]]] text.';
    const links = extractWikiLinks(content);
    // Should capture at least the inner match
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it('handles links across multiple lines', () => {
    const content = `First line with [[link-one]].
Second line with [[link-two]].
Third line with no links.
Fourth line with [[link-three]].`;
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(3);
    expect(links.map((l) => l.target)).toEqual(['link-one', 'link-two', 'link-three']);
  });

  it('handles links with spaces in target', () => {
    const content = '[[My Long Note Title]] reference.';
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(1);
    expect(links[0]!.target).toBe('My Long Note Title');
  });

  it('skips wikilinks inside inline code', () => {
    const content = 'Use `[[not-a-link]]` syntax for links.';
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(0);
  });

  it('skips wikilinks inside fenced code blocks', () => {
    const content = `Some text.

\`\`\`
[[code-link]]
\`\`\`

Real [[actual-link]] here.`;
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(1);
    expect(links[0]!.target).toBe('actual-link');
  });

  it('skips wikilinks inside indented code blocks', () => {
    const content = `Normal text [[real-link]].

    [[indented-code-link]]

More text.`;
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(1);
    expect(links[0]!.target).toBe('real-link');
  });

  it('handles pipe display text with spaces', () => {
    const content = '[[target-note | Display With Spaces ]]';
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(1);
    expect(links[0]!.target).toBe('target-note');
    expect(links[0]!.displayText).toBe('Display With Spaces');
  });

  it('returns WikiLink[] satisfying the type contract', () => {
    const content = '[[test-note|テスト]]';
    const links: readonly WikiLink[] = extractWikiLinks(content);
    expect(links[0]).toEqual({
      target: 'test-note',
      displayText: 'テスト',
      position: 0,
    });
  });
});
