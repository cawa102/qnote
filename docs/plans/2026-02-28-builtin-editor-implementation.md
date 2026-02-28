# Built-in Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the $EDITOR delegation with a TUI-native Markdown editor featuring buffer tabs, file tree sidebar, header bar, syntax highlighting, and modern keybindings.

**Architecture:** The EditorScreen is the 6th screen added to the existing stack-based navigation. The editing area uses raw stdin + ANSI output (Ink hybrid), while chrome (tabs, header, footer, file tree) is rendered by Ink. A `TextBuffer` class manages text data immutably, and a `TextEditor` orchestrates input handling, undo/redo, and Markdown shortcuts.

**Tech Stack:** Ink 6 + React 19, chalk 5, gray-matter (frontmatter parsing), marked + marked-terminal (preview), existing theme system.

**Design doc:** `docs/plans/2026-02-28-builtin-editor-design.md`

---

## Task Dependency Graph

```
Task 1 (Types)
  ├─→ Task 2 (TextBuffer)
  │     └─→ Task 5 (TextEditor)
  │           └─→ Task 9 (EditorScreen)
  ├─→ Task 3 (SyntaxHighlighter)
  │     └─→ Task 9
  ├─→ Task 4 (Renderer)
  │     └─→ Task 9
  ├─→ Task 6 (BufferTabs)
  │     └─→ Task 9
  ├─→ Task 7 (EditorHeaderBar)
  │     └─→ Task 9
  └─→ Task 8 (FileTree)
        └─→ Task 9
                └─→ Task 10 (Navigation Integration)
                      ├─→ Task 11 (Remove $EDITOR)
                      ├─→ Task 12 (Update CaptureScreen)
                      └─→ Task 13 (Update NotePreview + CLI)
```

**Parallelizable groups:**
- Tasks 2, 3, 4, 6, 7, 8 can all run in parallel (after Task 1)
- Tasks 11, 12, 13 can all run in parallel (after Task 10)

---

- [ ] Task 1: Editor Types & Interfaces

**Files:**
- Modify: `src/types.ts`
- Create: `src/tui/editor/types.ts`
- Test: `test/tui/editor/types.test.ts`

**What:** Add `'editor'` to the `ScreenName` union type and define all editor-specific types in a dedicated module.

**Interface:**

```typescript
// Add to src/types.ts ScreenName union:
type ScreenName = 'palette' | 'noteList' | 'notePreview' | 'search' | 'capture' | 'editor'

// New file: src/tui/editor/types.ts
interface CursorPosition { readonly line: number; readonly col: number }
interface Selection { readonly anchor: CursorPosition; readonly head: CursorPosition }

interface TextBufferState {
  readonly lines: readonly string[]
  readonly cursor: CursorPosition
  readonly selection: Selection | null
}

interface UndoEntry {
  readonly before: TextBufferState
  readonly after: TextBufferState
}

interface BufferInfo {
  readonly id: string
  readonly filePath: string
  readonly title: string
  readonly dirty: boolean
}

interface EditorScreenParams {
  readonly filePath?: string       // Open existing note
  readonly showFileTree?: boolean  // Auto-show file tree (for "new" flow)
}

type EditorMode = 'edit' | 'preview'
type FocusArea = 'editor' | 'fileTree' | 'headerTitle' | 'headerTags'

interface FileTreeNode {
  readonly name: string
  readonly path: string
  readonly type: 'file' | 'directory'
  readonly children?: readonly FileTreeNode[]
  readonly expanded?: boolean
}
```

**Test scenarios:**
- Type exports are importable and usable
- CursorPosition, Selection, TextBufferState are readonly
- BufferInfo dirty flag reflects boolean

**Dependencies:** None (pure types)

**Commit:** `feat(editor): add editor types and interfaces`

---

- [ ] Task 2: TextBuffer — Core Text Data Management

**Files:**
- Create: `src/tui/editor/text-buffer.ts`
- Test: `test/tui/editor/text-buffer.test.ts`

