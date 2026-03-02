import { describe, it, expect } from 'vitest';
import { parseFrontmatter, serializeFrontmatter } from '../../src/storage/frontmatter.js';

describe('parseFrontmatter', () => {
  it('parses valid frontmatter with all fields', () => {
    const raw = `---
title: API設計方針
tags: [api, design]
created: 2026-02-27T10:30:00+09:00
modified: 2026-02-27T14:00:00+09:00
---
# API設計方針

本文テキスト`;

    const result = parseFrontmatter(raw);

    expect(result.meta.title).toBe('API設計方針');
    expect(result.meta.tags).toEqual(['api', 'design']);
    expect(result.meta.created).toBe('2026-02-27T10:30:00+09:00');
    expect(result.content).toContain('# API設計方針');
    expect(result.content).toContain('本文テキスト');
  });

  it('returns empty tags when tags field is missing', () => {
    const raw = `---
title: No Tags
created: 2026-02-27T10:30:00+09:00
modified: 2026-02-27T10:30:00+09:00
---
Content`;

    const result = parseFrontmatter(raw);
    expect(result.meta.tags).toEqual([]);
  });

  it('handles content without frontmatter — uses first # heading as title', () => {
    const raw = '# Just a heading\n\nSome text';
    const result = parseFrontmatter(raw);
    expect(result.meta.title).toBe('Just a heading');
    expect(result.content).toContain('# Just a heading');
    expect(result.content).toContain('Some text');
  });

  it('handles content without frontmatter and without heading — uses empty title', () => {
    const raw = 'No frontmatter and no heading.\n\nJust plain text.';
    const result = parseFrontmatter(raw);
    expect(result.meta.title).toBe('');
    expect(result.content).toContain('No frontmatter and no heading.');
  });

  it('gracefully handles malformed YAML — does not crash', () => {
    const raw = `---
title: [unclosed bracket
tags: {invalid: yaml: here
---
Body content here.`;

    const result = parseFrontmatter(raw);

    // Should not throw. Graceful degradation: returns body and attempts best-effort parse.
    expect(result.content).toBeDefined();
    expect(result.meta.tags).toEqual([]);
    // title may or may not be recoverable depending on gray-matter behavior
    expect(typeof result.meta.title).toBe('string');
  });

  it('handles frontmatter with Date objects (gray-matter auto-parses dates)', () => {
    const raw = `---
title: Date Test
tags: []
created: 2026-02-27
modified: 2026-02-27
---
Content`;

    const result = parseFrontmatter(raw);
    // gray-matter parses bare dates as Date objects — our code must handle both string and Date
    expect(typeof result.meta.created).toBe('string');
    expect(result.meta.created).toBeTruthy();
    expect(typeof result.meta.modified).toBe('string');
    expect(result.meta.modified).toBeTruthy();
  });

  it('handles tags that are not an array (string)', () => {
    const raw = `---
title: String Tag
tags: single-tag
created: 2026-02-27T10:00:00+09:00
modified: 2026-02-27T10:00:00+09:00
---
Content`;

    const result = parseFrontmatter(raw);
    expect(result.meta.tags).toEqual(['single-tag']);
  });

  it('handles completely empty file', () => {
    const result = parseFrontmatter('');
    expect(result.meta.title).toBe('');
    expect(result.meta.tags).toEqual([]);
    expect(result.content).toBe('');
  });
});

describe('serializeFrontmatter', () => {
  it('produces valid YAML frontmatter + content', () => {
    const meta = {
      title: 'Test Note',
      tags: ['test', 'example'] as readonly string[],
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T11:00:00+09:00',
    };
    const content = '# Test Note\n\nBody text.';

    const result = serializeFrontmatter(meta, content);

    expect(result).toContain('---');
    expect(result).toContain('title: Test Note');
    expect(result).toContain('# Test Note');
    expect(result).toContain('Body text.');
  });

  it('round-trips through parse → serialize → parse', () => {
    const meta = {
      title: 'ラウンドトリップ',
      tags: ['日本語', 'test'] as readonly string[],
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T14:00:00+09:00',
    };
    const content = '# ラウンドトリップ\n\n本文のテスト。';

    const serialized = serializeFrontmatter(meta, content);
    const parsed = parseFrontmatter(serialized);

    expect(parsed.meta.title).toBe('ラウンドトリップ');
    expect(parsed.meta.tags).toEqual(['日本語', 'test']);
    expect(parsed.content).toContain('本文のテスト。');
  });

  it('safely handles YAML injection in title (colons, newlines)', () => {
    const meta = {
      title: 'evil: title\ninjected: true',
      tags: ['safe'] as readonly string[],
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    };

    const serialized = serializeFrontmatter(meta, 'Body');
    const parsed = parseFrontmatter(serialized);

    expect(parsed.meta.title).toBe('evil: title\ninjected: true');
    expect(parsed.meta.tags).toEqual(['safe']);
  });

  it('safely handles YAML injection in tags', () => {
    const meta = {
      title: 'Normal',
      tags: ['tag: with colon', 'tag\nwith newline'] as readonly string[],
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    };

    const serialized = serializeFrontmatter(meta, 'Body');
    const parsed = parseFrontmatter(serialized);

    expect(parsed.meta.title).toBe('Normal');
    expect(parsed.meta.tags).toContain('tag: with colon');
    expect(parsed.meta.tags).toContain('tag\nwith newline');
  });

  it('round-trips created timestamp with special characters', () => {
    const meta = {
      title: 'Timestamp Test',
      tags: [] as readonly string[],
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T14:00:00+09:00',
    };

    const serialized = serializeFrontmatter(meta, 'Content');
    const parsed = parseFrontmatter(serialized);

    expect(parsed.meta.created).toBe('2026-02-27T10:00:00+09:00');
    expect(parsed.meta.modified).toBe('2026-02-27T14:00:00+09:00');
  });
});
