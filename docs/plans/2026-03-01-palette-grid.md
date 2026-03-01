# Palette Grid Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the command palette from a vertical list to a responsive emoji icon grid (3x2), removing the Recent command.

**Architecture:** Replace the linear `PALETTE_COMMANDS` rendering with a grid layout using Ink's `<Box>` flexbox. Add an `icon` field to `PaletteCommand`. Rewrite `computePaletteLayout` to return grid-aware properties (columns, cellWidth). Navigation changes from 1D (up/down) to 2D (arrow keys in a grid).

**Tech Stack:** Ink 5 (Box flexbox), React 18, Vitest

---

- [ ] Task 1: Update PaletteCommand data and layout computation

**Files:**
- Modify: `src/tui/screens/CommandPalette.tsx:9-23`
- Modify: `src/theme/format.ts:36-49`
- Test: `test/tui/command-palette.test.ts`

**What:** Add `icon` field to `PaletteCommand`, remove the Recent command, and rewrite `computePaletteLayout` for responsive grid breakpoints.

**Interface:**
- `PaletteCommand` — add `readonly icon: string` field
- `PALETTE_COMMANDS` — 6 items (remove Recent), each with emoji icon
- `PaletteGridLayout` — new interface replacing `PaletteLayout`:
  - `columns: number` (3, 2, or 1 based on width)
  - `cellWidth: number` (width per grid cell)
  - `leftPad: number` (centering offset)
  - `rowGap: number` (vertical gap between rows)
  - `separatorGap: number` (gap after ruler)
- `computePaletteGridLayout(contentWidth: number): PaletteGridLayout` — replaces `computePaletteLayout`
  - width >= 60 → 3 columns
  - width 40-59 → 2 columns
  - width < 40 → 1 column (vertical list fallback)

**Icon mapping:**

| Command | Icon |
|---------|------|
| New Note | 📝 |
| Quick Note | ⚡ |
| Daily Note | 📅 |
| Find File | 📁 |
| Search | 🔍 |
| Tags | 🏷️ |

**Test scenarios:**
- PALETTE_COMMANDS has 6 commands (was 7)
- Each command has label, key, action, and icon fields
- All keys are unique
- No command has action 'recent'
- computePaletteGridLayout: width 80 → 3 columns
- computePaletteGridLayout: width 50 → 2 columns
- computePaletteGridLayout: width 35 → 1 column
- cellWidth scales correctly per breakpoint
- leftPad centers the grid

**Notes:** `formatIndicator` is no longer used by CommandPalette after this change (keep it since NoteList may use it). Remove the old `PaletteLayout` interface and `computePaletteLayout` function — they are only used by CommandPalette and its tests.

**Commit:** `refactor: update palette commands and grid layout computation`

---

- [ ] Task 2: Rewrite CommandPalette grid rendering and 2D navigation

**Files:**
- Modify: `src/tui/screens/CommandPalette.tsx:30-89`
- Test: `test/tui/command-palette-input.test.ts`

**What:** Replace the vertical list rendering with a grid of emoji icon cells. Change navigation from 1D (up/down only) to 2D (all four arrow keys). Each cell renders: emoji on top line, `Label (key)` on bottom line. Selected item's label text uses accent color.

**Interface:**
- `useInput` handler — add leftArrow/rightArrow support for grid column movement
  - leftArrow: `col = Math.max(0, col - 1)` (stop at left edge)
  - rightArrow: `col = Math.min(columns - 1, col + 1)` (stop at right edge)
  - upArrow: `row = Math.max(0, row - 1)` (stop at top edge)
  - downArrow: `row = Math.min(maxRow, row + 1)` (stop at bottom edge)
  - Convert `(row, col)` to flat index: `row * columns + col`
  - Clamp index to `PALETTE_COMMANDS.length - 1`
- Grid rendering: `PALETTE_COMMANDS` chunked into rows of `columns` length, each row is a horizontal `<Box>`, each cell is a vertical `<Box>` with centered text
- Label format: `Label (key)` — shortcut key always visible (no `showKeys` toggle)

**Test scenarios:**
- Shortcut keys test: 6 commands (remove 'r' → 'recent' pair)
- Arrow right moves selection from col 0 to col 1
- Arrow left at col 0 stays at col 0
- Arrow down moves from row 0 to row 1
- Arrow up at row 0 stays at row 0
- Enter on grid position fires correct action
- Selected item label contains accent color
- No `●` or `○` indicators in rendered output
- Layout renders emoji icons above labels

**Dependencies:** Task 1 (PaletteCommand.icon, computePaletteGridLayout)

**Notes:** The `renderPalette` helper in tests needs width parameter to test responsive breakpoints. Frame assertions that check for `●`/`○` must be rewritten to check for emoji icons and colored labels. The cursor navigation test that checks `find file` after one arrow-down must change — in the grid, arrow-down from `New Note` goes to `Find File` (same column, next row), which is the same result but the test assertion format changes (no `●` prefix).

**Commit:** `feat: palette grid rendering with 2D navigation and emoji icons`

---

- [ ] Task 3: Remove Recent action handler from App.tsx

**Files:**
- Modify: `src/tui/App.tsx:82-95`

**What:** Remove the `case 'recent'` branch from `handleAction` switch statement. The action is no longer reachable since Recent was removed from PALETTE_COMMANDS.

**Test scenarios:**
- App still handles all 6 remaining actions (new, capture, daily, findFile, search, tags)
- No reference to 'recent' in handleAction

**Notes:** Keep `noteService.listRecent()` method — it's used by the CLI `list` command. Only remove the TUI action handler. The `setNoteListTitle('Recent')` initialization on line 63 can also be removed since it's overwritten before use.

**Commit:** `refactor: remove recent action handler from palette`

---

## Execution

**Plan saved to:** `docs/plans/2026-03-01-palette-grid.md`

**Recommendation: 1 (Subagent-Driven)** — Only 3 tasks, sequential dependencies (Task 2 depends on Task 1), focused on a single component. Fast iteration with code review between tasks is ideal.
