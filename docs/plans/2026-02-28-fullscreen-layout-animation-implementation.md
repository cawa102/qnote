# Fullscreen Responsive Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a responsive center-aligned layout to all TUI screens with a static "QUEEN NOTE" ASCII art title on the home screen, progressive degradation for small/non-TTY terminals, and CJK-aware width calculations.

**Architecture:** A centralized `useLayout()` hook provides reactive terminal dimensions, content width, and display-tier flags. A `CenteredLayout` wrapper component centers content horizontally on every screen (including Footer). The home screen gets a `TitleBanner` component rendering static block-art. All hardcoded ruler widths become dynamic. Animation is permanently excluded from scope.

**Tech Stack:** React 19, Ink 6, chalk 5, string-width 8 (transitive via ink), Vitest

**Key context:** See `docs/plans/2026-02-28-fullscreen-layout-animation-design.md` for design decisions and `docs/discussions/2026-02-28-fullscreen-layout-animation-discussion.md` for rationale.

---

- [x] Task 0: Bug Fixes & Dependency Pinning

**Files:**
- Modify: `bin/qnote.ts:28-44` — fix signal handler accumulation
- Modify: `src/tui/utils/terminal.ts:10-12` — add ANSI reset to restoreTerminal
- Modify: `package.json:29` — pin fullscreen-ink to exact version
- Test: `test/tui/terminal.test.ts` — add test for reset sequence in restoreTerminal

**What:** Fix three bugs identified in the team discussion before adding new features.

**Changes:**
- `restoreTerminal()`: Write `\x1b[0m` (reset all attributes) before `\x1b[?1049l\x1b[?25h`
- `startTui()`: Replace `process.on('SIGINT', ...)` with `process.once('SIGINT', ...)` (same for SIGTERM, uncaughtException) to prevent handler accumulation on recursive TUI restart after $EDITOR
- `package.json`: Change `"fullscreen-ink": "^0.1.0"` to `"fullscreen-ink": "0.1.0"` (exact pin)

**Test scenarios:**
- restoreTerminal output includes `\x1b[0m` reset sequence
- restoreTerminal output includes alternate screen exit sequence
- restoreTerminal output includes cursor show sequence

**Dependencies:** None

**Commit:** `fix: prevent signal handler accumulation and add terminal reset`

---

- [x] Task 1: useLayout() Hook

**Files:**
- Create: `src/tui/hooks/use-layout.ts`
- Test: `test/tui/use-layout.test.ts`

**What:** A React hook that returns reactive terminal dimensions, computed content width, and display-tier flags. Single source of truth for all layout decisions.

**Interface:**
```typescript
interface LayoutInfo {
  readonly columns: number;
  readonly rows: number;
  readonly contentWidth: number;
  readonly isTTY: boolean;
  readonly showTitleArt: boolean;
}

function useLayout(maxWidth?: number): LayoutInfo;
```

- `columns`/`rows`: from `process.stdout.columns`/`rows` with `?? 80`/`?? 24` fallback
- `contentWidth`: `Math.max(20, Math.min(columns - 8, maxWidth ?? 100))`
- `isTTY`: `process.stdout.isTTY ?? false`
- `showTitleArt`: `isTTY && columns >= 60 && rows >= 20`
- Resize: `useState` + `useEffect` with `process.stdout.on('resize', handler)`, debounced ~100ms
- Cleanup: removes resize listener on unmount

**Test scenarios:**
- Returns default 80×24 with contentWidth=72 when stdout dimensions undefined
- Returns actual dimensions when available
- contentWidth respects maxWidth parameter
- contentWidth has minimum of 20 (never 0 or negative)
- showTitleArt is false when columns < 60
- showTitleArt is false when rows < 20
- showTitleArt is false when not TTY
- Re-renders on terminal resize event (debounced)
- Cleanup removes resize listener on unmount

**Dependencies:** `react`, `ink` (useStdout for stream reference in tests)

**Notes:** Ink 6's `useStdout()` returns `{ stdout }` only — no reactive dimensions. We need the custom hook. Use `useStdout().stdout` instead of `process.stdout` directly to respect Ink's stream configuration for testability. Debounce via a `setTimeout`/`clearTimeout` pattern — no external debounce library needed.

**Commit:** `feat: add useLayout hook for responsive terminal layout`

---

- [x] Task 2: CenteredLayout Component

**Files:**
- Create: `src/tui/components/CenteredLayout.tsx`
- Test: `test/tui/centered-layout.test.ts`

**What:** A wrapper component that horizontally centers children within the terminal, using `useLayout()` for dimensions.

**Interface:**
```typescript
interface CenteredLayoutProps {
  readonly children: React.ReactNode;
  readonly maxWidth?: number; // default: 100
}
```

