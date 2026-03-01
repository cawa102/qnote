# Buffer Switching & Tab UI Improvement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable buffer switching via Ctrl+Right/Left, allow file tree to display without an initial file, improve tab visual clarity, and add footer hints for tab navigation.

**Architecture:** This is a wiring and UI polish task. The core buffer management (`BufferManager.nextBuffer()` / `prevBuffer()`) is already implemented and tested. The changes are: (1) connect those methods to key handlers in EditorScreen, (2) fix the `!active` early return so file tree can render without an initial file, (3) improve BufferTabs active/inactive styling, (4) add footer hint entry.

**Tech Stack:** React 18, Ink 5, chalk (theme system), Vitest

---

## Task Dependency Graph

```
Task 1 (Footer hint)         ← independent
Task 2 (Tab styling)         ← independent
Task 3 (Buffer switching)    ← independent
Task 4 (No-file file tree)   ← independent
```

All tasks are independent and can be implemented in parallel.

---

- [ ] Task 1: Add buffer switching footer hint

**Files:**
- Modify: `src/tui/components/Footer.tsx:39-46` (editor hints array)
- Test: `test/tui/footer.test.ts`

**What:** Add a `{ key: '^→/←', desc: 'tab' }` entry to the `editor` hints array, positioned after `^E` (tree) and before `^T` (title). This tells users how to switch between open buffers.

**Interface:**
- No new interfaces. Reuses existing `HintEntry` type: `{ key: string; desc: string }`.

**Test scenarios:**
- Editor hints contain `^→/←` key entry
- Editor hints contain `tab` description for that entry
- Entry is positioned between `^E` and `^T` in the array

**Commit:** `feat: add buffer switching hint to editor footer`

---

- [ ] Task 2: Improve BufferTabs active/inactive styling

**Files:**
- Modify: `src/tui/components/BufferTabs.tsx:146` (tab style assignment)
- Modify: `src/theme/colors.ts` (add `tabActive` theme function if needed)
- Test: `test/tui/components/buffer-tabs.test.ts`

**What:** Make active tabs more visually distinct from inactive tabs. Currently both use text-only styles (`theme.selected` vs `theme.dim`). Change active tab to use inverse/background styling (similar to `keyBadge` but with the `selected` color) so it stands out clearly. Inactive tabs stay `theme.dim`.

The current active tab style at `BufferTabs.tsx:146`:
```typescript
const style = tab.isActive ? theme.selected : theme.dim;
```

**Approach:** Add a `tabActive` function to the `Theme` interface that uses `chalk.bgHex('#98c379').hex('#1e1e2e')` (inverse of the selected color — green background with dark text). This mirrors the `keyBadge` pattern but uses the accent green instead of cyan. Fall back to `chalk.bgGreen.black` for non-True-Color terminals.

**Interface:**
- Add to `Theme` interface in `src/theme/colors.ts`:
  - `tabActive: (text: string) => string` — inverse green background for active buffer tab

**Test scenarios:**
- Active tab uses `tabActive` style (produces different output from `theme.dim`)
- Active tab output contains the tab title text
- Inactive tabs still use `theme.dim` style
- Active and inactive tab outputs are visually different (stripped ANSI differ in length or content)

**Dependencies:** `chalk`

**Commit:** `feat: improve buffer tab active/inactive visual distinction`

---

- [ ] Task 3: Wire buffer switching keybindings

**Files:**
- Modify: `src/tui/screens/EditorScreen.tsx:437-480` (inside `key.ctrl` block of `useInput` handler)
- Test: `test/tui/screens/editor-screen.test.ts`

**What:** Add Ctrl+Right and Ctrl+Left keybindings that call `nextBuffer()` and `prevBuffer()` on the BufferManager. Reset scroll offset to 0 on switch. The header title/tags sync is already handled by the existing `useEffect` at line 235-242 that watches `bufferManager` state.

Insert the new handlers inside the `if (key.ctrl)` block (after Ctrl+E at line 453, before Ctrl+W at line 456):

**Logic:**
- `key.ctrl && key.rightArrow` → `setBufferManager(prev => prev.nextBuffer())` + `setScrollOffset(0)` + return
- `key.ctrl && key.leftArrow` → `setBufferManager(prev => prev.prevBuffer())` + `setScrollOffset(0)` + return

