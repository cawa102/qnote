# Buffer Switching & Tab UI Improvement Design

**Date:** 2026-03-01
**Status:** Approved

## Problem

EditorScreen has BufferManager and BufferTabs infrastructure for multi-buffer editing, but:
1. Buffer switching keybindings (nextBuffer/prevBuffer) are not wired to the UI
2. Entering EditorScreen without an initial file prevents file tree display (early return at line 561)
3. Tab visual styling lacks clear active/inactive distinction
4. Footer hints don't mention buffer switching shortcuts

## Design

### 1. Buffer Switching Keybindings

**File:** `src/tui/screens/EditorScreen.tsx` — `useInput` handler (Ctrl key block)

- `Ctrl+Right` → `bufferManager.nextBuffer()`
- `Ctrl+Left` → `bufferManager.prevBuffer()`
- Reset `scrollOffset` to 0 on switch
- Header title/tags sync is automatic (existing useEffect at line 235-242 watches bufferManager)

### 2. File Tree Without Initial File

**File:** `src/tui/screens/EditorScreen.tsx` — render section

Remove the `!active` early return that blocks file tree rendering. Instead, render the full layout (file tree + separator + editor area) with a placeholder message in the editor area when no buffer is active.

This enables the workflow: palette → EditorScreen (no file) → Ctrl+E → tree → select file.

### 3. Tab UI Improvement

**File:** `src/tui/components/BufferTabs.tsx`

- Active tab: Use `theme.selected` with underline or inverse for stronger visual distinction
- Inactive tab: Use `theme.dim` (existing)
- Dirty indicator: `*` suffix (existing, keep as-is)

### 4. Footer Hint

**File:** `src/tui/components/Footer.tsx`

Add `{ key: '^→/←', desc: 'tab' }` to the editor hints array, positioned after `^E` (tree) and before `^T` (title).

## Files Changed

| File | Change |
|------|--------|
| `src/tui/screens/EditorScreen.tsx` | Add Ctrl+Right/Left handler, fix !active early return |
| `src/tui/components/BufferTabs.tsx` | Improve tab styling |
| `src/tui/components/Footer.tsx` | Add tab switching hint |
| `test/tui/screens/editor-screen.test.ts` | Test buffer switching keybinds |
| `test/tui/footer.test.ts` | Test new hint entry |
| `test/tui/components/buffer-tabs.test.ts` | Test improved styling |

## Non-Goals

- Split-view / side-by-side editing (future consideration)
- Buffer ordering / drag-and-drop tabs
- Tab close button (Ctrl+W already exists)
