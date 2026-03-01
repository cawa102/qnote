# Search Input Border Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the search input always visible by wrapping it in a bold border box on FindFileScreen and SearchScreen.

**Architecture:** Add `borderStyle="bold"` and `borderColor="#56b6c2"` to the `<Box>` wrapping the search input label + TextInput. Both screens get the identical treatment. The border color uses the same accent hex as the palette grid cells.

**Tech Stack:** Ink 5 (`<Box borderStyle borderColor>`), React 18, Vitest + ink-testing-library

---

- [ ] Task 1: Add bold border to FindFileScreen search input

**Files:**
- Modify: `src/tui/screens/FindFileScreen.tsx:124-128`
- Test: `test/tui/find-file-screen.test.ts`

**What:** Wrap the existing search input `<Box>` in a bordered box. Change the plain `<Box>` at line 125 to use `borderStyle="bold"` and `borderColor="#56b6c2"`. The border makes the input area visually distinct even before the user types anything.

**Interface:**
- No new exports or functions — JSX-only change
- The outer `<Box>` gains `borderStyle="bold"` and `borderColor="#56b6c2"`

**Test scenarios:**
- Rendered output contains bold border characters (┏ or ┃)
- Label text "ファイル検索" appears inside the bordered area
- Placeholder text "search files..." is present in output

**Dependencies:** `ink` (Box borderStyle/borderColor props — already used in CommandPalette.tsx:128-129)

**Notes:** Use the same `#56b6c2` hex color that CommandPalette grid cells use for selected state. For search input, the border is always colored (always active).

**Commit:** `feat: add bold border to find-file search input`

---

- [ ] Task 2: Add bold border to SearchScreen search input

**Files:**
- Modify: `src/tui/screens/SearchScreen.tsx:88-93`
- Test: `test/tui/search-screen.test.ts`

**What:** Same treatment as Task 1 — wrap the search input `<Box>` at line 90 with `borderStyle="bold"` and `borderColor="#56b6c2"`.

**Interface:**
- No new exports or functions — JSX-only change

**Test scenarios:**
- Rendered output contains bold border characters (┏ or ┃)
- Label text "検索" appears inside the bordered area
- Placeholder text "search notes..." is present in output

**Dependencies:** `ink` (Box borderStyle/borderColor)

**Notes:** Identical border treatment to Task 1 for visual consistency.

**Commit:** `feat: add bold border to search screen input`
