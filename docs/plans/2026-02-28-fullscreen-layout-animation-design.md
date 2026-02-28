# Fullscreen Responsive Layout Design

## Problem

The fullscreen TUI currently renders text at a fixed small size without adapting to the terminal dimensions. The Command Palette home screen lacks visual impact — just "qnote" followed by a dimmed ruler.

## Goals

1. **Center-aligned responsive layout** across all screens using terminal dimensions
2. **ASCII art title** for "QUEEN NOTE" in filled block-style font (Copilot CLI-inspired)
3. **Dynamic ruler and content width** based on terminal size
4. **Progressive degradation** for small terminals and non-TTY environments

## Decisions (from Team Discussion 2026-02-28)

| Decision | Rationale |
|----------|-----------|
| Animation permanently removed | 5+ independent failure modes for a cosmetic feature (interval leaks, re-render thrashing, TextInput conflict, $EDITOR corruption, non-TTY garbage) |
| Keep "QUEEN NOTE" naming | User preference — brand name takes priority over CLI name |
| CenteredLayout as component | 6+ usage points (5 screens + Footer); prevents misalignment bugs |
| useLayout() centralized hook | Single source of truth for dimensions, degradation flags, isTTY |
| TitleBanner as separate component | Natural error boundary isolation point |
| Borderless design respected | Only block chars (█ ▀ ▄ ▌ ▐) — no box-drawing (┌ ─ ┐ │ └ ┘) |

See: `docs/discussions/2026-02-28-fullscreen-layout-animation-discussion.md`

## Actual Tech Stack

| Area | Package | Version |
|------|---------|---------|
| TUI Framework | ink | ^6.8.0 |
| React | react | ^19.2.4 |
| Fullscreen | fullscreen-ink | 0.1.0 (pin exact) |
| String width | string-width | 8.2.0 (transitive via ink) |
| Coloring | chalk | ^5.6.2 |
| Test | vitest + ink-testing-library | ^4.0.18 / ^4.0.0 |

**Ink 6 API notes (verified via Context7):**
- `useStdout()` returns `{ stdout }` — raw stream only, NOT reactive dimensions
- Custom `useLayout()` hook needed for reactive terminal size (useState + useEffect + resize listener)
- `Box` supports `paddingLeft`, `paddingRight`, `paddingX`, `width` (absolute or %)
- `render()` supports `maxFps: 30` option for performance control

## Design

### Home Screen (CommandPalette)

```
┌────────────────── Terminal Full Width ──────────────────┐
│                                                         │
│           █▀▀█  █  █ █▀▀▀ █▀▀▀ █▄ █                    │
│           █  █  █  █ █    █    ██▄█                     │
│           █  █  █  █ █▀▀  █▀▀  █ ▀█                    │
│           █▄▄█  █  █ █    █    █  █                     │
│           ▀▀▀▀  ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀  ▀                    │
│                   N O T E                               │
│                                                         │
│           ─────────────────────────                     │
│                                                         │
│           ● New note       ノートを新規作成               │
│           ○ Search         ノートを全文検索               │
│           ○ Daily          今日のデイリーノート            │
│           ○ Recent         最近のノート一覧               │
│           ○ Capture        素早くメモをキャプチャ          │
│           ○ Tags           タグで一覧表示                 │
│                                                         │
│  Enter select   Esc quit                                │
└─────────────────────────────────────────────────────────┘
```

### Title Specification

- Style: Filled block characters (█ ▀ ▄) — NOT skeleton/outline, NOT box-drawing
- "QUEEN" in block font (5 rows tall, ~30 chars wide)
- "NOTE" below in spaced letters
- Size: ~50 chars wide × 5-6 rows tall
- Color: Theme `accent` color (cyan) applied to block characters
- Fallback: Plain text "Queen Note" when terminal < 60 columns or non-TTY

### Center-Aligned Responsive Layout (All Screens)

#### useLayout() Hook

Single source of truth for all layout decisions:

```typescript
interface LayoutInfo {
  readonly columns: number;
  readonly rows: number;
  readonly contentWidth: number;
  readonly isTTY: boolean;
  readonly showTitleArt: boolean;  // false when cols < 60 or rows < 20
}
```

Computed values:
- `contentWidth = Math.max(20, Math.min(columns - 8, 100))`
- `showTitleArt = isTTY && columns >= 60 && rows >= 20`
- Resize events debounced at ~100ms
- Fallback: 80×24 when stdout dimensions unavailable

#### Layout Rules

| Property | Value |
|----------|-------|
| Content max width | `Math.max(20, Math.min(columns - 8, 100))` |
| Horizontal padding | `Math.floor((columns - contentWidth) / 2)` (left-bias on odd widths) |
| Top padding | 1-2 rows |
| Ruler width | Dynamic: matches contentWidth |
| Footer | Wrapped in CenteredLayout for consistent alignment |

#### Per-Screen Changes

- **CommandPalette**: Add TitleBanner header (static art), center menu items
- **NoteList**: Center list items, dynamic ruler width
- **NotePreview**: Center content, dynamic ruler width
- **SearchScreen**: Center search input and results, dynamic ruler width
- **CaptureScreen**: Center capture input, dynamic ruler width

### CenteredLayout Component

```typescript
interface CenteredLayoutProps {
  readonly children: React.ReactNode;
  readonly maxWidth?: number;  // default: 100
}
```

Uses `useLayout()` internally. Wraps children in `<Box paddingLeft={computed} width={contentWidth}>`.

### TitleBanner Component

```typescript
interface TitleBannerProps {
  readonly contentWidth: number;
}
```

Renders the "QUEEN NOTE" block art or plain text fallback based on contentWidth. Wrapped in a React error boundary for resilience.

### File Structure

```
src/tui/
  assets/
    title-art.ts           # Block-style "Queen Note" ASCII art
  hooks/
    use-layout.ts          # Reactive terminal size + layout decisions
  components/
    CenteredLayout.tsx     # Responsive center-alignment wrapper
    TitleBanner.tsx         # Title art with width fallback
```

### Progressive Degradation

| Condition | Behavior |
|-----------|----------|
| cols ≥ 60, rows ≥ 20 | Full display: block art title + centered content |
| cols < 60 or rows < 20 | Compact: plain text "Queen Note" header + centered content |
| cols < 28 or !isTTY | Minimal: no decorations, left-aligned content |

### Non-TTY Guard

When `!process.stdout.isTTY` (piped output, CI):
- Skip all visual decorations (title art, centering)
- Render content left-aligned, no ANSI color on block art

### Bug Fixes (from Discussion)

1. **restoreTerminal()**: Add `\x1b[0m` (reset attributes) before alternate screen exit
2. **Signal handlers**: Use `process.once()` instead of `process.on()` in startTui to prevent accumulation
3. **fullscreen-ink**: Pin to exact `0.1.0` (not `^0.1.0`) to prevent breaking changes

## References

- [GitHub Copilot CLI ASCII Banner Engineering](https://github.blog/engineering/from-pixels-to-characters-the-engineering-behind-github-copilot-clis-animated-ascii-banner/)
- LazyVim: Centered home screen with ASCII art logo + menu items below
- Discussion report: `docs/discussions/2026-02-28-fullscreen-layout-animation-discussion.md`