**What:** Immutable text buffer class managing line array, cursor position, selection, and undo/redo stack. All operations return new state (no mutation). This is the data layer — no rendering, no input handling.

**Interface:**
- `TextBuffer.create(content: string): TextBuffer` — Factory from string content
- `getState(): TextBufferState` — Current lines, cursor, selection
- `getText(): string` — Join lines back to string
- `insertChar(char: string): TextBuffer` — Insert at cursor, return new buffer
- `insertNewline(): TextBuffer` — Split line at cursor
- `deleteBackward(): TextBuffer` — Backspace
- `deleteForward(): TextBuffer` — Delete key
- `deleteLine(): TextBuffer` — Delete entire current line (Ctrl+Shift+K)
- `moveCursor(direction: 'up' | 'down' | 'left' | 'right'): TextBuffer` — Arrow keys
- `moveCursorTo(pos: CursorPosition): TextBuffer` — Absolute positioning
- `moveToLineStart(): TextBuffer` — Home key
- `moveToLineEnd(): TextBuffer` — End key
- `moveWordLeft(): TextBuffer` — Ctrl+Left
- `moveWordRight(): TextBuffer` — Ctrl+Right
- `indent(): TextBuffer` — Add 2 spaces at line start (Tab)
- `unindent(): TextBuffer` — Remove up to 2 leading spaces (Shift+Tab)
- `wrapSelection(before: string, after: string): TextBuffer` — For bold/italic toggle
- `insertAt(pos: CursorPosition, text: string): TextBuffer` — Insert text at position
- `undo(): TextBuffer` — Pop undo stack
- `redo(): TextBuffer` — Pop redo stack
- `canUndo(): boolean`
- `canRedo(): boolean`
- `checkpoint(): TextBuffer` — Snapshot current state for undo (called before compound operations)

**Test scenarios:**
- Create from empty string produces one empty line
- Create from multi-line string splits on newlines
- Insert character at cursor updates line and advances cursor
- Insert newline splits line, cursor moves to next line start
- Backspace at line start joins with previous line
- Backspace at buffer start is no-op
- Delete at line end joins with next line
- Delete at buffer end is no-op
- Arrow key movement respects line boundaries
- Up/Down preserves preferred column (sticky column)
- Home/End move to line start/end
- Word movement jumps to word boundaries
- Ctrl+Left at line start moves to end of previous line
- Ctrl+Right at line end moves to start of next line
- Indent adds 2 spaces to current line start
- Unindent removes up to 2 leading spaces
- wrapSelection with `**` wraps cursor word or inserts empty markers
- Undo restores previous state
- Redo restores after undo
- Undo stack limit (100 entries)
- getText() returns joined lines with newlines
- CJK characters handled correctly (multi-byte aware)
- Delete line removes current line, cursor moves up if at end

**Dependencies:** `src/tui/editor/types.ts`

**Notes:**
- All methods return a **new TextBuffer instance** (immutability).
- Undo/redo operates on checkpointed states, not individual keystrokes.
- Word boundaries: `/\b/` for ASCII, character-class change for CJK.
- Use `string-width` (already in package.json) for display-width-aware column calculations.

**Commit:** `feat(editor): add TextBuffer with immutable text operations and undo/redo`

---

- [ ] Task 3: SyntaxHighlighter — Markdown Highlighting

**Files:**
- Create: `src/tui/editor/syntax-highlighter.ts`
- Test: `test/tui/editor/syntax-highlighter.test.ts`

**What:** Line-by-line Markdown syntax highlighter that applies chalk styles to source text. Operates on individual lines, returning styled strings for display. Uses the existing theme system from `src/theme/colors.ts`.

**Interface:**
- `highlightLine(line: string, theme: Theme): string` — Apply chalk styles to a single line
- `highlightLines(lines: readonly string[], theme: Theme): string[]` — Batch operation