- Computes `paddingLeft = Math.floor((columns - contentWidth) / 2)` using `useLayout(maxWidth)`
- When `!isTTY`: renders children with no padding (left-aligned)
- Wraps in `<Box paddingLeft={paddingLeft}>` with children inside a `<Box width={contentWidth}>`

**Test scenarios:**
- Centers content with correct padding for a given terminal width
- Respects maxWidth prop
- Falls back to no padding when terminal is very narrow (contentWidth = minimum 20)
- Children render without modification
- No padding applied when isTTY is false

**Dependencies:** `react`, `ink`, `./use-layout`

**Notes:** Uses `useLayout()` internally. The centering math uses `Math.floor` intentionally — left-bias on odd-width terminals is the documented convention. Establish terminal-size mocking pattern in tests here so Task 4 can reuse it.

**Commit:** `feat: add CenteredLayout component for responsive centering`

---

- [x] Task 3: "QUEEN NOTE" ASCII Title Art

**Files:**
- Create: `src/tui/assets/title-art.ts`
- Test: `test/tui/title-art.test.ts`

**What:** A module exporting the "QUEEN NOTE" title as filled-block ASCII art. Uses only block characters (█ ▀ ▄ ▌ ▐) — NO box-drawing characters (┌─┐│└┘) per borderless design principle.

**Interface:**
- `TITLE_ART: readonly string[]` — array of 5-6 strings (one per row for "QUEEN"), each ~30 chars wide. Block characters only
- `TITLE_SUBTITLE: string` — "N O T E" in spaced letters
- `TITLE_WIDTH: number` — display width of widest line (using string-width for CJK safety)
- `colorizeTitle(lines: readonly string[], subtitle: string): string` — applies theme `accent` color to block chars, returns full colored string joined by newlines

**Test scenarios:**
- TITLE_ART has 5-6 rows
- All rows have consistent display width (measured with string-width)
- TITLE_WIDTH matches the widest row's display width
- TITLE_WIDTH is between 25 and 55 characters
- colorizeTitle returns a non-empty string
- colorizeTitle output contains ANSI color codes when chalk level >= 1
- Art contains only block characters (█ ▀ ▄ ▌ ▐), spaces, and no box-drawing characters

**Dependencies:** `chalk`, `string-width`, `../../theme/colors`

**Notes:** Design using half-block characters for a filled, solid look (NOT outline/skeleton). `string-width` is available as transitive dep via ink (v8.2.0, ESM-only). Import it directly — since the project is ESM-only and tsup bundles it, no config changes needed. Add `string-width` to `dependencies` in package.json for explicitness.

**Commit:** `feat: add Queen Note block-art title asset`

---

- [x] Task 4: TitleBanner Component

**Files:**
- Create: `src/tui/components/TitleBanner.tsx`
- Test: `test/tui/title-banner.test.ts`

**What:** A component that renders the "QUEEN NOTE" block art title or a plain text fallback, based on available width. Wrapped in a React error boundary.

**Interface:**
```typescript
interface TitleBannerProps {
  readonly contentWidth: number;
  readonly showTitleArt: boolean;
}
```

- When `showTitleArt && contentWidth >= TITLE_WIDTH`: render colorized block art + subtitle
- When `!showTitleArt || contentWidth < TITLE_WIDTH`: render plain `theme.bold('Queen Note')` as fallback
- Wraps the art rendering in a React error boundary — if rendering throws, falls back to plain text silently

**Test scenarios:**
- Renders block art when showTitleArt=true and contentWidth is sufficient
- Renders plain text "Queen Note" when showTitleArt=false
- Renders plain text when contentWidth < TITLE_WIDTH
- Error boundary catches rendering errors and falls back to plain text
- Title text is present in output (either art or plain)

**Dependencies:** `react`, `ink`, `../assets/title-art`

**Notes:** The error boundary is a simple class component wrapping TitleBanner's content. This provides the isolation point identified in the discussion — if title rendering ever fails, CommandPalette stays functional.

**Commit:** `feat: add TitleBanner component with width fallback`

---

- [x] Task 5: Integrate CenteredLayout into All Screens

**Files:**
- Modify: `src/tui/App.tsx:179-228` — wrap screen content AND Footer in CenteredLayout
- Modify: `src/tui/screens/CommandPalette.tsx` — remove `padding={1}`, add TitleBanner, dynamic ruler
- Modify: `src/tui/screens/NoteList.tsx:46` — remove `padding={1}`, dynamic ruler via useLayout
- Modify: `src/tui/screens/NotePreview.tsx:90-91` — remove `padding={1}`, dynamic rulers
- Modify: `src/tui/screens/SearchScreen.tsx:87,92` — remove `padding={1}`, dynamic ruler
- Modify: `src/tui/screens/CaptureScreen.tsx:114-115` — remove `padding={1}`, dynamic ruler
- Modify: `src/tui/components/Footer.tsx` — no change needed (wrapped by CenteredLayout in App.tsx)
- Test: existing screen tests may need minor updates for removed padding

