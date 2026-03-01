# Standard Text Editing Keybindings — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add standard text editing keybindings (Shift+Arrow selection, Cmd+Arrow line navigation, Ctrl+C/X/V clipboard, word deletion) to the built-in editor so non-vim users can edit text with familiar OS-native shortcuts.

**Architecture:** Extend the existing immutable `TextBuffer` with selection-aware movement/deletion methods, add a standalone clipboard module, update `TextEditorController` dispatch to handle Shift/Meta/Ctrl+Shift modifier combos, and extend the renderer to paint selection highlighting with a themed background color.

**Tech Stack:** TypeScript, Ink 5 (useInput), chalk (ANSI colors), Vitest

---

## Known Conflict: Ctrl+Arrow Buffer Switching

`EditorScreen.tsx:479-484` intercepts `Ctrl+Left/Right` for buffer switching via `handleCtrlArrow()`. This prevents `Ctrl+Left/Right` from reaching `TextEditorController` for word navigation (which is the standard OS keybinding).

**Resolution (in Task 4):** Remap buffer switching from `Ctrl+Left/Right` to `Ctrl+Shift+[` / `Ctrl+Shift+]`. This frees `Ctrl+Left/Right` for word navigation, matching standard editor behavior. `Ctrl+Shift+[/]` is used in VS Code for this purpose.

---

- [ ] Task 1: Internal Clipboard Module

**Files:**
- Create: `src/tui/editor/clipboard.ts`
- Test: `test/tui/editor/clipboard.test.ts`

**What:** A simple module-scoped string buffer for copy/cut/paste operations within the editor. Decoupled from TextBuffer — only TextEditorController uses it.

**Interface:**
- `getClipboard(): string` — returns current clipboard content (empty string initially)
- `setClipboard(text: string): void` — overwrites clipboard content

**Test scenarios:**
- Initial clipboard is empty string
- setClipboard stores text, getClipboard retrieves it
- setClipboard overwrites previous content
- Empty string is a valid clipboard value

**Dependencies:** None

**Commit:** `feat(editor): add internal clipboard module`

---

- [ ] Task 2: TextBuffer Selection Movement Methods

**Files:**
- Modify: `src/tui/editor/text-buffer.ts`
- Modify: `test/tui/editor/text-buffer.test.ts`

**What:** Add selection-extending movement methods that use the existing `selectTo()` internally. Also add document-level movement (`moveToDocStart/End`), word deletion (`deleteWordBackward/Forward`), and selection query/manipulation (`getSelectedText`, `deleteSelection`, `replaceSelection`).

**Interface — Selection Movement:**
- `selectLeft(): TextBuffer` — extend selection 1 char left (or to prev line end)
- `selectRight(): TextBuffer` — extend selection 1 char right (or to next line start)
- `selectUp(): TextBuffer` — extend selection 1 line up (preferredCol aware)
- `selectDown(): TextBuffer` — extend selection 1 line down (preferredCol aware)
- `selectWordLeft(): TextBuffer` — extend selection to previous word boundary
- `selectWordRight(): TextBuffer` — extend selection to next word boundary
- `selectToLineStart(): TextBuffer` — extend selection to column 0
- `selectToLineEnd(): TextBuffer` — extend selection to end of line
- `selectToDocStart(): TextBuffer` — extend selection to line 0, col 0
- `selectToDocEnd(): TextBuffer` — extend selection to last line, last col
- `selectAll(): TextBuffer` — anchor at doc start, head at doc end

**Interface — Document Movement:**
- `moveToDocStart(): TextBuffer` — cursor to line 0, col 0 (clears selection)
- `moveToDocEnd(): TextBuffer` — cursor to last line, last col (clears selection)

**Interface — Word Deletion:**
- `deleteWordBackward(): TextBuffer` — delete from cursor to previous word boundary
- `deleteWordForward(): TextBuffer` — delete from cursor to next word boundary

**Interface — Selection Operations:**
- `getSelectedText(): string` — return text within selection (empty string if no selection). Multi-line: join with `\n`
- `deleteSelection(): TextBuffer` — remove selected text, cursor at selection start, selection cleared
- `replaceSelection(text: string): TextBuffer` — replace selected text with `text`, cursor after inserted text

