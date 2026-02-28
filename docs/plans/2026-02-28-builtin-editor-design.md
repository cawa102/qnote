# Built-in Editor Design

Date: 2026-02-28

## Problem

The current editing experience delegates to `$EDITOR`, which defaults to vim/vi. This is hostile to general users:

- Raw YAML frontmatter is visible and editable
- Vim's interface is confusing for non-vim users
- TUI exits and restarts for each edit session

## Decision Summary

| Decision | Choice |
|---|---|
| Editor type | TUI built-in editor (replaces $EDITOR entirely) |
| Frontmatter | Header bar (Title + Tags editable, separated from body) |
| Editing features | Rich editor (syntax highlighting + Markdown shortcuts) |
| $EDITOR integration | Completely removed |
| CaptureScreen | Kept (Tab opens built-in editor instead of $EDITOR) |
| Key bindings | Modern editor style (VS Code / Google Docs) |
| Save behavior | Manual save only (Ctrl+S, Esc with confirm dialog) |
| Preview | Toggle with Ctrl+P (not side-by-side) |
| File tree | Left sidebar, toggle with Ctrl+E (default: hidden) |
| Buffer tabs | Multiple notes open simultaneously |
| Scope | EditorScreen only (existing 5 screens maintained) |

## Layout

EditorScreen is the 6th screen, added to the existing navigation stack.

### Full Layout (file tree visible)

```
+----------+------------------------------------------------+
| notes/   |  [today-memo] [daily-2026-02-28] [+]           | <- Buffer tabs
|  daily/  +------------------------------------------------+
|  inbox/  |  Title: Today's Memo                           | <- Header bar
|  memo.md |  Tags:  [inbox] [daily]            [unsaved]   |
|  diary.md|  ------------------------------------------------|
|          |  # Heading                                      | <- Edit area
|          |  **bold** text                                  |   (or Preview)
|          |  - list item                                    |
|          |  > quote                                        |
|          |  [[wikilink]]                                   |
|          |                                                 |
+----------+-------------------------------------------------+
|  Ctrl+S save  Ctrl+P preview  Ctrl+Right/Left buffer      | <- Footer
+------------------------------------------------------------+
```

### Collapsed Layout (file tree hidden, default)

```
+------------------------------------------------------------+
|  [today-memo] [daily-2026-02-28] [+]                       | <- Buffer tabs
+------------------------------------------------------------+
|  Title: Today's Memo                           [unsaved]   | <- Header bar
|  Tags:  [inbox] [daily]                                    |
|------------------------------------------------------------|
|  # Heading                                                  | <- Edit area
|  **bold** text                                              |
|  - list item                                                |
|  > quote                                                    |
|                                                              |
+------------------------------------------------------------+
|  Ctrl+S save  Ctrl+P preview  Ctrl+E tree                  | <- Footer
+------------------------------------------------------------+
```

### Key Layout Rules

- File tree spans full height (top to footer) when visible
- Buffer tabs appear only in the right (editor) portion
- File tree width: 25% of terminal width (min 15 cols, max 30 cols)
- Narrow terminal fallback: file tree auto-hides below 60 columns

## Editor Features

### Text Editing

- Multi-line text input with cursor movement (arrows, Home/End, Ctrl+arrows for word-level)
- Soft word wrapping
- Auto-scroll when content exceeds editor area
- Undo/Redo stack (Ctrl+Z / Ctrl+Y)

### Markdown Rich Editing Shortcuts

| Shortcut | Action | Inserted text |
|---|---|---|
| Ctrl+B | Bold toggle | `**selection**` |
| Ctrl+I | Italic toggle | `*selection*` |
| Ctrl+K | Insert link | `[selection](url)` |
| Tab | Indent | 2 spaces at line start |
| Shift+Tab | Unindent | Remove leading spaces |
| Ctrl+Shift+K | Delete line | |
| Enter (in list) | Continue list | Auto-insert `- ` |

### Syntax Highlighting (While Editing)

- `# Heading` -> heading color (theme)
- `**bold**` -> bold display
- `*italic*` -> italic display
- `- list` -> bullet color
- `> quote` -> gray + left bar
- `` `code` `` -> code color
- `[[wikilink]]` -> link color
- Markdown symbols (`**`, `#`, etc.) shown in muted color

### Preview Toggle (Ctrl+P)

Replaces the entire edit area with rendered Markdown. Press Ctrl+P again to return to editing. Header bar shows mode indicator: `[Edit]` or `[Preview]`.

## File Tree

- Toggle with Ctrl+E (default: hidden)
- Directory tree display of notes/ directory
- Arrow keys to navigate, Enter to open file (new buffer)
- Directory expand/collapse
- While file tree has focus, editor keybindings are disabled
- Esc or Right arrow returns focus to editor

### File Tree Operations

| Shortcut | Action |
|---|---|
| Ctrl+N | Create new file in selected directory |
| Ctrl+Shift+N | Create new folder |
| F2 | Rename file/folder |
| Delete | Delete file/folder (with confirmation) |

## Buffer Management

| Shortcut | Action |
|---|---|
| Ctrl+Right | Switch to next buffer |
| Ctrl+Left | Switch to previous buffer |
| Ctrl+W | Close current buffer (confirm if unsaved) |
| Ctrl+N | Create new note (opens in new buffer) |
| Ctrl+O | Open file (also available from file tree) |

