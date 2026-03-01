import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NoteRepository } from '../../src/storage/note-repository.js';
import {
  NoteNotFoundError,
  InvalidTitleError,
  TitleTooLongError,
  SlugCollisionError,
} from '../../src/types.js';

describe('NoteRepository', () => {
  let tempDir: string;
  let repo: NoteRepository;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'qnote-test-'));
    repo = new NoteRepository(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ─── Basic CRUD ────────────────────────────────────────────────

  it('creates a note with frontmatter', async () => {
    const note = await repo.create({
      title: 'Test Note',
      tags: ['test'],
      content: '# Test\n\nBody text.',
    });

    expect(note.meta.title).toBe('Test Note');
    expect(note.meta.tags).toEqual(['test']);
    expect(note.filePath).toContain('Test-Note.md');

    const raw = readFileSync(note.filePath, 'utf-8');
    expect(raw).toContain('title: Test Note');
    expect(raw).toContain('Body text.');
  });

  it('reads an existing note by file path', async () => {
    const created = await repo.create({
      title: 'Read Me',
      tags: [],
      content: 'Hello world.',
    });

    const note = await repo.read(created.filePath);
    expect(note.meta.title).toBe('Read Me');
    expect(note.content).toContain('Hello world.');
  });

  it('throws NoteNotFoundError when reading non-existent file', async () => {
    await expect(repo.read('/nonexistent/path.md')).rejects.toThrow(NoteNotFoundError);
  });

  it('lists all markdown files', async () => {
    await repo.create({ title: 'Note A', tags: [], content: 'A' });
    await repo.create({ title: 'Note B', tags: [], content: 'B' });

    const files = await repo.listFiles();
    expect(files).toHaveLength(2);
    expect(files.every((f) => f.endsWith('.md'))).toBe(true);
  });

  it('lists markdown files in nested directories', async () => {
    await repo.create({ title: 'Root Note', tags: [], content: 'root', directory: undefined });
    await repo.create({ title: 'Nested Note', tags: [], content: 'nested', directory: 'sub' });

    const files = await repo.listFiles();
    expect(files).toHaveLength(2);
    expect(files.some((f) => f.includes('sub/'))).toBe(true);
  });

  it('deletes a note', async () => {
    const note = await repo.create({ title: 'Delete Me', tags: [], content: 'X' });
    await repo.delete(note.filePath);

    const files = await repo.listFiles();
    expect(files).toHaveLength(0);
  });

  // ─── toFilename: case preservation ────────────────────────────

  it('preserves case in English title', async () => {
    const note = await repo.create({
      title: 'Hello World',
      tags: [],
      content: 'test',
    });
    expect(note.filePath).toMatch(/Hello-World\.md$/);
  });

  it('preserves case in CJK title', async () => {
    const note = await repo.create({
      title: 'API認証のフロー',
      tags: [],
      content: 'test',
    });
    expect(note.filePath).toMatch(/API認証のフロー\.md$/);
  });

  it('preserves case in mixed CJK and Latin', async () => {
    const note = await repo.create({
      title: 'React コンポーネント設計',
      tags: [],
      content: 'test',
    });
    expect(note.filePath).toMatch(/React-コンポーネント設計\.md$/);
  });

  it('collapses consecutive spaces into single hyphen', async () => {
    const note = await repo.create({
      title: 'Hello   World',
      tags: [],
      content: 'test',
    });
    expect(note.filePath).toMatch(/Hello-World\.md$/);
  });

  it('trims leading and trailing spaces', async () => {
    const note = await repo.create({
      title: '  Trimmed Title  ',
      tags: [],
      content: 'test',
    });
    expect(note.filePath).toMatch(/Trimmed-Title\.md$/);
  });

  // ─── toFilename: forbidden characters → InvalidTitleError ────

  it('throws InvalidTitleError for forbidden FS characters', async () => {
    await expect(
      repo.create({ title: 'A/B', tags: [], content: 'test' }),
    ).rejects.toThrow(InvalidTitleError);
  });

  it('allows non-forbidden special characters in title', async () => {
    const note = await repo.create({
      title: "Node.js It's a (test) note_v2",
      tags: [],
      content: 'test',
    });
    expect(note.filePath).toMatch(/Node\.js-It's-a-\(test\)-note_v2\.md$/);
  });

  it('throws InvalidTitleError for asterisk in title', async () => {
    await expect(
      repo.create({ title: 'Test*Note', tags: [], content: 'test' }),
    ).rejects.toThrow(InvalidTitleError);
  });

  it('throws InvalidTitleError for pipe character', async () => {
    await expect(
      repo.create({ title: 'A|B', tags: [], content: 'test' }),
    ).rejects.toThrow(InvalidTitleError);
  });

  // ─── toFilename: byte-length check → TitleTooLongError ───────

  it('throws TitleTooLongError when filename exceeds 252 bytes', async () => {
    // Each CJK char is 3 bytes in UTF-8, so 85 CJK chars = 255 bytes > 252
    const longTitle = '漢'.repeat(85);
    await expect(
      repo.create({ title: longTitle, tags: [], content: 'test' }),
    ).rejects.toThrow(TitleTooLongError);
  });

  it('allows title exactly at 252-byte limit', async () => {
    // 84 CJK chars = 252 bytes exactly
    const title = '漢'.repeat(84);
    const note = await repo.create({ title, tags: [], content: 'test' });
    expect(note.filePath).toMatch(/\.md$/);
  });

  // ─── Empty title fallback ─────────────────────────────────────

  it('falls back to timestamp when title produces empty filename', async () => {
    const note = await repo.create({
      title: '   ',
      tags: [],
      content: 'test',
    });
    // Timestamp format: 2026-03-01-114500
    expect(note.filePath).toMatch(/\d{4}-\d{2}-\d{2}-\d{6}\.md$/);
  });

  // ─── Collision detection ──────────────────────────────────────

  it('throws SlugCollisionError on exact filename collision', async () => {
    await repo.create({ title: 'Same Name', tags: [], content: 'first' });

    await expect(
      repo.create({ title: 'Same Name', tags: [], content: 'second' }),
    ).rejects.toThrow(SlugCollisionError);
  });

  it('throws SlugCollisionError on case-insensitive collision', async () => {
    await repo.create({ title: 'My Note', tags: [], content: 'first' });

    await expect(
      repo.create({ title: 'my note', tags: [], content: 'second' }),
    ).rejects.toThrow(SlugCollisionError);
  });

  // ─── Atomic writes ─────────────────────────────────────────────

  it('uses atomic write (file content is complete, not partial)', async () => {
    const note = await repo.create({
      title: 'Atomic Test',
      tags: ['safe'],
      content: '# Atomic\n\nThis must be written atomically.',
    });

    const raw = readFileSync(note.filePath, 'utf-8');
    expect(raw).toContain('title: Atomic Test');
    expect(raw).toContain('This must be written atomically.');
  });

  it('update uses atomic write', async () => {
    const created = await repo.create({
      title: 'Update Me',
      tags: [],
      content: 'Original content.',
    });

    const updated = await repo.update(created.filePath, {
      content: 'Updated content.',
      modifiedTimestamp: '2026-02-27T15:00:00+09:00',
    });

    const raw = readFileSync(updated.filePath, 'utf-8');
    expect(raw).toContain('Updated content.');
    expect(raw).toContain('2026-02-27T15:00:00+09:00');
  });

  // ─── Auto-create directories ────────────────────────────────────

  it('auto-creates .qnote directory', async () => {
    const freshDir = mkdtempSync(join(tmpdir(), 'qnote-fresh-'));
    const freshRepo = new NoteRepository(freshDir);
    await freshRepo.create({ title: 'First', tags: [], content: 'first' });

    const files = await freshRepo.listFiles();
    expect(files).toHaveLength(1);

    rmSync(freshDir, { recursive: true, force: true });
  });

  it('creates notes in subdirectory', async () => {
    const note = await repo.create({
      title: 'Daily Note',
      tags: [],
      content: 'journal',
      directory: 'daily/2026-02',
    });

    expect(note.filePath).toContain('daily/2026-02/');
    const raw = readFileSync(note.filePath, 'utf-8');
    expect(raw).toContain('journal');
  });
});