**Implementation notes:**
- Each `select*` method: compute target position using same logic as corresponding `move*`, then call `selectTo(target)`
- `selectUp/Down` must respect `_preferredCol` like `moveCursor('up'/'down')` does
- `deleteSelection`: normalize anchor/head with existing `normalizeSelection`, splice lines, merge boundary lines
- `replaceSelection`: call `deleteSelection` then insert text at cursor (handle multi-line text with split+splice)
- `deleteWordBackward/Forward`: reuse word boundary logic from `moveWordLeft/Right`, delete between old and new position

**Test scenarios:**
- selectLeft from middle of line extends selection by 1 char
- selectLeft from col 0 wraps to previous line end
- selectRight from end of line wraps to next line start
- selectUp/Down preserves preferredCol across vertical selection
- selectWordLeft/Right skips whitespace then word chars
- selectToLineStart/End from middle of line
- selectToDocStart from middle of document
- selectToDocEnd from middle of document
- selectAll covers entire document
- getSelectedText returns correct text for single-line selection
- getSelectedText returns correct text for multi-line selection
- getSelectedText returns empty string when no selection
- deleteSelection removes single-line selection
- deleteSelection removes multi-line selection and merges lines
- deleteSelection with no selection is a no-op
- replaceSelection replaces selected text
- replaceSelection with multi-line replacement text
- replaceSelection with no selection inserts at cursor
- moveToDocStart/End moves cursor and clears selection
- deleteWordBackward deletes from cursor to word boundary
- deleteWordBackward at line start merges with previous line
- deleteWordForward deletes from cursor to next word boundary

**Dependencies:** `src/tui/editor/types.ts` (existing types)

**Commit:** `feat(editor): add selection movement, doc navigation, and word deletion to TextBuffer`

---

- [ ] Task 3: Selection-Aware Existing TextBuffer Methods

**Files:**
- Modify: `src/tui/editor/text-buffer.ts`
- Modify: `test/tui/editor/text-buffer.test.ts`

**What:** Update existing TextBuffer methods so they respect active selection, matching standard editor behavior (type to replace selection, arrow to collapse selection, backspace to delete selection).

**Behavior changes:**

| Method | Current | New (when selection active) |
|--------|---------|----------------------------|
| `insertChar(char)` | Always inserts at cursor | `deleteSelection()` then insert |
| `insertNewline()` | Always inserts at cursor | `deleteSelection()` then newline |
| `deleteBackward()` | Deletes 1 char backward | `deleteSelection()` (ignores direction) |
| `deleteForward()` | Deletes 1 char forward | `deleteSelection()` (ignores direction) |
| `moveCursor('left')` | Moves 1 char left | Clear selection, cursor to selection start |
| `moveCursor('right')` | Moves 1 char right | Clear selection, cursor to selection end |
| `moveCursor('up')` | Moves 1 line up | Clear selection, then move from head position |
| `moveCursor('down')` | Moves 1 line down | Clear selection, then move from head position |
| `moveToLineStart()` | Moves to col 0 | Clear selection, move to col 0 |
| `moveToLineEnd()` | Moves to end | Clear selection, move to end |
| `moveWordLeft()` | Moves to word boundary | Clear selection, move to word boundary |
| `moveWordRight()` | Moves to word boundary | Clear selection, move to word boundary |

**Implementation notes:**
- At the start of each method, check `this._selection !== null`
- For `insertChar`/`insertNewline`: call `this.deleteSelection()` first, then proceed
- For `deleteBackward`/`deleteForward`: return `this.deleteSelection()` directly
- For movement methods: use `normalizeSelection()` to get start/end, clear selection via `_with({ selection: null })`, position cursor accordingly
- Left arrow → cursor to `start`, Right arrow → cursor to `end`
- Up/Down: clear selection, set cursor to head position, then do the normal up/down movement

