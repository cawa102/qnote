import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NoteService } from '../../src/core/note-service.js';

describe('NoteService', () => {
  let tempDir: string;
  let service: NoteService;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'qnote-svc-'));
    mkdirSync(join(tempDir, '.qnote'), { recursive: true });
    service = new NoteService(tempDir);
  });

  afterEach(() => {
    service.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a note and indexes it', async () => {
    const note = await service.create({
      title: 'Test Service',
      tags: ['test'],
      content: '# Test\n\nSearchable content here.',
    });

    expect(note.meta.title).toBe('Test Service');

    const results = service.search('Searchable');
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('Test Service');
  });

  it('lists recent notes', async () => {
    await service.create({ title: 'Old Note', tags: [], content: 'Old' });
    await service.create({ title: 'New Note', tags: [], content: 'New' });

    const recent = service.listRecent();
    expect(recent).toHaveLength(2);
  });

  it('deletes a note and removes from index', async () => {
    const note = await service.create({ title: 'Gone', tags: [], content: 'Delete this' });
    await service.delete(note.filePath);

    const results = service.search('Delete this');
    expect(results).toHaveLength(0);
  });

  it('detects backlinks between notes', async () => {
    await service.create({
      title: 'Target Note',
      tags: [],
      content: 'This is the target.',
    });
    await service.create({
      title: 'Source Note',
      tags: [],
      content: 'See [[target-note]] for details.',
    });

    const backlinks = service.getBacklinks('target-note');
    expect(backlinks).toHaveLength(1);
    expect(backlinks[0]!.sourceTitle).toBe('Source Note');
  });

  it('reads a note by file path', async () => {
    const created = await service.create({
      title: 'Read Test',
      tags: ['read'],
      content: 'Content to read.',
    });

    const note = await service.read(created.filePath);
    expect(note.meta.title).toBe('Read Test');
    expect(note.content).toContain('Content to read.');
  });

  it('lists notes by tag', async () => {
    await service.create({ title: 'Tagged A', tags: ['api'], content: 'A content here.' });
    await service.create({ title: 'Tagged B', tags: ['design'], content: 'B content here.' });

    const apiNotes = service.listByTag('api');
    expect(apiNotes).toHaveLength(1);
    expect(apiNotes[0]!.title).toBe('Tagged A');
  });

  it('lists all tags with counts', async () => {
    await service.create({ title: 'Note 1', tags: ['api', 'design'], content: 'One content.' });
    await service.create({ title: 'Note 2', tags: ['api'], content: 'Two content here.' });

    const tags = service.listTags();
    expect(tags).toContainEqual({ tag: 'api', count: 2 });
    expect(tags).toContainEqual({ tag: 'design', count: 1 });
  });

  it('reindexes all notes from disk', async () => {
    await service.create({ title: 'Reindex Me', tags: ['test'], content: 'Reindexable content.' });

    // Close and reopen to simulate fresh start
    service.close();
    service = new NoteService(tempDir);

    const count = await service.reindex();
    expect(count).toBe(1);

    const results = service.search('Reindexable');
    expect(results).toHaveLength(1);
  });

  it('resolveWikiLink finds note by slug match', async () => {
    await service.create({
      title: 'API Design',
      tags: [],
      content: 'API design content here.',
    });

    const result = service.resolveWikiLink('api-design');
    expect(result).not.toBeNull();
    expect(result!.title).toBe('API Design');
  });

  it('resolveWikiLink finds note by title match (case-insensitive)', async () => {
    await service.create({
      title: 'My Title Note',
      tags: [],
      content: 'Title match content.',
    });

    const result = service.resolveWikiLink('my title note');
    expect(result).not.toBeNull();
    expect(result!.title).toBe('My Title Note');
  });

  it('resolveWikiLink does not strip special chars from target', async () => {
    await service.create({
      title: 'Test',
      tags: [],
      content: 'Test content here.',
    });

    // Old code stripped '!' from 'Test!', normalizing to 'test', matching 'test.md'
    // New code preserves '!', so 'Test!' doesn't match filename or title 'Test'
    const result = service.resolveWikiLink('Test!');
    expect(result).toBeNull();
  });

  it('resolveWikiLink matches filename case-insensitively', async () => {
    const note = await service.create({
      title: 'API Design',
      tags: [],
      content: 'API design content.',
    });

    const fileName = note.filePath.split('/').pop()?.replace('.md', '') ?? '';

    // Should match regardless of case in the wikilink target
    const upperResult = service.resolveWikiLink(fileName.toUpperCase());
    expect(upperResult).not.toBeNull();
    expect(upperResult!.title).toBe('API Design');

    const lowerResult = service.resolveWikiLink(fileName.toLowerCase());
    expect(lowerResult).not.toBeNull();
    expect(lowerResult!.title).toBe('API Design');
  });

  it('resolveWikiLink returns null for non-existent target', async () => {
    await service.create({
      title: 'Existing Note',
      tags: [],
      content: 'Some content here.',
    });

    const result = service.resolveWikiLink('non-existent');
    expect(result).toBeNull();
  });

  it('updates backlinks when content changes via reindex', async () => {
    const target = await service.create({
      title: 'Link Target',
      tags: [],
      content: 'I am the target.',
    });
    await service.create({
      title: 'Linker',
      tags: [],
      content: 'See [[link-target]] here.',
    });

    const backlinks = service.getBacklinks('link-target');
    expect(backlinks).toHaveLength(1);

    // Verify backlinks persist after reindex
    service.close();
    service = new NoteService(tempDir);
    await service.reindex();

    const backlinkAfter = service.getBacklinks('link-target');
    expect(backlinkAfter).toHaveLength(1);
  });
});