**Highlight rules (applied per line):**
- `# Heading` → `theme.heading` (bold + accent) for entire line
- `## H2`, `### H3`, etc. → heading with decreasing intensity
- `**bold**` → `theme.bold` for text between markers, `theme.dim` for the `**` markers
- `*italic*` → italic style for text, `theme.dim` for `*` markers
- `` `inline code` `` → code style
- `- ` or `* ` list items → `theme.accent` for the bullet, normal for text
- `> ` blockquote → `theme.dim` for entire line
- `[[wikilink]]` → `theme.link` for target, `theme.dim` for brackets
- `---` horizontal rule → `theme.dim`
- Markdown symbols (`#`, `**`, `*`, `>`, `-`, `` ` ``) shown in dim

**Test scenarios:**
- Plain text returns unchanged (no chalk when no markdown)
- `# Heading` applies heading color to whole line
- `**bold**` applies bold style between markers
- `*italic*` applies italic style
- Inline code gets code styling
- List bullets get accent color
- Blockquote gets dim styling
- Wikilinks get link color
- Nested formatting (bold inside list) works
- Lines with no Markdown syntax pass through unchanged
- Empty line returns empty string

**Dependencies:** `src/theme/colors.ts` (Theme interface), `chalk`

**Notes:**
- Use regex-based line scanning (not a full Markdown parser).
- Handle overlapping patterns carefully (e.g., `**bold *and italic***`).
- For MVP, handle common cases well rather than all edge cases perfectly.
- Do NOT parse across line boundaries (each line is independent).

**Commit:** `feat(editor): add Markdown syntax highlighter`

---

- [ ] Task 4: Renderer — ANSI Output for Edit Area

**Files:**
- Create: `src/tui/editor/renderer.ts`
- Test: `test/tui/editor/renderer.test.ts`

**What:** Renders the text editor viewport to an ANSI string, handling scroll offset, line numbers, cursor positioning, soft wrapping, and composing highlighted lines into a fixed-size viewport. Does NOT write to stdout directly — returns rendered string for Ink integration.

**Interface:**
- `renderViewport(options: RenderOptions): RenderedOutput`

```typescript
interface RenderOptions {
  readonly lines: readonly string[]          // Raw source lines
  readonly highlightedLines: readonly string[] // Syntax-highlighted lines
  readonly cursor: CursorPosition
  readonly viewportHeight: number            // Available rows
  readonly viewportWidth: number             // Available columns
  readonly scrollOffset: number              // First visible line index
}

interface RenderedOutput {
  readonly content: string                   // ANSI string for viewport
  readonly scrollOffset: number              // Updated scroll offset (auto-scroll)
  readonly cursorScreenRow: number           // Cursor row relative to viewport
  readonly cursorScreenCol: number           // Cursor col in viewport
}
```

- `calculateScrollOffset(cursor: CursorPosition, currentOffset: number, viewportHeight: number): number` — Auto-scroll to keep cursor visible

**Test scenarios:**
- Viewport shorter than content shows only visible lines
- Cursor below viewport triggers scroll down
- Cursor above viewport triggers scroll up
- Empty buffer renders viewport height of empty lines
- Lines longer than viewport width are soft-wrapped
- Scroll offset respects buffer bounds (no negative, no past-end)
- Line numbers not shown (borderless design principle)
- Cursor on last line of viewport doesn't scroll unnecessarily
- CJK characters occupy correct display width in viewport

**Dependencies:** `src/tui/editor/types.ts`, `string-width`

**Notes:**
- Soft wrap: break lines at viewportWidth using display width (CJK = 2 columns).
- Keep scroll margin of 3 lines (cursor triggers scroll before hitting edge).
- Return rendered content as string (not written to stdout). EditorScreen will place it in the Ink layout.

**Commit:** `feat(editor): add viewport renderer with scroll and soft wrap`

---

- [ ] Task 5: TextEditor — Input Handling & Markdown Shortcuts

**Files:**
- Create: `src/tui/editor/text-editor.ts`
- Test: `test/tui/editor/text-editor.test.ts`

**What:** Orchestrates text editing by translating raw keyboard input into TextBuffer operations. Handles Markdown shortcuts (Ctrl+B bold, Ctrl+I italic, etc.), list continuation on Enter, and manages the checkpoint/undo boundary logic.

**Interface:**
- `TextEditorController.create(initialContent: string): TextEditorController`
- `handleInput(input: string, key: KeyInfo): TextEditorController` — Process keystroke, return new state
- `getBuffer(): TextBuffer` — Access current text buffer
- `getContent(): string` — Get text content as string
- `isDirty(): boolean` — Whether content changed since last markClean
- `markClean(): TextEditorController` — Reset dirty flag (after save)

```typescript
interface KeyInfo {
  readonly ctrl: boolean
  readonly shift: boolean
  readonly meta: boolean
  readonly name?: string    // 'return', 'backspace', 'delete', 'tab', 'up', 'down', 'left', 'right', 'home', 'end', 'escape'
}
```

**Input mapping:**
- Plain character → `buffer.insertChar()`
- Enter → list continuation check, then `buffer.insertNewline()`
- Backspace → `buffer.deleteBackward()`
- Delete → `buffer.deleteForward()`
- Arrow keys → `buffer.moveCursor()`
- Home/End → `buffer.moveToLineStart()` / `buffer.moveToLineEnd()`
- Ctrl+Left/Right → `buffer.moveWordLeft()` / `buffer.moveWordRight()`
- Tab → `buffer.indent()`
- Shift+Tab → `buffer.unindent()`
- Ctrl+B → `buffer.wrapSelection('**', '**')`
- Ctrl+I → `buffer.wrapSelection('*', '*')`
- Ctrl+K → insert `[](url)` template at cursor
- Ctrl+Shift+K → `buffer.deleteLine()`
- Ctrl+Z → `buffer.undo()`
- Ctrl+Y → `buffer.redo()`

**List continuation logic:**
- When Enter is pressed, check if current line starts with `- `, `* `, or numbered list `1. `
- If current line is a list item with content → insert new line with same prefix
- If current line is an empty list item (just `- `) → remove the prefix instead (end list)

**Test scenarios:**
- Plain character input calls insertChar
- Enter on list line `- hello` inserts `- ` on next line
- Enter on empty list line `- ` removes prefix and inserts empty line
- Ctrl+B wraps selection/word with `**`
- Ctrl+I wraps with `*`
- Ctrl+K inserts link template
- Ctrl+Z calls undo
- Ctrl+Y calls redo
- Ctrl+Shift+K deletes current line
- Tab indents, Shift+Tab unindents
- isDirty() returns true after edit, false after markClean
- Numbered list continuation increments number
- Key modifiers correctly distinguished (ctrl vs shift vs plain)

**Dependencies:** `src/tui/editor/text-buffer.ts`, `src/tui/editor/types.ts`

**Notes:**
- Checkpoint is created before each compound operation (markdown shortcut) for clean undo.
- The controller is immutable — each handleInput returns a new instance.
- `KeyInfo` matches Ink's `useInput` key parameter shape.

**Commit:** `feat(editor): add TextEditorController with Markdown shortcuts and list continuation`

---

- [ ] Task 6: BufferTabs Component

**Files:**
- Create: `src/tui/components/BufferTabs.tsx`
- Test: `test/tui/components/buffer-tabs.test.ts`

**What:** Ink component displaying horizontal tabs for open buffers. Shows buffer title with unsaved indicator. Active tab is highlighted.

**Interface:**
- `<BufferTabs buffers={BufferInfo[]} activeId={string} width={number} />`

**Rendering rules:**
- Each tab: `[title]` or `[title *]` if dirty (unsaved)
- Active tab: `theme.selected` (reverse video)
- Inactive tabs: `theme.dim`
- Tabs overflow: show `...` when tabs exceed width, prioritize active tab visibility
- `[+]` button at end (visual only, action handled by parent)

**Test scenarios:**
- Single buffer renders one tab
- Active buffer tab is highlighted
- Dirty buffer shows `*` indicator
- Multiple buffers render horizontally
- Overflow shows ellipsis
- Empty buffers array renders placeholder

**Dependencies:** `src/tui/editor/types.ts` (BufferInfo), `src/theme/colors.ts`, `ink`

**Commit:** `feat(editor): add BufferTabs component`

---

- [ ] Task 7: EditorHeaderBar Component

**Files:**
- Create: `src/tui/components/EditorHeaderBar.tsx`
- Test: `test/tui/components/editor-header-bar.test.ts`

**What:** Ink component showing editable Title and Tags fields with status indicator. Positioned below buffer tabs, above the edit area.

**Interface:**
- `<EditorHeaderBar title={string} tags={string[]} status={SaveStatus} mode={EditorMode} width={number} focused={FocusArea} onTitleChange={fn} onTagsChange={fn} onFocusEditor={fn} />`

```typescript
type SaveStatus = 'unsaved' | 'saved' | 'saving' | 'error'
```

**Rendering:**
- Line 1: `Title: {title}` — inline TextInput when focused='headerTitle'
- Line 2: `Tags:  [tag1] [tag2]` — chips, inline input when focused='headerTags' for adding
- Line 3: Separator `────────` (using `formatRuler()` from theme/format.ts)
- Right-aligned status: `[unsaved]` in warning color, `[saved]` in dim (fades), `[Edit]`/`[Preview]` mode indicator

**Test scenarios:**
- Title renders with label
- Tags render as chips with theme.tag color
- Unsaved status shows in warning color
- Saved status shows in dim
- Mode indicator shows current mode
- Width constrains content with truncation
- Empty tags renders just label
- Title focus enables TextInput

**Dependencies:** `src/tui/editor/types.ts`, `src/theme/colors.ts`, `src/theme/format.ts`, `ink`, `@inkjs/ui` (TextInput)

**Notes:**
- Title editing: When user presses Enter/Tab on title field, focus moves to editor body.
- Tag editing: Type tag name + Enter to add. Backspace on empty to delete last tag.
- Title change must trigger file rename (handled by EditorScreen, not this component).

**Commit:** `feat(editor): add EditorHeaderBar component with title and tags editing`

---

- [ ] Task 8: FileTree Component

**Files:**
- Create: `src/tui/components/FileTree.tsx`
- Create: `src/tui/editor/file-tree-builder.ts`
- Test: `test/tui/components/file-tree.test.ts`
- Test: `test/tui/editor/file-tree-builder.test.ts`

**What:** Ink component displaying a navigable directory tree of the notes directory. Supports expand/collapse, file selection, and CRUD operations (create file/folder, rename, delete).

**file-tree-builder.ts Interface:**
- `buildFileTree(notesDir: string): Promise<FileTreeNode>` — Scan directory, return tree structure
- `flattenTree(root: FileTreeNode): FileTreeNode[]` — Flatten visible nodes for rendering (respecting collapsed state)

**FileTree component Interface:**
- `<FileTree root={FileTreeNode} selectedPath={string} width={number} height={number} onSelect={fn} onCreateFile={fn} onCreateFolder={fn} onRename={fn} onDelete={fn} />`

**Rendering:**
- Tree indentation with `├─` and `└─` characters (or simple 2-space indent for borderless)
- Directories: name with `/` suffix, `▸` collapsed / `▾` expanded
- Files: plain name, `.md` extension hidden
- Selected item: `theme.selected` highlight
- Scroll when tree exceeds height

**Key handling (when tree is focused):**
- Up/Down: Move selection
- Enter: Open file (onSelect) or toggle directory expand/collapse
- Ctrl+N: Create new file in selected directory (prompt for name)
- Ctrl+Shift+N: Create new folder
- F2: Rename selected item
- Delete: Delete selected item (with confirmation)
- Right arrow: Expand directory / or return focus to editor
- Left arrow: Collapse directory / move to parent
- Esc: Return focus to editor

**Test scenarios:**
- buildFileTree returns correct structure for nested directories
- flattenTree shows only expanded children
- Collapsed directory hides children
- File selection calls onSelect with path
- Directory toggle changes expanded state
- Selected item is highlighted
- Scroll offset adjusts when selection exceeds viewport
- Empty directory renders empty tree
- Hidden files (dotfiles) are excluded
- Sort: directories first, then alphabetical

**Dependencies:** `src/tui/editor/types.ts` (FileTreeNode), `src/theme/colors.ts`, `ink`, `fs/promises`

**Notes:**
- Tree is rebuilt on file system changes (after save, create, delete, rename).
- Use `fs.readdir` with `withFileTypes` for efficient scanning.
- Only scan `.md` files (ignore non-markdown).
- Width: 25% of terminal, min 15, max 30 columns.

**Commit:** `feat(editor): add FileTree component with directory navigation and CRUD`

---

- [ ] Task 9: EditorScreen — Main Screen Component

**Files:**
- Create: `src/tui/screens/EditorScreen.tsx`
- Create: `src/tui/editor/buffer-manager.ts`
- Test: `test/tui/screens/editor-screen.test.ts`
- Test: `test/tui/editor/buffer-manager.test.ts`

**What:** The main editor screen composing all sub-components (BufferTabs, EditorHeaderBar, FileTree, edit area) into the full layout. Manages buffer state, focus areas, save operations, and preview toggle. This is the integration point.

**buffer-manager.ts Interface:**
- `BufferManager.create(): BufferManager`
- `openBuffer(filePath: string, content: string, meta: NoteMeta): BufferManager` — Open or focus existing
- `closeBuffer(id: string): BufferManager` — Close buffer (returns new manager)
- `getActive(): { id, filePath, editor: TextEditorController, meta: NoteMeta } | null`
- `setActive(id: string): BufferManager`
- `getBufferInfos(): readonly BufferInfo[]` — For BufferTabs
- `updateEditor(id: string, editor: TextEditorController): BufferManager`
- `nextBuffer(): BufferManager` — Ctrl+Right
- `prevBuffer(): BufferManager` — Ctrl+Left
- `hasUnsaved(): boolean` — Any buffer with dirty flag

**EditorScreen Interface:**
- `<EditorScreen noteService={NoteService} notesDir={string} initialFilePath?={string} showFileTree?={boolean} onBack={fn} />`

**Layout composition (Ink):**
```
<Box flexDirection="row" height="100%">
  {fileTreeVisible && <FileTree ... width={treeWidth} height={fullHeight} />}
  <Box flexDirection="column" flexGrow={1}>
    <BufferTabs ... />
    <EditorHeaderBar ... />
    <Box flexGrow={1}>  {/* Edit area or Preview */}
      {mode === 'edit' ? <EditArea ... /> : <PreviewArea ... />}
    </Box>
  </Box>
</Box>
<Footer hints={editorHints} />
```

**Key routing in EditorScreen:**
- Focus area determines which component receives keystrokes
- Global keys (Ctrl+S, Ctrl+P, Ctrl+E, Ctrl+W, Ctrl+Left/Right, Esc, `:`) always handled by EditorScreen
- When focus is 'editor': keystrokes go to TextEditorController
- When focus is 'fileTree': keystrokes go to FileTree
- When focus is 'headerTitle'/'headerTags': keystrokes go to EditorHeaderBar

**Save flow:**
1. Ctrl+S pressed
2. Get content from active buffer's TextEditorController
3. Build frontmatter from header bar state (title, tags, modified=now)
4. Write via NoteRepository (atomic write)
5. Update search index
6. Mark buffer clean
7. Update status to 'saved' (auto-clear after 2s)

**Preview toggle (Ctrl+P):**
- Switch mode between 'edit' and 'preview'
- Preview uses existing `marked` + `marked-terminal` rendering
- Header bar shows mode indicator

**Esc handling:**
- If any buffer is dirty: show confirmation `Save changes? [Y] Save [N] Discard [C] Cancel`
- If clean: pop navigation stack (back to previous screen)

**Test scenarios:**
- BufferManager opens and tracks multiple buffers
- BufferManager switches active buffer with next/prev
- Close buffer removes it, switches to adjacent
- EditorScreen renders all sub-components
- Ctrl+S triggers save flow
- Ctrl+P toggles preview mode
- Ctrl+E toggles file tree
- Esc with dirty buffer shows confirmation
- Esc with clean buffer pops navigation
- File tree selection opens note in new buffer
- `:` key opens command palette
- Focus routing sends keys to correct sub-component

**Dependencies:** All previous tasks (2-8), `src/core/note-service.ts`, `src/storage/note-repository.ts`, `src/tui/utils/render-markdown.ts`, `src/theme/`, `ink`

**Notes:**
- The EditArea renders the TextEditor output. For MVP, render highlighted lines as Ink `<Text>` elements. The ANSI renderer (Task 4) provides the content string.
- Input mode should be set to 'text' when EditorScreen mounts (prevents global shortcut conflicts).
- Buffer IDs: use filePath as ID (unique per open file).

**Commit:** `feat(editor): add EditorScreen with buffer management and full layout`

---

- [ ] Task 10: Navigation Integration

**Files:**
- Modify: `src/tui/App.tsx`
- Modify: `src/tui/hooks/key-dispatch.ts`
- Modify: `src/tui/components/Footer.tsx`
- Test: `test/tui/key-dispatch.test.ts` (update)
- Test: `test/tui/app.test.ts` (update if exists)

**What:** Wire EditorScreen into the existing navigation system. Update App.tsx to render EditorScreen for screen='editor'. Update key dispatch to handle the `e` key by pushing to editor screen instead of calling `onRequestEditor`. Update Footer with editor-specific hints.

**Changes to App.tsx:**
- Import EditorScreen
- Add `case 'editor':` in the screen rendering switch
- Pass `EditorScreenParams` from `currentEntry.params`
- In command palette action handlers: replace `handleEdit(filePath)` with `navStore.push('editor', { filePath })`
- For "new" action: `navStore.push('editor', { showFileTree: true })`
- Remove `onRequestEditor` prop and its usage

**Changes to key-dispatch.ts:**
- `e` key on notePreview: `navStore.push('editor', { filePath: currentFilePath })` instead of `onRequestEditor()`
- Remove `onRequestEditor` from `DispatchOptions`

**Changes to Footer.tsx:**
- Add editor screen hints: `Ctrl+S save  Ctrl+P preview  Ctrl+E tree  Esc back`

**Test scenarios:**
- `e` key on notePreview pushes 'editor' screen with filePath
- Command palette "new" pushes 'editor' with showFileTree=true
- Command palette "daily" pushes 'editor' with filePath
- EditorScreen renders when screen='editor'
- Esc on editor pops back to previous screen
- Footer shows correct hints for editor screen

**Dependencies:** Task 9 (EditorScreen), `src/types.ts` (updated ScreenName)

**Commit:** `feat(editor): integrate EditorScreen into navigation system`

---

- [ ] Task 11: Remove $EDITOR Delegation

**Files:**
- Delete: `src/tui/utils/resolve-editor.ts`
- Delete: `src/cli/resolve-editor.ts`
- Modify: `src/tui/utils/terminal.ts` (remove `spawnEditorSync`)
- Modify: `bin/qnote.ts` (remove editor restart loop)
- Delete: `test/tui/resolve-editor.test.ts` (if exists)
- Delete: `test/cli/resolve-editor.test.ts` (if exists)

**What:** Remove all $EDITOR-related code. The `bin/qnote.ts` entry point no longer needs the editor loop (TUI unmount → spawn editor → restart TUI). Simplify to a single TUI lifecycle.

**Changes to bin/qnote.ts:**
- Remove `editorFilePath` variable
- Remove `onRequestEditor` callback
- Remove the recursive `startTui` call after editor exit
- Simplify to: start TUI → wait for exit → cleanup

**Changes to terminal.ts:**
- Remove `spawnEditorSync()` function
- Remove `resolveEditor()` import
- Keep `restoreTerminal()` (still needed for crash recovery)

**Test scenarios:**
- bin/qnote.ts starts TUI without editor loop
- terminal.ts no longer exports spawnEditorSync
- resolve-editor.ts files no longer exist
- EditorNotFoundError type can optionally be removed from types.ts

**Dependencies:** Task 10 (all edit flows go through EditorScreen)

**Notes:**
- Also remove `EditorNotFoundError` from `src/types.ts` if no other code references it.
- Update any CLI command handlers (`qnote new`, `qnote daily`) that previously called `openInEditor()`.

**Commit:** `refactor: remove $EDITOR delegation in favor of built-in editor`

---

- [ ] Task 12: Update CaptureScreen

**Files:**
- Modify: `src/tui/screens/CaptureScreen.tsx`
- Modify: `test/tui/screens/capture-screen.test.ts` (if exists)

**What:** Change CaptureScreen's Tab key handler to navigate to EditorScreen instead of spawning $EDITOR. Remove the `onSpawnEditor` prop.

**Changes:**
- Tab handler: after creating note, call `navStore.push('editor', { filePath: note.filePath })` instead of `onSpawnEditor(note.filePath)`
- Remove `onSpawnEditor` prop from component interface
- Update Footer hint from `Tab $EDITOR` to `Tab edit`

**Test scenarios:**
- Tab key pushes 'editor' screen with new note's filePath
- Enter key still saves quick capture without editor
- No $EDITOR references remain in CaptureScreen

**Dependencies:** Task 10 (navigation integration)

**Commit:** `refactor: CaptureScreen Tab opens built-in editor`

---

- [ ] Task 13: Update NotePreview & CLI Commands

**Files:**
- Modify: `src/tui/screens/NotePreview.tsx`
- Modify: `src/cli/commands.ts`
- Modify: `test/tui/screens/note-preview.test.ts` (if exists)

**What:** Update NotePreview to use navigation instead of `onEdit` callback. Update CLI commands (`qnote new`, `qnote daily`) to launch TUI with EditorScreen instead of spawning $EDITOR.

**Changes to NotePreview.tsx:**
- `e` key handler: `navStore.push('editor', { filePath: note.filePath })` instead of `onEdit(note.filePath)`
- Remove `onEdit` prop

**Changes to commands.ts:**
- `qnote new [title]`: Create note, then launch TUI starting at editor screen with the new note
- `qnote daily`: Create/find daily note, then launch TUI starting at editor screen
- Remove `openInEditor()` function
- Remove import of `resolveEditor` / `spawnEditorSync`

**Test scenarios:**
- NotePreview `e` key pushes editor screen
- `qnote new` creates note and opens TUI editor
- `qnote daily` opens/creates daily note in TUI editor
- No $EDITOR references in commands.ts or NotePreview

**Dependencies:** Task 10 (navigation integration), Task 11 (editor removal)

**Notes:**
- CLI commands that previously spawned $EDITOR directly now need to start the TUI. This changes the behavior: `qnote new "title"` will open a fullscreen TUI editor instead of just the external editor.
- Consider whether `qnote new --no-edit` flag should be added to preserve the old "create file only" behavior. For MVP, launching the TUI editor is the only path.

**Commit:** `refactor: update NotePreview and CLI commands to use built-in editor`

---

## Implementation Priority

**Phase 1 — Foundation (Tasks 1-2):** Types + TextBuffer. These are pure logic with no UI dependencies.

**Phase 2 — Components (Tasks 3-8, parallelizable):** All visual components and the renderer. These can be built independently.

**Phase 3 — Integration (Task 9):** EditorScreen ties everything together.

**Phase 4 — Wiring (Tasks 10-13, partially parallelizable):** Connect to existing navigation and remove old code.