**Test scenarios:**
- insertChar with selection replaces selected text
- insertNewline with selection deletes selection then inserts newline
- deleteBackward with selection deletes entire selection (not just 1 char)
- deleteForward with selection deletes entire selection
- left arrow with selection collapses to selection start
- right arrow with selection collapses to selection end
- up arrow with selection clears selection and moves up from head
- down arrow with selection clears selection and moves down from head
- moveToLineStart with selection clears selection
- moveWordLeft with selection clears selection then moves
- All existing tests continue to pass (no selection = unchanged behavior)

**Dependencies:** Task 2 (needs `deleteSelection()`)

**Commit:** `feat(editor): make TextBuffer methods selection-aware`

---

- [ ] Task 4: TextEditorController Key Dispatch Update

**Files:**
- Modify: `src/tui/editor/text-editor.ts`
- Modify: `test/tui/editor/text-editor.test.ts`
- Modify: `src/tui/screens/EditorScreen.tsx:148-152,461-485` (buffer switch remap + Ctrl+Arrow passthrough)

**What:** Rewrite `_dispatch()` to handle Shift, Meta, and Ctrl+Shift modifier combinations. Add clipboard copy/cut/paste orchestration. Remap buffer switching in EditorScreen from `Ctrl+Left/Right` to `Ctrl+Shift+[/]`.

**Dispatch priority (new):**
```
1. Meta + Shift + key  → selection to line/doc boundary
2. Meta + key          → move to line/doc boundary, selectAll, clipboard
3. Ctrl + Shift + key  → word selection, delete line (existing), buffer switch (remapped)
4. Ctrl + key          → word move, undo/redo, bold/italic/link (existing), clipboard, selectAll
5. Shift + named key   → selection movement
6. Named key           → movement + selection clear (updated existing)
7. Plain character     → selection-aware insert (updated existing)
```

**New keybindings in TextEditorController:**

| Key Combo | Method Call |
|-----------|------------|
| `Shift+Left/Right` | `selectLeft()` / `selectRight()` |
| `Shift+Up/Down` | `selectUp()` / `selectDown()` |
| `Shift+Home/End` | `selectToLineStart()` / `selectToLineEnd()` |
| `Ctrl+Shift+Left/Right` | `selectWordLeft()` / `selectWordRight()` |
| `Ctrl+A` | `selectAll()` |
| `Ctrl+C` | `getSelectedText()` → `setClipboard()`, return same buffer |
| `Ctrl+X` | `getSelectedText()` → `setClipboard()` → `checkpoint().deleteSelection()` |
| `Ctrl+V` | `checkpoint().replaceSelection(getClipboard())` |
| `Meta+Left/Right` | `moveToLineStart()` / `moveToLineEnd()` |
| `Meta+Up/Down` | `moveToDocStart()` / `moveToDocEnd()` |
| `Meta+Shift+Left/Right` | `selectToLineStart()` / `selectToLineEnd()` |
| `Meta+Shift+Up/Down` | `selectToDocStart()` / `selectToDocEnd()` |
| `Meta+A` | `selectAll()` |
| `Meta+C/X/V` | same as Ctrl versions |

**EditorScreen changes:**
- Remove `handleCtrlArrow()` usage for `Ctrl+Left/Right`
- Add `Ctrl+Shift+[` (`{`) and `Ctrl+Shift+]` (`}`) for buffer next/prev
- Let `Ctrl+Left/Right` pass through to TextEditorController
- Update `handleCtrlArrow()` or remove it and inline the new logic

**Test scenarios:**
- Shift+Left creates/extends selection left
- Shift+Right creates/extends selection right
- Shift+Up/Down extends selection vertically
- Ctrl+Shift+Left selects word left
- Ctrl+Shift+Right selects word right
- Ctrl+A selects entire document
- Ctrl+C copies selected text to clipboard
- Ctrl+C with no selection is a no-op
- Ctrl+X cuts selected text (copies + deletes)
- Ctrl+V pastes clipboard content at cursor
- Ctrl+V with selection replaces selection with clipboard
- Meta+Left moves to line start
- Meta+Right moves to line end
- Meta+Shift+Left selects to line start
- Character input replaces selection
- Backspace with selection deletes entire selection
- Enter with selection deletes selection then inserts newline

