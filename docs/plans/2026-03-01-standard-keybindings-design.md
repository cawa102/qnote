# Standard Text Editing Keybindings Design

## Goal

Make the built-in editor feel familiar to non-vim users by implementing standard text editing keybindings (Microsoft Word / VS Code / macOS defaults). Users should be able to use Cmd+Arrow for line navigation, Shift+Arrow for selection, Option+Backspace for word deletion, and Ctrl+C/X/V for clipboard operations without any learning curve.

## Scope

**In scope:** Main editor only (`TextBuffer`, `TextEditorController`, `renderer.ts`)
**Out of scope:** Search bars, capture screen, tag input, and other `@inkjs/ui TextInput` instances

## Phase 0: Terminal Modifier Key Verification

Before implementation, create a test script (`tmp-key-test.tsx`) to verify what Ink's `useInput` actually receives for each modifier combination:

- `Cmd+Arrow` — does `meta: true` arrive?
- `Shift+Arrow` — does `shift: true` arrive?
- `Option+Arrow` — what escape sequence arrives?
- `Option+Backspace` — what arrives?
- `Cmd+Shift+Arrow` — combined flags?

Results determine which Meta/Option bindings are viable. Ctrl-based alternatives are always available as fallback.

## Design

### 1. TextBuffer Additions

#### Selection Movement Methods

All use the existing `selectTo()` internally (DRY):

| Method | Description |
|--------|-------------|
| `selectLeft()` / `selectRight()` | Extend selection by 1 character |
| `selectUp()` / `selectDown()` | Extend selection by 1 line (preferredCol aware) |
| `selectWordLeft()` / `selectWordRight()` | Extend selection by 1 word |
| `selectToLineStart()` / `selectToLineEnd()` | Extend selection to line boundary |
| `selectToDocStart()` / `selectToDocEnd()` | Extend selection to document boundary |
| `selectAll()` | Select entire document |

#### Selection Operations

| Method | Description |
|--------|-------------|
| `deleteSelection()` | Delete selected text, cursor at selection start |
| `replaceSelection(text)` | Replace selected text with new text |
| `getSelectedText()` | Return the selected text as string |

#### Document Movement

| Method | Description |
|--------|-------------|
| `moveToDocStart()` | Move cursor to line 0, col 0 |
| `moveToDocEnd()` | Move cursor to last line, last col |

#### Word Deletion

| Method | Description |
|--------|-------------|
| `deleteWordBackward()` | Delete word before cursor (Option+Backspace) |
| `deleteWordForward()` | Delete word after cursor (Option+Delete) |

#### Selection-Aware Behavior on Existing Methods

- `insertChar()` — if selection active, call `deleteSelection()` first then insert
- `insertNewline()` — if selection active, call `deleteSelection()` first then newline
- `deleteBackward()` — if selection active, call `deleteSelection()` instead
- `deleteForward()` — if selection active, call `deleteSelection()` instead
- `moveCursor('left')` — if selection active, clear selection and move to selection start
- `moveCursor('right')` — if selection active, clear selection and move to selection end
- `moveCursor('up'/'down')` — if selection active, clear selection and move from head

### 2. Internal Clipboard

Separate module `src/tui/editor/clipboard.ts`:

```typescript
let clipboardContent: string = ''
export function getClipboard(): string { return clipboardContent }
export function setClipboard(text: string): void { clipboardContent = text }
```

TextBuffer has no knowledge of clipboard. TextEditorController orchestrates:
- Copy: `getSelectedText()` → `setClipboard()`
- Cut: `getSelectedText()` → `setClipboard()` → `deleteSelection()`
- Paste: `replaceSelection(getClipboard())` or `insertChar(getClipboard())`

### 3. TextEditorController Key Dispatch

Priority order:

```
1. Meta + Shift + key
2. Meta + key
3. Ctrl + Shift + key
4. Ctrl + key (existing)
5. Shift + named key (selection)
6. Named key only (movement + selection clear)
7. Plain character (selection-aware insert)
```

#### Full Keybinding Table

