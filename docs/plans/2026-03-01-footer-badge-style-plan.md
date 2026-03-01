# Footer Badge Style Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace plain-text footer hints with LazyVim/htop-style key badges (accent background + dark text).

**Architecture:** Add `keyBadge` theme function to `colors.ts`. Change `HINTS` from plain strings to `HintEntry[]` arrays. Footer renders each entry as a badge+description pair using Ink `<Text>` elements. `getHintsForScreen` return type changes from `string` to `readonly HintEntry[]`.

**Tech Stack:** chalk (bgHex/hex for badge styling), Ink `<Text>` (rendering), Vitest (testing)

---

- [ ] Task 1: Add `HintEntry` type and `keyBadge` theme

**Files:**
- Modify: `src/types.ts:137` (after `ScreenName` type)
- Modify: `src/theme/colors.ts:2-29`
- Test: `test/theme/colors.test.ts` (if exists, otherwise verify via Task 3 tests)

**What:** Add `HintEntry` interface to shared types. Add `keyBadge` formatter to the theme object.

**Interface:**
- `HintEntry` — `{ readonly key: string; readonly desc: string }`
- `theme.keyBadge(text: string): string` — wraps text with accent background (#56b6c2) + dark foreground (#1e1e2e). Fallback: `chalk.bgCyan.black`.

**Test scenarios:**
- `theme.keyBadge` returns a non-empty string
- `theme.keyBadge` differs from plain input (contains styling)

**Dependencies:** `chalk`

**Notes:** Add `keyBadge` to the `Theme` interface AND the `theme` object. Keep existing theme entries unchanged.

**Commit:** `feat: add HintEntry type and keyBadge theme`

---

- [ ] Task 2: Restructure Footer HINTS and rendering

**Files:**
- Modify: `src/tui/components/Footer.tsx` (full rewrite of HINTS + Footer + getHintsForScreen)
- Modify: `src/tui/index.ts:4` (export type changes — `getHintsForScreen` now returns `readonly HintEntry[]`)

**What:** Change `HINTS` from `Record<ScreenName, string>` to `Record<ScreenName, readonly HintEntry[]>`. Rewrite `Footer` component to render each `HintEntry` as a badge (`theme.keyBadge(' ' + key + ' ')`) followed by dim description text. Add `formatHintEntry` helper to compose a single badge+description string. Pairs separated by 2 spaces.

**Interface:**
- `getHintsForScreen(screen: ScreenName): readonly HintEntry[]` — returns hint entries for screen
- `formatHintEntry(entry: HintEntry): string` — returns `keyBadge(' key ') + ' ' + dim(desc)`
- `formatHints(entries: readonly HintEntry[]): string` — joins formatted entries with `'  '` (2 spaces)

**HINTS data (all 7 screens):**

| Screen | Entries |
|--------|---------|
| palette | `Enter`→select, `q`→quit |
| findFile | `↑↓`→select, `Enter`→open, `Esc`→cancel |
| noteList | `:`→cmd, `/`→search, `n`→new, `Esc`→back |
| notePreview | `:`→cmd, `e`→edit, `p`→raw, `Esc`→back |
| search | `↑↓`→select, `Enter`→open, `Esc`→cancel |
| capture | `^S`→save, `Esc`→cancel |
| editor | `^S`→save, `^P`→preview, `^E`→tree, `^T`→title, `^G`→tags, `Esc`→back |

**Dependencies:** `src/types.ts` (HintEntry), `src/theme/colors.ts` (theme.keyBadge, theme.dim)

**Notes:** The Footer component currently uses `<Text dimColor>{hints}</Text>`. Replace with `<Text>{formatHints(entries)}</Text>` since styling is done via chalk in `formatHints`. Export `formatHintEntry` and `formatHints` for testability.

**Commit:** `feat: footer badge-style hints with keyBadge theme`

---

- [ ] Task 3: Update Footer tests

**Files:**
- Modify: `test/tui/footer.test.ts` (rewrite all tests)

**What:** Update tests for new `HintEntry[]` return type and badge rendering. `getHintsForScreen` now returns an array of `HintEntry` objects instead of a string. Footer rendering tests check for key text and description text presence in rendered output.

**Test scenarios:**
- `getHintsForScreen('palette')` returns array with `{key:'Enter', desc:'select'}` and `{key:'q', desc:'quit'}`
- `getHintsForScreen` returns non-empty array for every ScreenName
- Each entry has non-empty `key` and `desc` strings
- `formatHintEntry` produces string containing both the key and desc
- `formatHints` joins entries with separator
- Footer component renders key names and descriptions for palette screen
- Footer component renders different content per screen
- `getHintsForScreen('editor')` contains entries for `^T`, `^G`, `^E`
- `getHintsForScreen('capture')` contains entry for `^S`

**Dependencies:** `src/tui/components/Footer.js`, `src/types.js`

**Notes:** Strip ANSI before assertions on key/desc text presence. Import `formatHintEntry` and `formatHints` from Footer.

**Commit:** `test: update footer tests for badge-style hints`
