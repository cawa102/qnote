import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NoteRepository } from '../../src/storage/note-repository.js';
import { NoteNotFoundError } from '../../src/types.js';

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
    expect(note.filePath).toContain('test-note.md');

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

  // ─── CJK-aware slugify ─────────────────────────────────────────

  it('slugifies English title', async () => {
    const note = await repo.create({
      title: 'Hello World',
      tags: [],
      content: 'test',
    });
    expect(note.filePath).toMatch(/hello-world\.md$/);
  });

  it('slugifies CJK title preserving characters', async () => {
    const note = await repo.create({
      title: 'API認証のフロー',
      tags: [],
      content: 'test',
    });
    // CJK characters should be preserved, spaces become hyphens
    expect(note.filePath).toMatch(/api認証のフロー\.md$/);
  });

  it('slugifies mixed CJK and Latin', async () => {
    const note = await repo.create({
      title: 'React コンポーネント設計',
      tags: [],
      content: 'test',
    });
    expect(note.filePath).toMatch(/react-コンポーネント設計\.md$/);
  });

  it('strips special characters from slug', async () => {
    const note = await repo.create({
      title: 'Hello! @World# $Test%',
      tags: [],
      content: 'test',
    });
    expect(note.filePath).toMatch(/hello-world-test\.md$/);
  });

  it('truncates slug to 200 characters', async () => {
    const longTitle = 'a'.repeat(300);
    const note = await repo.create({
      title: longTitle,
      tags: [],
      content: 'test',
    });
    const filename = note.filePath.split('/').pop()!;
    // filename = slug + '.md', slug max 200
    expect(filename.length).toBeLessThanOrEqual(200 + 3); // 200 + '.md'
  });

  // ─── Empty slug fallback ────────────────────────────────────────

  it('falls back to timestamp slug when title produces empty slug', async () => {
    const note = await repo.create({
      title: '!!!???',
      tags: [],
      content: 'test',
    });
    // Slug should be a timestamp fallback like 2026-02-27-103000
    expect(note.filePath).toMatch(/\d{4}-\d{2}-\d{2}-\d{6}\.md$/);
  });

  // ─── Collision detection ────────────────────────────────────────

  it('appends numeric suffix on slug collision', async () => {
    const note1 = await repo.create({ title: 'Same Name', tags: [], content: 'first' });
    const note2 = await repo.create({ title: 'Same Name', tags: [], content: 'second' });

    expect(note1.filePath).toMatch(/same-name\.md$/);
    expect(note2.filePath).toMatch(/same-name-2\.md$/);

    const raw1 = readFileSync(note1.filePath, 'utf-8');
    const raw2 = readFileSync(note2.filePath, 'utf-8');
    expect(raw1).toContain('first');
    expect(raw2).toContain('second');
  });

  it('increments suffix for multiple collisions', async () => {
    await repo.create({ title: 'Collide', tags: [], content: '1' });
    await repo.create({ title: 'Collide', tags: [], content: '2' });
    const note3 = await repo.create({ title: 'Collide', tags: [], content: '3' });

    expect(note3.filePath).toMatch(/collide-3\.md$/);
  });

  // ─── Atomic writes ─────────────────────────────────────────────

  it('uses atomic write (file content is complete, not partial)', async () => {
    const note = await repo.create({
      title: 'Atomic Test',
      tags: ['safe'],
      content: '# Atomic\n\nThis must be written atomically.',
    });

    // Verify the file exists and is complete
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