**Dependencies:** Task 1 (clipboard), Task 2 (select methods), Task 3 (selection-aware methods)

**Notes:**
- `Meta` key reception depends on terminal. Implement all Meta handlers but document that they may not work in all terminals. Ctrl versions are the reliable fallback.
- Existing keybinding for `Ctrl+D` (deleteForward) is kept unchanged.
- Must not break existing Ctrl+B/I/K/Z/Y behavior.

**Commit:** `feat(editor): add Shift/Meta key dispatch with clipboard and remap buffer switching`

---

- [ ] Task 5: Renderer Selection Highlighting

**Files:**
- Modify: `src/theme/colors.ts`
- Modify: `src/tui/editor/renderer.ts`
- Modify: `test/tui/editor/renderer.test.ts`

**What:** Add a `selectionBg` theme color and a new `applySelectionHighlight()` function that paints selection background color onto syntax-highlighted lines. Update `renderViewport()` to accept selection state and apply highlighting in the render pipeline.

**Theme addition** in `src/theme/colors.ts`:
- Add `selectionBg: (text: string) => string` to the `Theme` interface
- Implementation: `chalk.bgHex('#264f78')` (True Color) / `chalk.bgBlue` (fallback)

**New function:** `applySelectionHighlight(highlightedLine: string, lineIndex: number, selection: Selection | null, selectionBg: (text: string) => string): string`
- Returns the line unchanged if selection is null or line is outside selection range
- For fully selected lines: wraps each visible character in `selectionBg()`
- For partially selected lines: wraps only characters in the selection column range
- Walks ANSI codes by skipping escape sequences (same pattern as existing `insertCursor`)
- For lines where selection extends past the end (multi-line selection midpoint or end-of-line), pads with a single `selectionBg(' ')` to indicate the newline is selected

**RenderOptions change:**
- Add `selection: Selection | null` field

**renderViewport pipeline update:**
```
for each viewport line:
  1. highlightedLine (syntax colors — existing)
  2. applySelectionHighlight (background overlay — new)
  3. insertCursor if cursor on this line (existing)
  4. truncateToWidth (existing)
```

Note: `applySelectionHighlight` must run BEFORE `insertCursor` so the cursor reverse-video appears on top of the selection background.

**Test scenarios:**
- Selection null returns line unchanged
- Line completely outside selection range returns unchanged
- Single-line selection highlights correct column range
- Multi-line selection: first line highlighted from start col to end
- Multi-line selection: middle lines fully highlighted
- Multi-line selection: last line highlighted from start to end col
- ANSI escape codes in line are preserved (not counted as visible chars)
- Selection extending past line end adds background space
- Empty selection (anchor === head) returns line unchanged

**Dependencies:** `src/tui/editor/types.ts` (Selection type)

**Commit:** `feat(editor): add selection highlighting to renderer with themed background`

---

- [ ] Task 6: EditorScreen Integration

**Files:**
- Modify: `src/tui/screens/EditorScreen.tsx:291-306` (renderViewport call in useMemo)

**What:** Pass the current selection state from the active buffer to `renderViewport()` so selection highlighting is displayed. This is a minimal wiring change.

**Changes:**
- In the `renderedOutput` useMemo block, read `state.selection` from `active.editor.getBuffer().getState()`
- Pass `selection: state.selection` to the `renderViewport()` options object
- Add `selection` to the useMemo dependency array (it's part of `active` so this is already covered, but verify)

**Test scenarios:**
- Verify via existing layout snapshot test that editor renders without error when selection is null (no visual change from baseline)
- Manual verification: open editor, use Shift+Arrow to select text, confirm blue background appears

**Dependencies:** Task 4, Task 5

**Notes:** May require updating the layout snapshot (`test/tui/__snapshots__/layout-snapshots.test.ts.snap`) if the RenderOptions change affects the snapshot. Run `vitest --update` if needed.

**Commit:** `feat(editor): wire selection state to renderer in EditorScreen`
