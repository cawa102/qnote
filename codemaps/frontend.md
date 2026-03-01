# Frontend (TUI) Codemap

> Freshness: 2026-02-28 21:30 JST | Commit: a02370b

## App Root

```
src/tui/App.tsx (248 lines)
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
| CommandPalette | 106 | text | Fuse.js fuzzy search, useCallback onChange fix |
| FindFileScreen | 149 | text | Fuse.js fuzzy file name search, 100-item limit, loading state |
| NoteList | 74 | navigation | Up/down selection, Enter → preview |
| NotePreview | 126 | navigation | Markdown render, wikilink jump 1-9, backlinks |
| SearchScreen | 123 | text | Debounced FTS5, CJK 3-char hint |
| CaptureScreen | 136 | text | Title input, Tab → editor, CJK slug |
| EditorScreen | 499 | text | Multi-buffer, syntax highlight, file tree, preview |

## Components (6)

| Component | Lines | Purpose |
|-----------|-------|---------|
| Footer | 30 | Screen-specific hint text (Record<ScreenName, string>) |
| CenteredLayout | 30 | Horizontal centering via LayoutContext |
| TitleBanner | 61 | ASCII art "Queen Note" with 3D block shadow |
| BufferTabs | 159 | Open file tabs with scroll/ellipsis logic |
| EditorHeaderBar | 123 | File path, dirty marker, save status |
| FileTree | 91 | Expandable directory tree navigation |

## Hooks (6)

| Hook/Store | Lines | Type | API |
|------------|-------|------|-----|
| use-navigation | 57 | External store | push, pop, reset, current, subscribe |
| use-input-mode | 37 | External store | set('navigation'|'text'), current, subscribe |
| use-global-keys | 31 | React hook | Wraps dispatchGlobalKey with useInput |
| use-layout | 73 | React hook | columns, rows, contentWidth, showTitleArt |
| layout-context | 25 | React context | LayoutProvider + useLayoutContext |
| use-debounce | 44 | React hook + util | debounce(fn, ms), useDebounce(value, ms) |

## Editor Engine (6 files, ~1,108 lines)

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

## Key Dispatch (key-dispatch.ts, 70 lines)

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
CommandPalette → theme, format, layout-context, TitleBanner, Fuse, @inkjs/ui TextInput
FindFileScreen → theme, format, layout-context, debounce, file-scanner, Fuse, @inkjs/ui TextInput
NoteList       → theme, format, layout-context
NotePreview    → theme, format, layout-context, render-markdown, NoteService
SearchScreen   → theme, format, layout-context, SearchIndex, debounce, @inkjs/ui TextInput
CaptureScreen  → theme, format, layout-context, NoteService, @inkjs/ui TextInput
EditorScreen   → editor/*, components/*, render-markdown, NoteService
```
