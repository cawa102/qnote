# Architecture Codemap

> Freshness: 2026-03-01 22:20 JST | Commit: 27c954a

## Layer Overview (~6,958 lines)

```
bin/qnote.ts ─── CLI Entry Point (commander.js)
     │
     ├── src/cli/commands.ts ─── 8 subcommands
     │
     ├── src/tui/App.tsx ─── Ink 5 + React 18 TUI root
     │   ├── 8 screens (palette, noteList, notePreview, findFile, search, capture, editor, tagList)
     │   ├── 8 components (Footer, CenteredLayout, TitleBanner, BufferTabs, EditorHeaderBar, FileTree, HelpPanel, tag-navigation)
     │   ├── 6 hooks (navigation, input-mode, global-keys, layout, layout-context, debounce)
     │   └── editor engine (text-buffer, text-editor, buffer-manager, clipboard, syntax, renderer, file-tree)
     │
     ├── src/core/ ─── Business Logic
     │   ├── NoteService (CRUD, search, backlinks, reindex, renameTag)
     │   └── ConfigService (load/save config.json)
     │
     ├── src/storage/ ─── Persistence
     │   ├── NoteRepository (Markdown + YAML frontmatter, atomic writes)
     │   ├── SearchIndex (better-sqlite3 FTS5 trigram)
     │   ├── file-scanner.ts (recursive .md file discovery with symlink protection)
     │   ├── frontmatter.ts (gray-matter parse/serialize)
     │   └── link-parser.ts (extract [[wikilinks]])
     │
     └── src/theme/ ─── Semantic Colors + Formatting
         ├── colors.ts (True Color + ANSI fallback, selectionBg)
         ├── format.ts (tags, dates, rulers, indicators, palette grid layout)
         └── relative-time.ts (Japanese relative time)
```

## Data Flow

```
Keyboard → key-dispatch.ts → NavigationStore (stack)
                                    │
                              Screen renders
                             ┌──────┼──────────┐
                     NoteService  SearchIndex  BufferManager
                         │            │            │
                   NoteRepository  SQLite FTS5  TextBuffer (immutable)
                         │                          │
                   Markdown files              Clipboard (internal)
                   (source of truth)

FindFileScreen flow (no NoteService dependency):
  scanNoteFiles() → fs/promises → fuse.js fuzzy filter → nav.push('editor')
  NOTE: Border deferred until async load completes (Ink log-update workaround)

Editor input flow:
  useInput → \x1f check (Ctrl+/) → key.ctrl block → key.escape → focus dispatch
  focus=editor → TextEditorController.handleInput() → TextBuffer (immutable)
  focus=fileTree → handleTreeKey() → tree state update
```

## Key Patterns

| Pattern | Where | Purpose |
|---------|-------|---------|
| Pub/Sub Store | use-navigation, use-input-mode | Global state without Redux |
| Immutable Updates | TextBuffer, BufferManager, Clipboard | All state returns new objects |
| Discriminated Union | ScreenEntry in types.ts | Type-safe screen navigation |
| Atomic File Writes | NoteRepository | temp → rename() for safety |
| Factory Functions | createNavigationStore, TextBuffer.create | Encapsulated construction |
| Pure Functions | key-dispatch, renderer, syntax-highlighter, buildDisplayEntries | Testable, no side effects |
| Symlink Protection | file-scanner, file-tree-builder | realpath + rootPrefix check |
| Deferred Rendering | FindFileScreen | Border rendered only after async load to avoid Ink diff corruption |
| Non-modal Overlay | HelpPanel in EditorScreen | Reduces viewport height without stealing focus |

## Screen Navigation (Stack-Based)

```
ScreenName = 'palette' | 'noteList' | 'notePreview' | 'findFile' | 'search' | 'capture' | 'editor' | 'tagList'

palette (home) ──→ noteList ──→ notePreview ──→ editor
      │                              │
      ├──→ findFile ──→ editor       └──→ editor
      ├──→ search ──→ notePreview
      ├──→ capture
      ├──→ editor (new/daily)
      └──→ tagList ──→ noteList (filtered by tag)

Esc = pop stack | ':' = push palette | '/' = push search
```

## Input Mode System

```
'navigation' mode: single-key shortcuts active (q, /, :, n, e, 1-9)
'text' mode:       only Esc + Ctrl combos + arrow keys active

Screens set mode on mount, restore on unmount:
  CommandPalette → 'navigation' (grid selection, shortcut keys)
  FindFileScreen → 'text' (TextInput for file search)
  SearchScreen   → 'text' (TextInput for query)
  CaptureScreen  → 'text' (TextInput for title)
  EditorScreen   → 'text' (full editor input)
  TagListScreen  → 'text' (TextInput for fuzzy filter)
  NoteList       → 'navigation' (default)
  NotePreview    → 'navigation' (default)
```

## File Count by Layer

| Layer | Files | Lines | Key Technologies |
|-------|-------|-------|-----------------|
| TUI | 34 | ~5,257 | Ink 5, React 18, @inkjs/ui, fuse.js |
| Storage | 6 | ~809 | better-sqlite3, FTS5, gray-matter, fs/promises |
| Core | 3 | ~250 | NoteService, ConfigService |
| Theme | 4 | ~128 | chalk |
| CLI | 2 | ~162 | commander.js |
| Types | 1 | ~202 | TypeScript types + error hierarchy |
| Entry | 1 | ~150 | commander + Ink fullscreen |
| **Total** | **51** | **~6,958** | |
