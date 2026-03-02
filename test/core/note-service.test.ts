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

  // ─── renameTag ──────────────────────────────────────────────────

  describe('renameTag', () => {
    it('renames tag in all notes that have it, returns correct count', async () => {
      await service.create({ title: 'Note A', tags: ['old-tag', 'keep'], content: 'A' });
      await service.create({ title: 'Note B', tags: ['old-tag'], content: 'B' });
      await service.create({ title: 'Note C', tags: ['other'], content: 'C' });

      const count = await service.renameTag('old-tag', 'new-tag');

      expect(count).toBe(2);

      // Verify tags updated on disk
      const noteA = await service.read((await service.listByTag('new-tag')).find(h => h.title === 'Note A')!.filePath);
      expect(noteA.meta.tags).toContain('new-tag');
      expect(noteA.meta.tags).not.toContain('old-tag');
      expect(noteA.meta.tags).toContain('keep');

      const noteB = await service.read((await service.listByTag('new-tag')).find(h => h.title === 'Note B')!.filePath);
      expect(noteB.meta.tags).toContain('new-tag');
      expect(noteB.meta.tags).not.toContain('old-tag');

      // Unrelated note unchanged
      const noteC = await service.read((service.listByTag('other'))[0]!.filePath);
      expect(noteC.meta.tags).toEqual(['other']);
    });

    it('handles merge when note already has newTag (dedup)', async () => {
      await service.create({ title: 'Merge Note', tags: ['old-tag', 'new-tag'], content: 'Merge' });

      const count = await service.renameTag('old-tag', 'new-tag');

      expect(count).toBe(1);

      const notes = service.listByTag('new-tag');
      expect(notes).toHaveLength(1);
      const note = await service.read(notes[0]!.filePath);
      expect(note.meta.tags).toEqual(['new-tag']);
      expect(note.meta.tags).not.toContain('old-tag');
    });

    it('returns 0 for non-existent tag', async () => {
      await service.create({ title: 'Some Note', tags: ['existing'], content: 'Content' });

      const count = await service.renameTag('nonexistent', 'anything');

      expect(count).toBe(0);
    });

    it('reindexes notes after rename so search reflects new tags', async () => {
      await service.create({ title: 'Indexed', tags: ['old-tag'], content: 'Indexed content' });

      await service.renameTag('old-tag', 'new-tag');

      expect(service.listByTag('old-tag')).toHaveLength(0);
      expect(service.listByTag('new-tag')).toHaveLength(1);
    });
  });

  // ─── renameTagForNote ──────────────────────────────────────────

  describe('renameTagForNote', () => {
    it('renames tag in a single note only', async () => {
      const noteA = await service.create({ title: 'Note A', tags: ['shared-tag'], content: 'A' });
      await service.create({ title: 'Note B', tags: ['shared-tag'], content: 'B' });

      await service.renameTagForNote(noteA.filePath, 'shared-tag', 'renamed-tag');

      const updatedA = await service.read(noteA.filePath);
      expect(updatedA.meta.tags).toContain('renamed-tag');
      expect(updatedA.meta.tags).not.toContain('shared-tag');

      // Note B should be unchanged
      const notesBWithShared = service.listByTag('shared-tag');
      expect(notesBWithShared).toHaveLength(1);
      expect(notesBWithShared[0]!.title).toBe('Note B');
    });

    it('handles merge on single note (dedup)', async () => {
      const note = await service.create({ title: 'Dedup Note', tags: ['old', 'new'], content: 'Dedup' });

      await service.renameTagForNote(note.filePath, 'old', 'new');

      const updated = await service.read(note.filePath);
      expect(updated.meta.tags).toEqual(['new']);
    });

    it('throws NoteNotFoundError if note does not exist', async () => {
      await expect(
        service.renameTagForNote(join(tempDir, 'nonexistent.md'), 'old', 'new'),
      ).rejects.toThrow('Note not found');
    });

    it('is a no-op if note does not have the old tag', async () => {
      const note = await service.create({ title: 'No Match', tags: ['other'], content: 'Content' });

      await service.renameTagForNote(note.filePath, 'nonexistent', 'new-tag');

      const updated = await service.read(note.filePath);
      expect(updated.meta.tags).toEqual(['other']);
    });
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