**What:** Wrap the screen content area AND Footer in `<CenteredLayout>` in App.tsx. Update each screen to remove hardcoded `padding={1}` (CenteredLayout handles centering). Replace fixed-width rulers with dynamic widths from `useLayout().contentWidth`.

**Per-screen changes:**

- **App.tsx**: Wrap `<Box flexDirection="column" flexGrow={1}>` (screens) in `<CenteredLayout>`. Also wrap `<Footer>` in a separate `<CenteredLayout>` for consistent alignment.

- **CommandPalette.tsx**:
  - Remove `padding={1}` from outer Box
  - Replace `theme.bold('qnote')` + `formatRuler(30)` header with `<TitleBanner contentWidth={contentWidth} showTitleArt={showTitleArt} />` + `formatRuler(contentWidth)`
  - Get `{ contentWidth, showTitleArt }` from `useLayout()`

- **NoteList.tsx**:
  - Remove `padding={1}` from outer Box
  - Replace `formatRuler(30)` with `formatRuler(contentWidth)` via `useLayout()`

- **NotePreview.tsx**:
  - Remove `padding={1}` from outer Box
  - Replace `formatRuler(40)` (×2 occurrences) with `formatRuler(contentWidth)` via `useLayout()`

- **SearchScreen.tsx**:
  - Remove `padding={1}` from outer Box
  - Replace `formatRuler(35)` with `formatRuler(contentWidth)` via `useLayout()`

- **CaptureScreen.tsx**:
  - Remove `padding={1}` from outer Boxes (×2: main view + saved view)
  - Replace `formatRuler(20)` with `formatRuler(contentWidth)` via `useLayout()`

**Test scenarios:**
- CommandPalette renders TitleBanner (title text visible in output)
- All screens render without hardcoded padding
- Rulers span contentWidth instead of fixed values
- Footer displays at bottom with consistent alignment
- Existing keyboard interactions still work (no behavioral regressions)
- CaptureScreen saved state still renders correctly

**Dependencies:** Tasks 1-4

**Notes:** This is the integration task touching 7 files. Modify one screen at a time and run tests after each to catch regressions early. The key insight: CenteredLayout wraps both the screen content area AND Footer separately in App.tsx — this ensures consistent horizontal alignment (Footer alignment gap fix from discussion).

**Commit:** `feat: integrate CenteredLayout and TitleBanner across all screens`

---

- [x] Task 6: Visual Testing & Polish

**Files:**
- Create: `test/tui/layout-snapshots.test.ts` — snapshot tests at specific terminal sizes
- Modify: Any files needing visual tweaks based on testing

**What:** Add snapshot-based visual tests and manually verify the layout. Test centering, progressive degradation, and CJK alignment at multiple terminal sizes.

**Snapshot test fixtures:**
- 80×24 (standard terminal)
- 40×20 (compact mode — no title art)
- 120×40 (wide terminal)
- 25×15 (minimal mode — very small)

**Test scenarios:**
- CommandPalette snapshot at 80×24 shows centered block art title
- CommandPalette snapshot at 40×20 shows plain text title (compact mode)
- NoteList snapshot at 80×24 shows centered content with dynamic ruler
- Content is not centered when isTTY=false (non-TTY snapshot)
- All snapshots match golden files (regression detection)

**Manual verification checklist:**
- [ ] `npm run build && node bin/qnote.ts` launches with centered layout
- [ ] Home screen shows QUEEN NOTE block art (or fallback on small terminals)
- [ ] Resizing terminal dynamically re-centers content
- [ ] All screens (NoteList, NotePreview, Search, Capture) are centered
- [ ] Rulers span the content width
- [ ] Footer displays with consistent alignment
- [ ] Keyboard navigation works on all screens
- [ ] `npm run test:coverage` shows 80%+ coverage

**Dependencies:** Task 5

**Notes:** Use ink-testing-library's `lastFrame()` to capture rendered output as strings. Assert on content position (padding), not just presence. For terminal size mocking, reuse the pattern established in Task 1/Task 2 tests (vi.spyOn on process.stdout.columns/rows getters).

**Commit:** `feat: add layout snapshot tests and visual polish`

---

## Dependency Graph

```
Task 0 (bugfixes) ─────────────────────────────────────────────────────────┐
                                                                            │
Task 1 (useLayout) ──→ Task 2 (CenteredLayout) ──→ Task 5 (Integration) ──→ Task 6 (Polish)
                                                      ↑
Task 3 (titleArt) ──→ Task 4 (TitleBanner) ───────────┘
```

**Phase 1 (parallel):** Tasks 0, 1, 3
**Phase 2 (parallel):** Tasks 2 (depends on 1), 4 (depends on 3)
**Phase 3:** Task 5 (depends on 0, 2, 4)
**Phase 4:** Task 6 (depends on 5)

**Critical path:** Task 1 → Task 2 → Task 5 → Task 6
