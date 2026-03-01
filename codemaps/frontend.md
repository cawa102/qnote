# Frontend (TUI) Codemap

> Freshness: 2026-03-01 22:20 JST | Commit: 27c954a

## App Root

```
src/tui/App.tsx (292 lines)
├── Imports: all 8 screens, CenteredLayout, Footer, LayoutProvider
├── Creates: navStore (NavigationStore), inputModeStore (InputModeStore)
├── State: previewNote, noteListItems, noteListTitle
├── Renders: screen based on navStore.current().screen
└── handleAction: routes palette commands → NoteService calls → navStore.push()
    includes 'findFile' case → navStore.push('findFile')
    includes 'tagList' case → navStore.push('tagList')
```

## Screens (8)

| Screen | Lines | Input Mode | Key Features |
|--------|-------|------------|--------------|
| CommandPalette | 142 | navigation | Responsive icon grid with bold borders, shortcut keys 1-6 |
| FindFileScreen | 159 | text | Deferred border rendering (async load), Fuse.js fuzzy search, 100-item limit |
| NoteList | 205 | navigation | Up/down selection, Enter → preview, tag-filtered mode |
| NotePreview | 126 | navigation | Markdown render, wikilink jump 1-9, backlinks |
| SearchScreen | 125 | text | Debounced FTS5, stable hint line, no explicit height on border |
| CaptureScreen | 157 | text | Two-phase input (title → body), Tab → editor, CJK slug |
| EditorScreen | 734 | text | Multi-buffer, syntax highlight, file tree, preview, header editing, help panel |
| TagListScreen | 252 | text | Fuse.js fuzzy filter, Ctrl+R rename with inline TextInput |

## Components (8)

| Component | Lines | Purpose |
|-----------|-------|---------|
| Footer | 106 | Context-aware hint text with mode-specific shortcuts |
| CenteredLayout | 29 | Horizontal centering via LayoutContext |
| TitleBanner | 62 | ASCII art "Queen Note" with star field + gradient |
| BufferTabs | 159 | Open file tabs with scroll/ellipsis logic |
| EditorHeaderBar | 189 | File path, dirty marker, save status, inline title/tag editing |
| FileTree | 96 | Expandable directory tree navigation |
| HelpPanel | 62 | 2-column keybinding reference, toggled by Ctrl+/ |
| tag-navigation | 63 | Tag list navigation helpers for NotePreview |

## Hooks (6)

| Hook/Store | Lines | Type | API |
|------------|-------|------|-----|
| use-navigation | 57 | External store | push, pop, reset, current, subscribe |
| use-input-mode | 36 | External store | set('navigation'|'text'), current, subscribe |
| use-global-keys | 30 | React hook | Wraps dispatchGlobalKey with useInput |
| use-layout | 72 | React hook | columns, rows, contentWidth, showTitleArt |
| layout-context | 24 | React context | LayoutProvider + useLayoutContext |
| use-debounce | 43 | React hook + util | debounce(fn, ms), useDebounce(value, ms) |

## Editor Engine (8 files, ~1,802 lines)

```
Clipboard (13 lines) ─── Internal clipboard (copy/cut/paste text storage)

TextBuffer (838 lines) ─── Immutable line-based text editing
    │                      insert/delete/cursor/selection/undo/redo
    │                      Selection: anchor+head, getSelectedText, deleteSelection
    │                      Word movement: moveWordLeft/Right, selectWord
    │                      100-entry undo stack, preferred column tracking
    ▼
TextEditorController (279 lines) ─── Input routing + auto-indent
    │                                 Mac keybindings: Opt+Arrow (word), Opt+Shift (word sel)
    │                                 Clipboard: Opt+C/X/V, Formatting: Opt+B/I, Ctrl+K
    │                                 Markdown-aware Enter (list continuation)
    │                                 isDirty(), markClean()
    ▼
BufferManager (128 lines) ─── Multi-file editing
    │                         open/close/switch buffers, active tracking
    ▼
EditorScreen.tsx ─── Uses all below:
    ├── syntax-highlighter (98 lines) ─── Regex-based ANSI coloring for Markdown
    ├── renderer (301 lines) ─── Viewport scrolling, cursor positioning, selection highlighting
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

## EditorScreen Keybindings

```
Global (always active):
  \x1f (Ctrl+/) → toggle help panel (NOTE: outside key.ctrl block, Ink quirk)
  Ctrl+S        → save
  Ctrl+P        → toggle preview
  Ctrl+E        → 3-state file tree cycle
  Ctrl+{/}      → switch buffer
  Ctrl+W        → close buffer (dirty check)
  Ctrl+T/G      → focus title/tags header
  Esc           → back (with dirty confirm)

Editor focus (dispatched to TextEditorController):
  Arrow keys, Home/End, Opt+Arrow → navigation
  Shift+Arrow, Opt+Shift+Arrow   → selection
  Opt+A → select all
  Opt+C/X/V → clipboard (internal, not system)
  Ctrl+Z/Y → undo/redo
  Opt+B/I → bold/italic, Ctrl+K → link
```

## Utilities

| File | Lines | Exports |
|------|-------|---------|
| render-markdown.ts | 63 | numberWikiLinks(), renderMarkdown() |
| terminal.ts | 22 | restoreTerminal(), extractSlugFromPath() |
| title-art.ts | 136 | TITLE_ART, TITLE_WIDTH, colorizeTitle() |

## Import Graph (Screens → Dependencies)

```
CommandPalette → theme, format, layout-context, TitleBanner
FindFileScreen → theme, format, layout-context, debounce, file-scanner, Fuse, @inkjs/ui TextInput
NoteList       → theme, format, layout-context
NotePreview    → theme, format, layout-context, render-markdown, NoteService, tag-navigation
SearchScreen   → theme, format, layout-context, SearchIndex, debounce, @inkjs/ui TextInput
CaptureScreen  → theme, format, layout-context, NoteService, @inkjs/ui TextInput
EditorScreen   → editor/*, components/*, render-markdown, NoteService, HelpPanel
TagListScreen  → theme, format, layout-context, NoteService, Fuse, @inkjs/ui TextInput
```

## Known Ink Rendering Constraints

- **Bordered boxes + async re-render**: Ink's `log-update` differential terminal rendering
  can corrupt borders during async state changes. Workaround: defer border rendering until
  data is loaded (FindFileScreen pattern). See `docs/codex/2026-03-01-findfile-border-height-bug.md`.
- **ink-testing-library uses `debug: true`**: Bypasses `log-update` entirely, so terminal-specific
  rendering bugs cannot be reproduced in unit tests.
- **Ctrl+/ (\x1f) not recognized as ctrl key**: Ink's `parseKeypress` only sets `key.ctrl = true`
  for `\x01`-`\x1a` (Ctrl+A-Z). `\x1f` (Ctrl+/) must be checked via raw `input` outside the
  `key.ctrl` block.
