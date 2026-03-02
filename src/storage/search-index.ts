import Database from 'better-sqlite3';

// ─── Types ─────────────────────────────────────────────────────────

export interface IndexEntry {
  readonly filePath: string;
  readonly title: string;
  readonly tags: readonly string[];
  readonly content: string;
  readonly created: string;
  readonly modified: string;
}

export interface SearchHit {
  readonly filePath: string;
  readonly title: string;
  readonly tags: string[];
  readonly snippet: string;
  readonly modified: string;
}

export interface TagCount {
  readonly tag: string;
  readonly count: number;
}

export interface LinkEntry {
  readonly targetSlug: string;
  readonly targetText: string;
}

export interface BacklinkHit {
  readonly sourcePath: string;
  readonly sourceTitle: string;
  readonly targetSlug: string;
  readonly targetText: string;
}

// ─── SearchIndex ───────────────────────────────────────────────────

export class SearchIndex {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        file_path TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created TEXT NOT NULL,
        modified TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        title,
        content,
        content='notes',
        content_rowid='rowid',
        tokenize='trigram'
      );

      CREATE TABLE IF NOT EXISTS note_tags (
        file_path TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (file_path, tag),
        FOREIGN KEY (file_path) REFERENCES notes(file_path) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag);

      CREATE TABLE IF NOT EXISTS links (
        source_path TEXT NOT NULL,
        target_slug TEXT NOT NULL,
        target_text TEXT NOT NULL,
        PRIMARY KEY (source_path, target_slug),
        FOREIGN KEY (source_path) REFERENCES notes(file_path) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_slug);

      CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(rowid, title, content)
        VALUES (new.rowid, new.title, new.content);
      END;

      CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, content)
        VALUES ('delete', old.rowid, old.title, old.content);
      END;

      CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, content)
        VALUES ('delete', old.rowid, old.title, old.content);
        INSERT INTO notes_fts(rowid, title, content)
        VALUES (new.rowid, new.title, new.content);
      END;
    `);
  }

  // ─── Note operations ────────────────────────────────────────────

  upsert(entry: IndexEntry): void {
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO notes (file_path, title, content, created, modified)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(entry.filePath, entry.title, entry.content, entry.created, entry.modified);

      this.db.prepare('DELETE FROM note_tags WHERE file_path = ?').run(entry.filePath);

      const insertTag = this.db.prepare(
        'INSERT INTO note_tags (file_path, tag) VALUES (?, ?)',
      );
      for (const tag of entry.tags) {
        insertTag.run(entry.filePath, tag);
      }
    });
    tx();
  }

  remove(filePath: string): void {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM links WHERE source_path = ?').run(filePath);
      this.db.prepare('DELETE FROM note_tags WHERE file_path = ?').run(filePath);
      this.db.prepare('DELETE FROM notes WHERE file_path = ?').run(filePath);
    });
    tx();
  }

  // ─── Search ─────────────────────────────────────────────────────

  shouldSearch(query: string): boolean {
    // Trigram tokenizer requires 3+ characters for all scripts (including CJK)
    return query.trim().length >= 3;
  }

  search(query: string): SearchHit[] {
    const sanitized = this.sanitizeQuery(query);
    if (sanitized.length === 0) {
      return [];
    }

    try {
      const rows = this.db
        .prepare(
          `SELECT n.file_path, n.title, n.modified,
                  snippet(notes_fts, 1, '[', ']', '...', 32) AS snippet
           FROM notes_fts
           JOIN notes n ON notes_fts.rowid = n.rowid
           WHERE notes_fts MATCH ?
           ORDER BY rank`,
        )
        .all(sanitized) as Array<{
        file_path: string;
        title: string;
        modified: string;
        snippet: string;
      }>;

      return rows.map((row) => ({
        filePath: row.file_path,
        title: row.title,
        tags: this.getTagsForFile(row.file_path),
        snippet: row.snippet,
        modified: row.modified,
      }));
    } catch {
      // If the sanitized query still fails (edge case), return empty
      return [];
    }
  }

  // ─── Tag operations ─────────────────────────────────────────────

  listByTag(tag: string): SearchHit[] {
    const rows = this.db
      .prepare(
        `SELECT n.file_path, n.title, n.modified
         FROM note_tags nt
         JOIN notes n ON nt.file_path = n.file_path
         WHERE nt.tag = ?
         ORDER BY n.modified DESC`,
      )
      .all(tag) as Array<{
      file_path: string;
      title: string;
      modified: string;
    }>;

    return rows.map((row) => ({
      filePath: row.file_path,
      title: row.title,
      tags: this.getTagsForFile(row.file_path),
      snippet: '',
      modified: row.modified,
    }));
  }

  listTags(): TagCount[] {
    return this.db
      .prepare(
        'SELECT tag, COUNT(*) as count FROM note_tags GROUP BY tag ORDER BY count DESC',
      )
      .all() as TagCount[];
  }

  // ─── Recent notes ───────────────────────────────────────────────

  listRecent(limit = 5): SearchHit[] {
    const rows = this.db
      .prepare(
        `SELECT file_path, title, modified
         FROM notes
         ORDER BY modified DESC
         LIMIT ?`,
      )
      .all(limit) as Array<{
      file_path: string;
      title: string;
      modified: string;
    }>;

    return rows.map((row) => ({
      filePath: row.file_path,
      title: row.title,
      tags: this.getTagsForFile(row.file_path),
      snippet: '',
      modified: row.modified,
    }));
  }

  // ─── Link operations ────────────────────────────────────────────

  upsertLinks(sourcePath: string, links: readonly LinkEntry[]): void {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM links WHERE source_path = ?').run(sourcePath);

      const insertLink = this.db.prepare(
        'INSERT OR REPLACE INTO links (source_path, target_slug, target_text) VALUES (?, ?, ?)',
      );
      for (const link of links) {
        insertLink.run(sourcePath, link.targetSlug, link.targetText);
      }
    });
    tx();
  }

  getBacklinks(targetSlug: string): BacklinkHit[] {
    const rows = this.db
      .prepare(
        `SELECT l.source_path, n.title AS source_title, l.target_slug, l.target_text
         FROM links l
         JOIN notes n ON l.source_path = n.file_path
         WHERE l.target_slug = ?
         ORDER BY n.modified DESC`,
      )
      .all(targetSlug) as Array<{
      source_path: string;
      source_title: string;
      target_slug: string;
      target_text: string;
    }>;

    return rows.map((row) => ({
      sourcePath: row.source_path,
      sourceTitle: row.source_title,
      targetSlug: row.target_slug,
      targetText: row.target_text,
    }));
  }

  // ─── Lifecycle ──────────────────────────────────────────────────

  close(): void {
    this.db.close();
  }

  // ─── Private helpers ────────────────────────────────────────────

  private getTagsForFile(filePath: string): string[] {
    const rows = this.db
      .prepare('SELECT tag FROM note_tags WHERE file_path = ?')
      .all(filePath) as Array<{ tag: string }>;
    return rows.map((r) => r.tag);
  }

  private sanitizeQuery(query: string): string {
    let sanitized = query.trim();

    // Remove FTS5 special operators that could cause syntax errors
    sanitized = sanitized.replace(/[*"[\]{}()^]/g, '');

    // Remove FTS5 boolean operators if they appear as standalone words
    sanitized = sanitized.replace(/\b(AND|OR|NOT|NEAR)\b/g, '');

    // Collapse multiple spaces
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
  }
}