Selecting a file in the file tree adds it as a new buffer tab. If already open, focus moves to that buffer.

## Full Keyboard Shortcut Reference

| Category | Shortcut | Action |
|---|---|---|
| **File** | Ctrl+S | Save |
| | Ctrl+N | New note (in file tree) |
| | Ctrl+Shift+N | New folder (in file tree) |
| | Ctrl+W | Close buffer |
| | Ctrl+O | Open file |
| **Edit** | Ctrl+Z | Undo |
| | Ctrl+Y | Redo |
| | Ctrl+B | **Bold** toggle |
| | Ctrl+I | *Italic* toggle |
| | Ctrl+K | Insert link |
| | Ctrl+Shift+K | Delete line |
| | Tab / Shift+Tab | Indent / Unindent |
| **Navigation** | Ctrl+Left/Right | Buffer switch |
| | Ctrl+E | File tree toggle |
| | Ctrl+P | Preview toggle |
| | Ctrl+F | In-editor search |
| | Esc | Back (confirm if unsaved) |
| | `:` | Command palette |

## Navigation Flow

### Startup

```
qnote (TUI launch)
  -> CommandPalette (home screen, unchanged)
  -> User selects action:
    - "new"   -> EditorScreen (file tree auto-shown, focus on tree)
    - "daily" -> EditorScreen (opens today's daily note)
    - note selection -> EditorScreen (opens selected note)
```

### New Note Creation Flow

```
CommandPalette -> "new"
  -> EditorScreen opens (file tree auto-visible)
  -> File tree has focus
  -> User navigates to desired directory
  -> Ctrl+N to create new file
  -> Enter title -> editing begins
```

### From NotePreview

- Before: `e` key -> $EDITOR -> TUI restart
- After: `e` key -> Navigate to EditorScreen (push to stack)
- Esc returns to NotePreview

### From CaptureScreen

- Enter -> Quick save (title only), unchanged
- Tab -> Navigate to EditorScreen (instead of $EDITOR)

### Command Palette

- Existing screens maintained (CommandPalette, NoteList, NotePreview, Search, Capture)
- EditorScreen added as 6th screen
- Command palette accessible from editor via `:` key

### Search

- In-editor search: Ctrl+F for incremental search within editor area
- Full-note search: Existing SearchScreen maintained

## Header Bar Details

- **Title line**: `Title: ` label + inline editable text. Tab/Enter moves focus to body
- **Tags line**: `Tags: ` label + chip display `[inbox] [daily]`. Add/remove tags here
- Separator line below header (`────`)
- Title change triggers automatic file rename (slug regeneration)

### Status Display (right side of header bar)

- Unsaved changes: `[unsaved]`
- Saved: `[saved]` (fades after 2 seconds)
- Mode: `[Edit]` or `[Preview]`

## Save Behavior

- Manual save only (Ctrl+S)
- Status bar shows `[unsaved]` when changes exist
- Ctrl+S -> write frontmatter + body to file (atomic: temp -> rename)
- Auto-update `modified` timestamp on save
- Rebuild search index on save
- Esc with unsaved changes: `Save changes? [Y] Save  [N] Discard  [C] Cancel`

## Technical Implementation

### Approach: Ink Hybrid

The text editing area uses **raw stdin + direct ANSI output** rather than Ink's React rendering:

1. **EditorScreen (Ink component)** — Layout frame (buffer tabs, header bar, footer, file tree) rendered by Ink
2. **TextEditor (custom module)** — Editing area uses custom text buffer management + cursor control. Receives raw input via Ink's `useStdin`, renders via ANSI escape sequences
3. **Bridge** — TextEditor state changes sync to React state for header bar status updates, buffer tab unsaved indicators, etc.

### Module Structure

```
src/tui/
  screens/EditorScreen.tsx       — Full screen layout (Ink)
  editor/
    TextBuffer.ts                — Text data management (line array, cursor pos, selection)
    TextEditor.ts                — Input handling, Undo/Redo, Markdown shortcuts
    SyntaxHighlighter.ts         — Markdown syntax highlighting
    Renderer.ts                  — ANSI output for edit area rendering
  components/
    BufferTabs.tsx               — Buffer tabs (Ink)
    FileTree.tsx                 — File tree (Ink)
    EditorHeaderBar.tsx          — Header bar (Ink)
```

## Code Removals

- `src/tui/utils/resolve-editor.ts` -> delete
- `src/cli/resolve-editor.ts` -> delete
- `spawnEditorSync()` in `src/tui/utils/terminal.ts` -> delete
- `bin/qnote.ts` `onRequestEditor` / TUI restart logic -> delete
- `NotePreview.tsx` `e` key -> change to EditorScreen navigation
- `CaptureScreen.tsx` Tab -> change to EditorScreen transition
- CLI `qnote new`, `qnote daily` -> change to open TUI EditorScreen

## Error Handling

- File save failure -> Error displayed in status bar, content preserved in buffer
- File changed externally -> Reload confirmation dialog
- Esc with unsaved changes -> `Save changes? [Y] Save  [N] Discard  [C] Cancel`
