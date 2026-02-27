import { join } from 'node:path';
import { NoteRepository } from '../storage/note-repository.js';
import { SearchIndex } from '../storage/search-index.js';
import { extractWikiLinks } from '../storage/link-parser.js';
import type { Note, BackLink } from '../types.js';
import type { SearchHit, TagCount, BacklinkHit } from '../storage/search-index.js';

interface CreateInput {
  readonly title: string;
  readonly tags: readonly string[];
  readonly content: string;
  readonly directory?: string;
}

export class NoteService {
  private readonly repo: NoteRepository;
  private readonly index: SearchIndex;

  constructor(private readonly notesDir: string) {
    this.repo = new NoteRepository(notesDir);
    this.index = new SearchIndex(join(notesDir, '.qnote', 'index.db'));
  }

  async create(input: CreateInput): Promise<Note> {
    const note = await this.repo.create(input);

    this.index.upsert({
      filePath: note.filePath,
      title: note.meta.title,
      tags: [...note.meta.tags],
      content: note.content,
      created: note.meta.created,
      modified: note.meta.modified,
    });

    this.indexLinks(note);
    return note;
  }

  async read(filePath: string): Promise<Note> {
    return this.repo.read(filePath);
  }

  async delete(filePath: string): Promise<void> {
    this.index.remove(filePath);
    await this.repo.delete(filePath);
  }

  search(query: string): SearchHit[] {
    return this.index.search(query);
  }

  listRecent(limit = 20): SearchHit[] {
    return this.index.listRecent(limit);
  }

  listByTag(tag: string): SearchHit[] {
    return this.index.listByTag(tag);
  }

  listTags(): TagCount[] {
    return this.index.listTags();
  }

  getBacklinks(slug: string): BacklinkHit[] {
    return this.index.getBacklinks(slug);
  }

  async reindex(): Promise<number> {
    const files = await this.repo.listFiles();
    let count = 0;

    for (const filePath of files) {
      const note = await this.repo.read(filePath);

      this.index.upsert({
        filePath,
        title: note.meta.title,
        tags: [...note.meta.tags],
        content: note.content,
        created: note.meta.created,
        modified: note.meta.modified,
      });

      this.indexLinks(note);
      count++;
    }

    return count;
  }

  resolveWikiLink(target: string): { filePath: string; title: string } | null {
    const normalizedTarget = target
      .normalize('NFC')
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/[\s]+/g, '-')
      .toLowerCase()
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const allNotes = this.index.listRecent(10000);

    // Strategy 1: Match by slug in file path
    for (const hit of allNotes) {
      const fileName = hit.filePath.split('/').pop()?.replace('.md', '') ?? '';
      if (fileName === normalizedTarget || fileName === target) {
        return { filePath: hit.filePath, title: hit.title };
      }
    }

    // Strategy 2: Match by title (case-insensitive)
    for (const hit of allNotes) {
      if (hit.title.toLowerCase() === target.toLowerCase()) {
        return { filePath: hit.filePath, title: hit.title };
      }
    }

    return null;
  }

  close(): void {
    this.index.close();
  }

  private indexLinks(note: Note): void {
    const links = extractWikiLinks(note.content);
    if (links.length > 0) {
      this.index.upsertLinks(
        note.filePath,
        links.map((link) => ({
          targetSlug: link.target,
          targetText: link.displayText,
        })),
      );
    }
  }
}
