# Backend (Core + Storage + CLI) Codemap

> Freshness: 2026-03-01 15:50 JST | Commit: 4fbdb90

## Core Layer

### NoteService (src/core/note-service.ts, 142 lines)

```
class NoteService:
  constructor(notesDir: string)  → init NoteRepository + SearchIndex

  CRUD:
    create(input)     → Note       # create file + index + parse wikilinks
    read(filePath)    → Note       # read from disk
    delete(filePath)  → void       # remove file + index

  Search:
    search(query)     → SearchHit[]    # FTS5 MATCH with snippet
    listRecent(limit) → SearchHit[]    # ORDER BY modified DESC
    listByTag(tag)    → SearchHit[]    # tag filter
    listTags()        → TagCount[]     # aggregate counts

  Links:
    getBacklinks(slug)       → BacklinkHit[]  # find sources linking to target
    resolveWikiLink(target)  → { filePath, title } | null

  Maintenance:
    reindex()         → number     # rebuild entire index from .md files
    getSearchIndex()  → SearchIndex
    close()           → void
```

### ConfigService (src/core/config-service.ts, 52 lines)

```
class ConfigService (static):
  load(configDir)               → QnoteConfig    # JSON with defaults
  save(configDir, partial)      → void           # merge + persist
  ensureDirectories(notesDir)   → void           # create .qnote/
  resolveNotesDir(notesDir)     → string         # expand ~/
```

**Default Config**: `{ notesDir: ~/notes, daily: daily/, capture: inbox/ }`

## Storage Layer

### NoteRepository (src/storage/note-repository.ts, 193 lines)

```
class NoteRepository:
  constructor(notesDir: string)

  create(input: CreateNoteInput) → Note      # slugify + collision handling + atomic write
  read(filePath)                 → Note      # parse frontmatter + content
  update(filePath, input)        → Note      # immutable update + atomic write
  listFiles(dir?)                → string[]  # recursive .md scan
  delete(filePath)               → void      # unlink

  Private:
    slugify(title)       → CJK-aware slug (Unicode property escapes)
    resolveCollision()   → numeric suffix or UUID fallback
    atomicWrite()        → temp file → rename()
```

### SearchIndex (src/storage/search-index.ts, 329 lines)

```
class SearchIndex:
  constructor(dbPath: string)

  Schema:
    notes     (file_path PK, title, content, created, modified)
    notes_fts (FTS5 trigram virtual table → title, content)
    note_tags (file_path, tag) → junction table
    links     (source_path, target_slug, target_text)
    Triggers  → auto-sync notes ↔ notes_fts on INSERT/UPDATE/DELETE

  API:
    upsert(entry)                → void          # INSERT OR REPLACE + tags (transactional)
    remove(filePath)             → void          # DELETE cascade
    search(query)                → SearchHit[]   # FTS5 MATCH + snippet()
    listByTag(tag)               → SearchHit[]   # JOIN note_tags
    listTags()                   → TagCount[]    # GROUP BY tag
    listRecent(limit?)           → SearchHit[]   # ORDER BY modified DESC
    upsertLinks(source, links)   → void          # Store wiki links
    getBacklinks(targetSlug)     → BacklinkHit[] # Reverse link lookup
    shouldSearch(query)          → boolean       # ≥3 chars for all scripts
    close()                      → void

  Private:
    sanitizeQuery()  → strip FTS special chars (^, *, ", OR, AND, NEAR, NOT)
    CJK detection    → regex for Han/Hiragana/Katakana/Hangul
```

### File Scanner (src/storage/file-scanner.ts, 117 lines)

```
scanNoteFiles(notesDir, options?) → ScannedFile[]
  - Recursive .md file discovery
  - Symlink protection: realpath + rootPrefix startsWith check
  - Default excludeDirs: ['.git', '.qnote', 'node_modules']
  - Skips dot-prefixed hidden directories
  - Permission error tolerance (skip unreadable dirs)
  - Results sorted by relativePath (localeCompare)

ScannedFile { relativePath, absolutePath }
ScanOptions { excludeDirs?: string[] }

// NOTE: Shares traversal logic with file-tree-builder.ts
// P1: Extract shared walker to src/storage/fs-scanner.ts
```

### Frontmatter (src/storage/frontmatter.ts, 93 lines)

```
parseFrontmatter(raw: string)                → ParsedNote
serializeFrontmatter(meta, content)          → string (YAML + markdown)

Features:
  - gray-matter + js-yaml (JSON_SCHEMA preserves timestamps)
  - Graceful degradation for malformed YAML
  - Extracts title from first # Heading if frontmatter missing
```

### Link Parser (src/storage/link-parser.ts, 61 lines)

```
extractWikiLinks(content: string) → WikiLink[]
  - Parses [[target]] and [[target|display]] syntax
  - maskCodeRegions() hides code blocks before regex
  - Returns: { target, displayText, position }
```

## CLI Layer

### Commands (src/cli/commands.ts, 161 lines)

```
createCommands(notesDir, configDir?) → CommandHandlers:
  newNote(title?)         # create + print path
  search(query, {tag?})   # FTS with optional tag filter
  list({tag?, sort?, format?})  # JSON or text output
  daily()                 # create today's daily note
  capture(text)           # quick-capture to inbox
  tags()                  # list all tags with counts
  init(path?)             # initialize directory + index existing
  reindex()               # rebuild index from all .md files

All commands: NoteService lifecycle (create → use → close in finally)
```

## Entry Point (bin/qnote.ts, 150 lines)

```
Program setup:
  commander.js → 8 subcommands
  Default action → fullscreen TUI (withFullScreen(App))

startTui(notesDir):
  - Signal handlers (SIGINT, SIGTERM, uncaughtException)
  - restoreTerminal() cleanup
  - Ink render with NoteService + SearchIndex + ConfigService
```

## Dependencies Between Layers

```
CLI Layer
  └── Core Layer (NoteService, ConfigService)
       └── Storage Layer (NoteRepository, SearchIndex, frontmatter, link-parser)

TUI Layer
  ├── Core Layer (NoteService) ─── most screens
  └── Storage Layer (file-scanner) ─── FindFileScreen (direct fs access, no NoteService)
```
