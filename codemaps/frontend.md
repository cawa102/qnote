# Frontend (TUI) Codemap

> Freshness: 2026-03-01 15:50 JST | Commit: 4fbdb90

## App Root

```
src/tui/App.tsx (257 lines)
├── Imports: all 7 screens, CenteredLayout, Footer, LayoutProvider
├── Creates: navStore (NavigationStore), inputModeStore (InputModeStore)
├── State: previewNote, noteListItems, noteListTitle
├── Renders: screen based on navStore.current().screen
└── handleAction: routes palette commands → NoteService calls → navStore.push()
    includes 'findFile' case → navStore.push('findFile')
```

## Screens (7)

| Screen | Lines | Input Mode | Key Features |
|--------|-------|------------|--------------|
| CommandPalette | 142 | navigation | Responsive icon grid with bold borders, shortcut keys 1-6 |
| FindFileScreen | 159 | text | Deferred border rendering (async load), Fuse.js fuzzy search, 100-item limit |
| NoteList | 74 | navigation | Up/down selection, Enter → preview |
| NotePreview | 126 | navigation | Markdown render, wikilink jump 1-9, backlinks |
| SearchScreen | 120 | text | Debounced FTS5, stable hint line, no explicit height on border |
| CaptureScreen | 157 | text | Two-phase input (title → body), Tab → editor, CJK slug |
| EditorScreen | 705 | text | Multi-buffer, syntax highlight, file tree, preview, header editing |

## Components (7)

| Component | Lines | Purpose |
|-----------|-------|---------|
| Footer | 92 | Context-aware hint text with mode-specific shortcuts |
| CenteredLayout | 29 | Horizontal centering via LayoutContext |
| TitleBanner | 62 | ASCII art "Queen Note" with 3D block shadow |
| BufferTabs | 159 | Open file tabs with scroll/ellipsis logic |
| EditorHeaderBar | 189 | File path, dirty marker, save status, inline title/tag editing |
| FileTree | 96 | Expandable directory tree navigation |
| tag-navigation | 63 | Tag list navigation helpers for NotePreview |

## Hooks (6)

| Hook/Store | Lines | Type | API |
|------------|-------|------|-----|
| use-navigation | 57 | External store | push, pop, reset, current, subscribe |
| use-input-mode | 37 | External store | set('navigation'|'text'), current, subscribe |
| use-global-keys | 31 | React hook | Wraps dispatchGlobalKey with useInput |
| use-layout | 73 | React hook | columns, rows, contentWidth, showTitleArt |
| layout-context | 25 | React context | LayoutProvider + useLayoutContext |
| use-debounce | 44 | React hook + util | debounce(fn, ms), useDebounce(value, ms) |

## Editor Engine (6 files, ~1,267 lines)

```
TextBuffer (496 lines) ─── Immutable line-based text editing
    │                      insert/delete/cursor/selection/undo/redo
    │                      100-entry undo stack, preferred column tracking
    ▼
TextEditorController (181 lines) ─── Input routing + auto-indent
    │                                 Markdown-aware Enter (list continuation)
    │                                 isDirty(), markClean()
    ▼
BufferManager (128 lines) ─── Multi-file editing
    │                         open/close/switch buffers, active tracking
    ▼
EditorScreen.tsx ─── Uses all below:
    ├── syntax-highlighter (98 lines) ─── Regex-based ANSI coloring for Markdown
    ├── renderer (138 lines) ─── Viewport scrolling, cursor positioning
    └── file-tree-builder (99 lines) ─── Recursive .md directory scan
```

## Key Dispatch (key-dispatch.ts, 77 lines)

```
dispatchGlobalKey(input, key, options):
  navigation mode:
    Esc    → pop / exit
    q      → exit
    :      → push palette
    /      → push search
    n      → push palette (new note shortcut)
    e      → push editor (from notePreview)
  text mode:
    Esc    → pop / exit
    (all other keys pass through to TextInput/editor)
```

## Utilities

| File | Lines | Exports |
|------|-------|---------|
| render-markdown.ts | 63 | numberWikiLinks(), renderMarkdown() |
| terminal.ts | 23 | restoreTerminal(), extractSlugFromPath() |
| title-art.ts | 38 | TITLE_ART, TITLE_WIDTH, colorizeTitle() |

## Import Graph (Screens → Dependencies)

```
CommandPalette → theme, format, layout-context, TitleBanner
FindFileScreen → theme, format, layout-context, debounce, file-scanner, Fuse, @inkjs/ui TextInput
NoteList       → theme, format, layout-context
NotePreview    → theme, format, layout-context, render-markdown, NoteService, tag-navigation
SearchScreen   → theme, format, layout-context, SearchIndex, debounce, @inkjs/ui TextInput
CaptureScreen  → theme, format, layout-context, NoteService, @inkjs/ui TextInput
EditorScreen   → editor/*, components/*, render-markdown, NoteService
```

## Known Ink Rendering Constraints

- **Bordered boxes + async re-render**: Ink's `log-update` differential terminal rendering
  can corrupt borders during async state changes. Workaround: defer border rendering until
  data is loaded (FindFileScreen pattern). See `docs/codex/2026-03-01-findfile-border-height-bug.md`.
- **ink-testing-library uses `debug: true`**: Bypasses `log-update` entirely, so terminal-specific
  rendering bugs cannot be reproduced in unit tests.
