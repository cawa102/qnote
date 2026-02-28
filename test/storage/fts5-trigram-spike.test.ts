import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';

describe('FTS5 Trigram Tokenizer Spike', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    db.exec(`
      CREATE TABLE docs (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE docs_fts USING fts5(
        title,
        body,
        content='docs',
        content_rowid='id',
        tokenize='trigram'
      );

      CREATE TRIGGER docs_ai AFTER INSERT ON docs BEGIN
        INSERT INTO docs_fts(rowid, title, body)
        VALUES (new.id, new.title, new.body);
      END;

      CREATE TRIGGER docs_ad AFTER DELETE ON docs BEGIN
        INSERT INTO docs_fts(docs_fts, rowid, title, body)
        VALUES ('delete', old.id, old.title, old.body);
      END;

      CREATE TRIGGER docs_au AFTER UPDATE ON docs BEGIN
        INSERT INTO docs_fts(docs_fts, rowid, title, body)
        VALUES ('delete', old.id, old.title, old.body);
        INSERT INTO docs_fts(rowid, title, body)
        VALUES (new.id, new.title, new.body);
      END;
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('searches Japanese text with trigram tokenizer — 3+ CJK chars required', () => {
    db.prepare('INSERT INTO docs (id, title, body) VALUES (?, ?, ?)').run(
      1,
      'API認証のフローを整理',
      'OAuth2フローに基づいた認証の設計方針を記録する。',
    );

    // Trigram tokenizer requires 3+ characters to form a trigram.
    // "認証の" (3 chars) works, but "認証" (2 chars) cannot form a trigram.
    const results3Char = db
      .prepare(
        `SELECT d.id, d.title
         FROM docs_fts
         JOIN docs d ON docs_fts.rowid = d.id
         WHERE docs_fts MATCH ?`,
      )
      .all('認証の') as Array<{ id: number; title: string }>;

    expect(results3Char).toHaveLength(1);
    expect(results3Char[0]!.title).toBe('API認証のフローを整理');

    // 2-char CJK query returns no results (too short for trigram)
    let results2Char: Array<{ id: number }> = [];
    try {
      results2Char = db
        .prepare(
          `SELECT d.id
           FROM docs_fts
           JOIN docs d ON docs_fts.rowid = d.id
           WHERE docs_fts MATCH ?`,
        )
        .all('認証') as Array<{ id: number }>;
    } catch {
      // May throw for too-short queries
    }
    expect(results2Char.length).toBe(0);
  });

  it('searches ASCII text with trigram tokenizer — "API" matches', () => {
    db.prepare('INSERT INTO docs (id, title, body) VALUES (?, ?, ?)').run(
      1,
      'API認証のフローを整理',
      'REST APIのエンドポイント設計。',
    );

    const results = db
      .prepare(
        `SELECT d.id, d.title
         FROM docs_fts
         JOIN docs d ON docs_fts.rowid = d.id
         WHERE docs_fts MATCH ?`,
      )
      .all('API') as Array<{ id: number; title: string }>;

    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('API認証のフローを整理');
  });

  it('searches mixed Japanese/English content', () => {
    db.prepare('INSERT INTO docs (id, title, body) VALUES (?, ?, ?)').run(
      1,
      'Reactコンポーネント設計',
      'useStateとuseEffectを活用したコンポーネント設計パターン。',
    );

    const results = db
      .prepare(
        `SELECT d.id, d.title
         FROM docs_fts
         JOIN docs d ON docs_fts.rowid = d.id
         WHERE docs_fts MATCH ?`,
      )
      .all('コンポーネント') as Array<{ id: number; title: string }>;

    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('Reactコンポーネント設計');
  });

  it('confirms brackets are FTS5 special chars — link targets need dedicated table', () => {
    db.prepare('INSERT INTO docs (id, title, body) VALUES (?, ?, ?)').run(
      1,
      'リンクテスト',
      '詳細は[[auth-flow]]を参照。また[[db-schema]]も確認。',
    );

    // Brackets [ ] are FTS5 special syntax — querying raw "[[auth" throws.
    // This validates our design choice: links must be extracted and stored
    // in a separate links table for reliable backlink resolution.
    expect(() => {
      db.prepare(
        `SELECT d.id
         FROM docs_fts
         JOIN docs d ON docs_fts.rowid = d.id
         WHERE docs_fts MATCH ?`,
      ).all('[[auth');
    }).toThrow();

    // But the slug text itself (without special chars) is searchable
    const slugResults = db
      .prepare(
        `SELECT d.id
         FROM docs_fts
         JOIN docs d ON docs_fts.rowid = d.id
         WHERE docs_fts MATCH ?`,
      )
      .all('"auth-flow"') as Array<{ id: number }>;

    expect(slugResults).toHaveLength(1);
  });

  it('snippet function works with trigram tokenizer', () => {
    db.prepare('INSERT INTO docs (id, title, body) VALUES (?, ?, ?)').run(
      1,
      'スニペットテスト',
      'この文書はスニペット機能のテストです。検索結果のハイライトを確認します。',
    );

    const results = db
      .prepare(
        `SELECT d.title, snippet(docs_fts, 1, '[', ']', '...', 32) AS snippet
         FROM docs_fts
         JOIN docs d ON docs_fts.rowid = d.id
         WHERE docs_fts MATCH ?`,
      )
      .all('スニペット') as Array<{ title: string; snippet: string }>;

    expect(results).toHaveLength(1);
    expect(results[0]!.snippet).toContain('スニペット');
  });

  it('does not match very short queries (1 char) — trigram requires 3+ chars', () => {
    db.prepare('INSERT INTO docs (id, title, body) VALUES (?, ?, ?)').run(
      1,
      'テスト',
      'あ',
    );

    // Trigram tokenizer requires at least 3 characters for a match.
    // Single character search should either fail or return no results.
    let results: Array<{ id: number }> = [];
    try {
      results = db
        .prepare(
          `SELECT d.id
           FROM docs_fts
           JOIN docs d ON docs_fts.rowid = d.id
           WHERE docs_fts MATCH ?`,
        )
        .all('あ') as Array<{ id: number }>;
    } catch {
      // FTS5 may throw an error for too-short trigram queries — that's expected
    }

    // Either no results or an error is acceptable behavior
    expect(results.length).toBe(0);
  });
});
