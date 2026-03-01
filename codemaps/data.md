# Data Models & Schemas Codemap

> Freshness: 2026-02-28 21:30 JST | Commit: a02370b

## TypeScript Types (src/types.ts, 166 lines)

### Error Hierarchy

```
AppError (base, code: string)
  ├── NoteNotFoundError     code: 'NOTE_NOT_FOUND'
  ├── SlugCollisionError    code: 'SLUG_COLLISION'
  ├── FileWriteError        code: 'FILE_WRITE_ERROR'
  ├── FtsQueryError         code: 'FTS_QUERY_ERROR'
  ├── FrontmatterParseError code: 'FRONTMATTER_PARSE_ERROR'
  └── NoteSizeLimitError    code: 'NOTE_SIZE_LIMIT'
```

### Core Data Types

```typescript
NoteMeta {
  readonly title: string
  readonly tags: readonly string[]
  readonly created: string   // ISO 8601
  readonly modified: string  // ISO 8601
}

Note {
  readonly meta: NoteMeta
  readonly content: string
  readonly filePath: string
}

NoteListItem {
  readonly title: string
  readonly tags: readonly string[]
  readonly modified: string
  readonly filePath: string
  readonly backlinkCount: number
}
```

### Search Types

```typescript
SearchResult {
  readonly note: Note
  readonly snippet: string
  readonly matchRanges: readonly MatchRange[]
}

MatchRange { readonly start: number; readonly end: number }

// From SearchIndex (not in types.ts):
SearchHit { title, filePath, tags, modified, snippet }
BacklinkHit { sourceTitle, sourcePath }
TagCount { tag, count }
```

### Link Types

```typescript
WikiLink {
  readonly target: string       // [[target|display]]
  readonly displayText: string
  readonly position: number     // char offset in source
}

BackLink {
  readonly sourceTitle: string
  readonly sourceFilePath: string
  readonly context: string
}
```

### File Scanner Types (src/storage/file-scanner.ts)

```typescript
ScannedFile {
  readonly relativePath: string   // e.g. "projects/todo-app.md"
  readonly absolutePath: string   // full path for editor navigation
}

ScanOptions {
  readonly excludeDirs?: readonly string[]
}
```

### Navigation (Discriminated Union)

```typescript
ScreenName = 'palette' | 'noteList' | 'notePreview' | 'findFile' | 'search' | 'capture' | 'editor'

ScreenEntry =
  | { screen: 'palette' }
  | { screen: 'noteList'; filter?: string; tag?: string }
  | { screen: 'notePreview'; filePath: string }
  | { screen: 'findFile' }
  | { screen: 'search'; initialQuery?: string }
  | { screen: 'capture' }
  | { screen: 'editor'; filePath?: string; showFileTree?: boolean }

NavigationState {
  readonly stack: readonly ScreenEntry[]
}
```

### Config

```typescript
QnoteConfig {
  readonly notesDir: string        // default: ~/notes
  readonly daily: { dir: string }  // default: daily/
  readonly capture: { dir: string } // default: inbox/
  readonly search: { excludeDirs: string[] }
}
```

### Editor Types (src/tui/editor/types.ts, 47 lines)

```typescript
CursorPosition { readonly line: number; readonly col: number }
Selection { readonly anchor: CursorPosition; readonly head: CursorPosition }

TextBufferState {
  readonly lines: readonly string[]
  readonly cursor: CursorPosition
  readonly selection: Selection | null
}

UndoEntry { readonly before: TextBufferState; readonly after: TextBufferState }

BufferInfo {
  readonly id: string
  readonly filePath: string
  readonly title: string
  readonly dirty: boolean
}

EditorMode = 'edit' | 'preview'
FocusArea = 'editor' | 'fileTree' | 'headerTitle' | 'headerTags'
InputMode = 'navigation' | 'text'

FileTreeNode {
  readonly name: string
  readonly path: string
  readonly type: 'file' | 'directory'
  readonly children: readonly FileTreeNode[]
  readonly expanded: boolean
}
```

## SQLite Schema (SearchIndex)

```sql
-- Main notes table
CREATE TABLE IF NOT EXISTS notes (
  file_path TEXT PRIMARY KEY,
  title     TEXT NOT NULL,
  content   TEXT NOT NULL,
  created   TEXT,
  modified  TEXT
);

-- FTS5 virtual table (trigram tokenizer for CJK)
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  title, content,
  content='notes',
  content_rowid='rowid',
  tokenize='trigram'
);

-- Auto-sync triggers (INSERT, UPDATE, DELETE)
-- notes → notes_fts

-- Tag junction table
CREATE TABLE IF NOT EXISTS note_tags (
  file_path TEXT NOT NULL,
  tag       TEXT NOT NULL,
  PRIMARY KEY (file_path, tag)
);

-- Wiki links table
CREATE TABLE IF NOT EXISTS links (
  source_path TEXT NOT NULL,
  target_slug TEXT NOT NULL,
  target_text TEXT
);
CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_slug);
```

## Note File Format (Markdown + YAML Frontmatter)

```yaml
---
title: Note Title
tags: [tag1, tag2]
created: 2026-02-27T10:30:00+09:00
modified: 2026-02-27T14:00:00+09:00
---
Markdown body with [[wikilinks]]
```

Source of truth: Markdown files on disk. SQLite is a rebuildable index (`qnote reindex`).
