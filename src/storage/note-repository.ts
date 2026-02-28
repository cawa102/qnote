import { readFile, writeFile, unlink, readdir, mkdir, rename, access } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseFrontmatter, serializeFrontmatter } from './frontmatter.js';
import type { Note, NoteMeta } from '../types.js';
import { NoteNotFoundError, FileWriteError } from '../types.js';

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

const MAX_SLUG_LENGTH = 200;

export class NoteRepository {
  constructor(private readonly notesDir: string) {}

  async create(input: CreateNoteInput): Promise<Note> {
    const now = new Date().toISOString();
    const slug = this.slugify(input.title);
    const dir = input.directory
      ? join(this.notesDir, input.directory)
      : this.notesDir;

    await mkdir(dir, { recursive: true });

    const filePath = await this.resolveCollision(dir, slug);
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
    await unlink(filePath);
  }

  // ─── Private helpers ────────────────────────────────────────────

  private slugify(title: string): string {
    const slug = title
      .normalize('NFC')
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/[\s]+/g, '-')
      .toLowerCase()
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (slug.length === 0) {
      return this.timestampSlug();
    }

    return slug.slice(0, MAX_SLUG_LENGTH);
  }

  private timestampSlug(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async resolveCollision(dir: string, slug: string): Promise<string> {
    const basePath = join(dir, `${slug}.md`);
    if (!(await this.fileExists(basePath))) {
      return basePath;
    }

    let suffix = 2;
    while (suffix <= 1000) {
      const candidatePath = join(dir, `${slug}-${suffix}.md`);
      if (!(await this.fileExists(candidatePath))) {
        return candidatePath;
      }
      suffix++;
    }

    // Extremely unlikely: 1000 collisions. Fall back to UUID.
    return join(dir, `${slug}-${randomUUID().slice(0, 8)}.md`);
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
