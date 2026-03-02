import { readFile, writeFile, unlink, readdir, mkdir, rename } from 'node:fs/promises';
import { join, extname, dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseFrontmatter, serializeFrontmatter } from './frontmatter.js';
import { assertPathWithinRoot } from './path-utils.js';
import type { Note, NoteMeta } from '../types.js';
import {
  NoteNotFoundError,
  FileWriteError,
  InvalidTitleError,
  TitleTooLongError,
  SlugCollisionError,
} from '../types.js';

export interface CreateNoteInput {
  readonly title: string;
  readonly tags: readonly string[];
  readonly content: string;
  readonly directory?: string;
}

export interface UpdateNoteInput {
  readonly title?: string;
  readonly tags?: readonly string[];
  readonly content?: string;
  readonly modifiedTimestamp?: string;
}

const MAX_FILENAME_BYTES = 252;

// Forbidden filesystem characters: / \ : * ? " < > |
const FORBIDDEN_CHAR_RE = /[/\\:*?"<>|]/;

export class NoteRepository {
  constructor(private readonly notesDir: string) {}

  async create(input: CreateNoteInput): Promise<Note> {
    const now = new Date().toISOString();
    const filename = this.toFilename(input.title);
    const dir = input.directory
      ? join(this.notesDir, input.directory)
      : this.notesDir;

    await assertPathWithinRoot(resolve(dir), this.notesDir);
    await mkdir(dir, { recursive: true });

    const filePath = await this.checkCollision(dir, filename);
    const meta: NoteMeta = {
      title: input.title,
      tags: [...input.tags],
      created: now,
      modified: now,
    };

    const raw = serializeFrontmatter(meta, input.content);
    await this.atomicWrite(filePath, raw);

    return { meta, content: input.content, filePath };
  }

  async read(filePath: string): Promise<Note> {
    await assertPathWithinRoot(filePath, this.notesDir);
    let raw: string;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch {
      throw new NoteNotFoundError(filePath);
    }

    const { meta, content } = parseFrontmatter(raw);
    return { meta, content, filePath };
  }

  async update(filePath: string, input: UpdateNoteInput): Promise<Note> {
    const existing = await this.read(filePath);

    const meta: NoteMeta = {
      title: input.title ?? existing.meta.title,
      tags: input.tags ? [...input.tags] : [...existing.meta.tags],
      created: existing.meta.created,
      modified: input.modifiedTimestamp ?? new Date().toISOString(),
    };

    const content = input.content ?? existing.content;
    const raw = serializeFrontmatter(meta, content);
    await this.atomicWrite(filePath, raw);

    return { meta, content, filePath };
  }

  async listFiles(dir?: string): Promise<string[]> {
    const targetDir = dir ?? this.notesDir;
    const results: string[] = [];

    try {
      const entries = await readdir(targetDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(targetDir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const nested = await this.listFiles(fullPath);
          results.push(...nested);
        } else if (entry.isFile() && extname(entry.name) === '.md') {
          results.push(fullPath);
        }
      }
    } catch {
      // directory doesn't exist yet — return empty
    }

    return results;
  }

  async delete(filePath: string): Promise<void> {
    await assertPathWithinRoot(filePath, this.notesDir);
    await unlink(filePath);
  }

  // ─── Private helpers ────────────────────────────────────────────

  private toFilename(title: string): string {
    const normalized = title.normalize('NFC');

    if (FORBIDDEN_CHAR_RE.test(normalized)) {
      throw new InvalidTitleError(title);
    }

    const filename = normalized
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (filename.length === 0) {
      return this.timestampFilename();
    }

    const byteLength = Buffer.byteLength(filename, 'utf-8');
    if (byteLength > MAX_FILENAME_BYTES) {
      throw new TitleTooLongError(title, byteLength, MAX_FILENAME_BYTES);
    }

    return filename;
  }

  private timestampFilename(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
  }

  private async checkCollision(dir: string, filename: string): Promise<string> {
    const filePath = join(dir, `${filename}.md`);

    let entries: string[];
    try {
      const dirEntries = await readdir(dir);
      entries = dirEntries.filter((e) => e.endsWith('.md'));
    } catch {
      // Directory doesn't exist yet — no collision possible
      return filePath;
    }

    const target = `${filename}.md`.toLowerCase();
    for (const entry of entries) {
      if (entry.toLowerCase() === target) {
        throw new SlugCollisionError(filename, join(dir, entry));
      }
    }

    return filePath;
  }

  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const dir = dirname(filePath);
    const tempPath = join(dir, `.tmp-${randomUUID()}`);

    try {
      await writeFile(tempPath, content, 'utf-8');
      await rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file on failure
      try {
        await unlink(tempPath);
      } catch {
        // temp file may not exist if writeFile failed
      }
      throw new FileWriteError(
        filePath,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
