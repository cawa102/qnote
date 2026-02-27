import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SearchIndex } from '../../src/storage/search-index.js';

describe('SearchIndex', () => {
  let tempDir: string;
  let index: SearchIndex;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'qnote-idx-'));
    index = new SearchIndex(join(tempDir, 'index.db'));
  });

  afterEach(() => {
    index.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ─── Basic indexing & search ────────────────────────────────────

  it('indexes and searches notes (trigram)', () => {
    index.upsert({
      filePath: '/notes/api.md',
      title: 'API設計方針',
      tags: ['api', 'design'],
      content: 'REST APIの設計についての方針',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    const results = index.search('API');
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('API設計方針');
    expect(results[0]!.snippet).toContain('API');
  });

  it('searches Japanese text with trigram tokenizer', () => {
    index.upsert({
      filePath: '/notes/auth.md',
      title: 'API認証のフロー',
      tags: ['auth'],
      content: 'OAuth2フローに基づいた認証の設計方針。',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    // Trigram requires 3+ chars — use "認証の" (3 CJK chars)
    const results = index.search('認証の');
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('API認証のフロー');
  });

  it('returns empty for non-matching queries', () => {
    index.upsert({
      filePath: '/notes/test.md',
      title: 'Test',
      tags: [],
      content: 'Hello world',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    const results = index.search('nonexistent-xyz');
    expect(results).toHaveLength(0);
  });

  // ─── Upsert (update) ──────────────────────────────────────────

  it('updates existing note on re-upsert', () => {
    index.upsert({
      filePath: '/notes/a.md',
      title: 'Original Title',
      tags: ['old'],
      content: 'Original content for searching.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    index.upsert({
      filePath: '/notes/a.md',
      title: 'Updated Title',
      tags: ['new'],
      content: 'Updated content for searching.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T12:00:00+09:00',
    });

    const results = index.search('Updated');
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('Updated Title');

    const oldResults = index.search('Original');
    expect(oldResults).toHaveLength(0);
  });

  // ─── Tag operations ─────────────────────────────────────────────

  it('filters by tag', () => {
    index.upsert({
      filePath: '/notes/a.md',
      title: 'Note A',
      tags: ['api'],
      content: 'Content A for testing.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });
    index.upsert({
      filePath: '/notes/b.md',
      title: 'Note B',
      tags: ['design'],
      content: 'Content B for testing.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    const results = index.listByTag('api');
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('Note A');
  });

  it('lists all tags with counts', () => {
    index.upsert({
      filePath: '/notes/a.md',
      title: 'A',
      tags: ['api', 'design'],
      content: 'Content A.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });
    index.upsert({
      filePath: '/notes/b.md',
      title: 'B',
      tags: ['api'],
      content: 'Content B.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    const tags = index.listTags();
    expect(tags).toContainEqual({ tag: 'api', count: 2 });
    expect(tags).toContainEqual({ tag: 'design', count: 1 });
  });

  // ─── Remove ─────────────────────────────────────────────────────

  it('removes notes from index', () => {
    index.upsert({
      filePath: '/notes/del.md',
      title: 'Delete Me',
      tags: [],
      content: 'This will be gone soon enough.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });
    index.remove('/notes/del.md');

    const results = index.search('gone soon enough');
    expect(results).toHaveLength(0);
  });

  // ─── Links table ────────────────────────────────────────────────

  it('upserts and retrieves links', () => {
    index.upsert({
      filePath: '/notes/overview.md',
      title: 'Overview',
      tags: [],
      content: 'See [[auth-flow]] and [[db-schema]] for details.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    index.upsertLinks('/notes/overview.md', [
      { targetSlug: 'auth-flow', targetText: 'auth-flow' },
      { targetSlug: 'db-schema', targetText: 'db-schema' },
    ]);

    const backlinks = index.getBacklinks('auth-flow');
    expect(backlinks).toHaveLength(1);
    expect(backlinks[0]!.sourcePath).toBe('/notes/overview.md');
    expect(backlinks[0]!.sourceTitle).toBe('Overview');
  });

  it('replaces links on re-upsert', () => {
    index.upsert({
      filePath: '/notes/a.md',
      title: 'A',
      tags: [],
      content: 'Links here.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    index.upsertLinks('/notes/a.md', [
      { targetSlug: 'old-link', targetText: 'old-link' },
    ]);
    expect(index.getBacklinks('old-link')).toHaveLength(1);

    // Re-upsert with new links — old ones should be replaced
    index.upsertLinks('/notes/a.md', [
      { targetSlug: 'new-link', targetText: 'new-link' },
    ]);
    expect(index.getBacklinks('old-link')).toHaveLength(0);
    expect(index.getBacklinks('new-link')).toHaveLength(1);
  });

  it('removes links when note is removed', () => {
    index.upsert({
      filePath: '/notes/source.md',
      title: 'Source',
      tags: [],
      content: 'Linking out.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    index.upsertLinks('/notes/source.md', [
      { targetSlug: 'target', targetText: 'target' },
    ]);
    expect(index.getBacklinks('target')).toHaveLength(1);

    index.remove('/notes/source.md');
    expect(index.getBacklinks('target')).toHaveLength(0);
  });

  // ─── Backlinks from multiple sources ────────────────────────────

  it('returns backlinks from multiple sources', () => {
    index.upsert({
      filePath: '/notes/a.md',
      title: 'Note A',
      tags: [],
      content: 'Links to target.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });
    index.upsert({
      filePath: '/notes/b.md',
      title: 'Note B',
      tags: [],
      content: 'Also links to target.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    index.upsertLinks('/notes/a.md', [{ targetSlug: 'target', targetText: 'target' }]);
    index.upsertLinks('/notes/b.md', [{ targetSlug: 'target', targetText: 'target' }]);

    const backlinks = index.getBacklinks('target');
    expect(backlinks).toHaveLength(2);
    const titles = backlinks.map((b) => b.sourceTitle).sort();
    expect(titles).toEqual(['Note A', 'Note B']);
  });

  // ─── listRecent ─────────────────────────────────────────────────

  it('lists most recent notes', () => {
    index.upsert({
      filePath: '/notes/old.md',
      title: 'Old',
      tags: [],
      content: 'Old note.',
      created: '2026-02-25T10:00:00+09:00',
      modified: '2026-02-25T10:00:00+09:00',
    });
    index.upsert({
      filePath: '/notes/new.md',
      title: 'New',
      tags: [],
      content: 'New note.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    const recent = index.listRecent(5);
    expect(recent).toHaveLength(2);
    expect(recent[0]!.title).toBe('New');
    expect(recent[1]!.title).toBe('Old');
  });

  it('listRecent respects limit', () => {
    for (let i = 0; i < 10; i++) {
      index.upsert({
        filePath: `/notes/note-${i}.md`,
        title: `Note ${i}`,
        tags: [],
        content: `Content ${i}.`,
        created: `2026-02-${String(i + 10).padStart(2, '0')}T10:00:00+09:00`,
        modified: `2026-02-${String(i + 10).padStart(2, '0')}T10:00:00+09:00`,
      });
    }

    const recent = index.listRecent(5);
    expect(recent).toHaveLength(5);
  });

  // ─── shouldSearch guard ─────────────────────────────────────────

  it('shouldSearch returns false for empty query', () => {
    expect(index.shouldSearch('')).toBe(false);
  });

  it('shouldSearch returns false for whitespace-only query', () => {
    expect(index.shouldSearch('   ')).toBe(false);
  });

  it('shouldSearch returns false for 1-char Latin query', () => {
    expect(index.shouldSearch('a')).toBe(false);
  });

  it('shouldSearch returns false for 2-char Latin query', () => {
    expect(index.shouldSearch('ab')).toBe(false);
  });

  it('shouldSearch returns true for 3-char Latin query', () => {
    expect(index.shouldSearch('abc')).toBe(true);
  });

  it('shouldSearch returns false for 1-char CJK query', () => {
    expect(index.shouldSearch('認')).toBe(false);
  });

  it('shouldSearch returns false for 2-char CJK query (trigram needs 3)', () => {
    // Trigram tokenizer requires 3+ chars even for CJK
    expect(index.shouldSearch('認証')).toBe(false);
  });

  it('shouldSearch returns true for 3-char CJK query', () => {
    expect(index.shouldSearch('認証の')).toBe(true);
  });

  // ─── Query sanitization ─────────────────────────────────────────

  it('sanitizes dangerous FTS5 query characters', () => {
    index.upsert({
      filePath: '/notes/safe.md',
      title: 'Safe Note',
      tags: [],
      content: 'This is safe content for testing.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    // These should not throw — they should be sanitized internally
    expect(() => index.search('test*')).not.toThrow();
    expect(() => index.search('"unbalanced')).not.toThrow();
    expect(() => index.search('a AND OR b')).not.toThrow();
    expect(() => index.search('***')).not.toThrow();
    expect(() => index.search('"hello" "world')).not.toThrow();
  });

  it('returns empty array for query that sanitizes to empty', () => {
    index.upsert({
      filePath: '/notes/x.md',
      title: 'X',
      tags: [],
      content: 'Content here.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    const results = index.search('**');
    expect(results).toEqual([]);
  });
});
