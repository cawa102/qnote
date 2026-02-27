import { describe, it, expect } from 'vitest';
import {
  renderMarkdown,
  numberWikiLinks,
} from '../../src/tui/utils/render-markdown.js';

describe('numberWikiLinks', () => {
  it('adds numbers to wikilinks (1-9)', () => {
    const content = '参照: [[auth-flow]] と [[db-schema]] を確認。';
    const { rendered, links } = numberWikiLinks(content);
    expect(rendered).toContain('[[auth-flow]][1]');
    expect(rendered).toContain('[[db-schema]][2]');
    expect(links).toHaveLength(2);
    expect(links[0]!.target).toBe('auth-flow');
    expect(links[1]!.target).toBe('db-schema');
  });

  it('returns empty links array for content without wikilinks', () => {
    const { rendered, links } = numberWikiLinks('No links here.');
    expect(links).toHaveLength(0);
    expect(rendered).toBe('No links here.');
  });

  it('numbers only first 9 links; remaining have no number', () => {
    const targets = Array.from({ length: 12 }, (_, i) => `note-${i + 1}`);
    const content = targets.map((t) => `[[${t}]]`).join(' ');
    const { rendered, links } = numberWikiLinks(content);

    for (let i = 1; i <= 9; i++) {
      expect(rendered).toContain(`[[note-${i}]][${i}]`);
    }
    expect(rendered).not.toContain('[10]');
    expect(rendered).not.toContain('[11]');
    expect(rendered).not.toContain('[12]');
    expect(links).toHaveLength(12);
  });

  it('preserves display text in piped wikilinks', () => {
    const content = '[[auth-flow|認証フロー]]';
    const { rendered, links } = numberWikiLinks(content);
    expect(rendered).toContain('[1]');
    expect(links[0]!.target).toBe('auth-flow');
    expect(links[0]!.displayText).toBe('認証フロー');
  });
});

describe('renderMarkdown', () => {
  it('renders headings', () => {
    const result = renderMarkdown('# Hello World');
    expect(result).toContain('Hello World');
  });

  it('renders code blocks', () => {
    const result = renderMarkdown('```\nconst x = 1;\n```');
    expect(result).toContain('const x = 1;');
  });

  it('renders bullet lists', () => {
    const result = renderMarkdown('- item A\n- item B');
    expect(result).toContain('item A');
    expect(result).toContain('item B');
  });

  it('falls back to raw markdown when rendering fails', () => {
    const result = renderMarkdown(null as unknown as string);
    expect(result).toContain('[rendering failed]');
  });

  it('applies wikilink numbering as post-processing', () => {
    const md = 'See [[auth-flow]] for details.';
    const result = renderMarkdown(md);
    expect(result).toContain('[1]');
    expect(result).toContain('auth-flow');
  });
});