| Key Combo | Action |
|-----------|--------|
| `←/→/↑/↓` | Move cursor + clear selection |
| `Home/End` | Line start/end + clear selection |
| `Shift+←/→` | selectLeft/Right |
| `Shift+↑/↓` | selectUp/Down |
| `Shift+Home/End` | selectToLineStart/End |
| `Ctrl+←/→` | moveWordLeft/Right + clear selection |
| `Ctrl+Shift+←/→` | selectWordLeft/Right |
| `Ctrl+A` | selectAll |
| `Ctrl+C` | copy |
| `Ctrl+X` | cut |
| `Ctrl+V` | paste |
| `Ctrl+Z` | undo |
| `Ctrl+Y` | redo |
| `Ctrl+B` | bold wrap |
| `Ctrl+I` | italic wrap |
| `Ctrl+D` | delete forward |
| `Ctrl+K` | insert link |
| `Ctrl+Shift+K` | delete line |
| `Meta+←/→` | moveToLineStart/End (if terminal supports) |
| `Meta+↑/↓` | moveToDocStart/End (if terminal supports) |
| `Meta+Shift+←/→` | selectToLineStart/End (if terminal supports) |
| `Meta+Shift+↑/↓` | selectToDocStart/End (if terminal supports) |
| `Meta+A` | selectAll (if terminal supports) |
| `Meta+C/X/V` | copy/cut/paste (if terminal supports) |
| `Option+Backspace` | deleteWordBackward (if terminal supports) |
| `Backspace` | deleteSelection if selected, else deleteBackward |
| `Delete` | deleteSelection if selected, else deleteForward |
| `Return` | deleteSelection if selected, then newline/list-continue |
| `Tab/Shift+Tab` | indent/unindent |
| Character | replaceSelection if selected, else insertChar |

### 4. Renderer Selection Highlight

#### Theme Addition

```typescript
// colors.ts
selectionBg: supportsColor
  ? chalk.bgHex('#264f78')   // VS Code-style blue selection
  : chalk.bgBlue
```

#### New Function: `applySelectionHighlight()`

Same pattern as `insertCursor()` — walks ANSI codes by skipping escape sequences and counting visible characters:

1. Line not in selection range → return unchanged
2. Line fully in selection range → apply bg to entire line
3. Line partially in selection → apply bg to selected columns only
4. Selection extends past line end → pad with bg-colored spaces to indicate selection includes newline

#### Render Pipeline Update

```
renderViewport():
  for each line in viewport:
    1. Start with highlightedLine (syntax colors)
    2. Apply applySelectionHighlight() (background color overlay)
    3. Apply insertCursor() if cursor is on this line
```

`RenderOptions` gains a `selection: Selection | null` field.

### 5. EditorScreen Integration

Minimal change: pass `buffer.getState().selection` to `renderViewport()` options.

## Files Changed

| File | Change |
|------|--------|
| `src/tui/editor/text-buffer.ts` | select*, deleteSelection, replaceSelection, getSelectedText, moveToDoc*, deleteWord*, selection-aware existing methods |
| `src/tui/editor/text-editor.ts` | Meta/Shift/Ctrl+Shift dispatch, selection-aware input handling, clipboard orchestration |
| `src/tui/editor/clipboard.ts` | **New** — internal clipboard module |
| `src/tui/editor/renderer.ts` | applySelectionHighlight(), RenderOptions.selection, render pipeline update |
| `src/theme/colors.ts` | selectionBg addition |
| `src/tui/screens/EditorScreen.tsx` | Pass selection to renderViewport |
| `test/tui/editor/text-buffer.test.ts` | Tests for all new TextBuffer methods |
| `test/tui/editor/text-editor.test.ts` | Tests for key dispatch combinations |
| `test/tui/editor/renderer.test.ts` | Tests for selection highlight rendering |
| `test/tui/editor/clipboard.test.ts` | **New** — clipboard tests |

## Test Strategy

- **Unit tests** for every new TextBuffer method (selection movement, deletion, replacement)
- **Integration tests** for TextEditorController key combinations
- **Renderer tests** for selection highlight with ANSI code coexistence
- **Edge cases**: empty selection, doc boundaries, multi-line selection, CJK characters in selection