Note: Ink's `useInput` provides `key.rightArrow` and `key.leftArrow` as booleans, and `key.ctrl` as a boolean. When Ctrl+Right is pressed, both `key.ctrl` and `key.rightArrow` will be true. The `input` string will be empty for arrow keys.

**Important:** These handlers must be placed BEFORE the existing arrow key handling in the editor dispatch (line 526+) and file tree dispatch (line 504+) to ensure Ctrl+Arrow is caught globally regardless of focus area. Since they're inside the `if (key.ctrl)` block at line 437, they'll be reached before the focus-area dispatches below.

**Test scenarios — pure function tests:**

Since `nextBuffer` / `prevBuffer` are already tested in `buffer-manager.test.ts`, the EditorScreen tests focus on the integration point. However, EditorScreen's `useInput` handler is not easily unit-testable (it's a React hook). Instead, add tests for a new exported pure function:

Export a new function `handleCtrlArrow(key: { rightArrow: boolean; leftArrow: boolean }): 'next' | 'prev' | null` from EditorScreen:
- `key.rightArrow` → returns `'next'`
- `key.leftArrow` → returns `'prev'`
- Neither → returns `null`

**Test scenarios:**
- `handleCtrlArrow({ rightArrow: true, leftArrow: false })` returns `'next'`
- `handleCtrlArrow({ rightArrow: false, leftArrow: true })` returns `'prev'`
- `handleCtrlArrow({ rightArrow: false, leftArrow: false })` returns `null`

**Commit:** `feat: wire Ctrl+Right/Left buffer switching in EditorScreen`

---

- [ ] Task 4: Allow file tree rendering without active buffer

**Files:**
- Modify: `src/tui/screens/EditorScreen.tsx:560-637` (render section)
- Test: `test/tui/screens/editor-screen.test.ts`

**What:** Currently, when `!active` (no buffer open), EditorScreen returns early at line 561 with a simple text message. This prevents the file tree from rendering even if `fileTreeVisible` is true.

Refactor the render section so that the `!active` case still renders the full layout (file tree + separator + editor area), but with a placeholder message in the editor content area instead of the edit/preview content. The `BufferTabs` should render with empty buffers (which already shows `[+]`), and the header bar should be hidden (no buffer to show metadata for).

**Render logic change (pseudocode):**
```
// Remove the early return at line 561-567
// In the main layout (line 569+), make buffer-dependent sections conditional:

<Box flexDirection="row">
  {fileTreeVisible && <FileTree ... />}
  {fileTreeVisible && <Separator />}
  <Box flexDirection="column" width={editorWidth}>
    <BufferTabs buffers={bufferInfos} activeId={active?.id ?? ''} width={editorWidth} />
    {active && <EditorHeaderBar ... />}
    <Box flexGrow={1}>
      {active ? <EditOrPreviewContent /> : <Text dimColor>Select a file from the tree (Ctrl+E)</Text>}
    </Box>
  </Box>
</Box>
```

**Key considerations:**
- `BufferTabs` already handles `buffers.length === 0` (renders `[+]`)
- `active?.id ?? ''` safely passes empty string when no active buffer
- EditorHeaderBar should NOT render when there's no active buffer (no title/tags to show)
- The edit area shows a placeholder message when `!active`
- The error-only early return (line 550-557) stays as-is

**Test scenarios — pure function (no new function needed, verify render logic):**

This change affects the render tree, which is hard to unit test without React rendering. However, we can add a test for the `computeEditorLayout` function to ensure it works correctly when called with `fileTreeVisible: true` regardless of buffer state (this already works — no new test needed for that).

Add a descriptive test to `editor-screen.test.ts` that documents the expected behavior:
- `computeEditorLayout` returns valid treeWidth/editorWidth when `fileTreeVisible=true` (already tested, confirm coverage)

**Notes:** The `useInput` handler already handles `Ctrl+E` correctly even when `!active` — it updates `fileTreeVisible` state. The issue is purely in the render section.

**Commit:** `feat: render file tree layout without active buffer`

---

## Execution Notes

- All 4 tasks are independent — no blocking dependencies
- Tasks 1 and 2 are small (< 10 lines of change each)
- Task 3 is moderate (new handler + exported pure function + tests)
- Task 4 is the largest (render refactor), but well-scoped — just remove early return and make sections conditional
- Total estimated files changed: 5 source + 3 test = 8 files
