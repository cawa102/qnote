# Discussion Report: Fullscreen Layout & Animation

> **Date:** 2026-02-28
> **Design:** docs/plans/2026-02-28-fullscreen-layout-animation-design.md
> **Reviewers:** Devil's Advocate, Failure Analyst, Implementation Architect
> **Rounds:** 3

## Summary

The design proposes centered responsive layout, ASCII art title, and page-turning animation for the qnote TUI. The review reached strong consensus on **dropping continuous animation from MVP** (defer play-once to P1) due to 5+ independent failure modes it introduces. The core visual upgrade — responsive centered layout + static "QNOTE" ASCII title — delivers 80% of the visual impact at ~30% of the implementation risk. A critical version mismatch was discovered: the design assumes Ink 5 + React 18, but the project actually uses **Ink 6 + React 19**, requiring API verification before implementation. Additional consensus formed around CJK display-width handling, progressive height degradation, and non-TTY guards.

## Findings

### Critical (Design Change Required)

- **[All 3 Reviewers] Drop continuous animation from MVP scope**
  - Issue: Continuous 75ms setInterval loop introduces interval leaks on rapid screen switching, Ink re-render thrashing (13fps), TextInput cursor flickering, $EDITOR stdout corruption, and non-TTY ANSI garbage — 5+ independent failure modes for a cosmetic feature
  - Impact: Input lag, visual artifacts, terminal corruption, piped output corruption
  - Recommendation: Ship MVP with static ASCII art + centered layout only. Defer play-once animation to P1 with prerequisites: REDUCE_MOTION support, error boundary, non-TTY guard, no box-drawing chars, 4-6 frames max, verified Ink 6 compatibility
  - Consensus: Agreed 3/3

- **[Impl Architect] Version mismatch: Design assumes Ink 5 + React 18, project uses Ink 6 + React 19**
  - Issue: All code examples, API references, and architectural assumptions in the design doc are written for the wrong framework versions. Ink 6 has a rewritten reconciler; React 19 has different useEffect cleanup timing
  - Impact: Implementation will discover API mismatches ad-hoc, wasting time and introducing bugs
  - Recommendation: Verify Ink 6 API via Context7 docs before implementation. Rewrite design document's code examples for actual stack. This is a prerequisite to all tasks
  - Consensus: Agreed 3/3

- **[Devil's Advocate] Animation contradicts "Borderless design" principle**
  - Issue: CLAUDE.md states "Whitespace and indentation for structure, not box-drawing characters" but animation frames use ┌─┐│└┘ box-drawing characters
  - Impact: Violates stated design principle; confuses future contributors about which standard applies
  - Recommendation: If animation is ever added (P1), frames must use only block chars (█ ▀ ▄) and whitespace — no box-drawing
  - Consensus: Agreed 3/3

### Important (Must Address in Planning)

- **[All 3 Reviewers] CJK double-width characters break width calculation**
  - Issue: Japanese text (e.g., ノートを新規作成) occupies 2 terminal columns per char. Centering math and ruler width use character count, not display width
  - Recommendation: Add `string-width` package for all width calculations. Verify it works with tsup ESM build before depending on it

- **[All 3 Reviewers] Rename "QUEEN NOTE" to "QNOTE" in ASCII art**
  - Issue: CLI command is `qnote`, npm package is `qnote`, but banner says "QUEEN NOTE". Users searching for "queen note" find nothing
  - Recommendation: Title art should say "QNOTE" (~30 chars wide instead of ~50). Cascading benefit: reduces minimum terminal width requirement, simplifies narrow-terminal handling

- **[Devil's Advocate + Failure Analyst] Content width has no minimum guard**
  - Issue: `Math.min(termWidth - 8, 100)` produces 0 or negative values when terminal is ≤8 columns. Ink Box with negative width will break
  - Recommendation: `contentWidth = Math.max(20, Math.min(termWidth - 8, 100))`. Below minimum, show "terminal too small" or plain text fallback

- **[Failure Analyst + Impl Architect] Footer alignment gap**
  - Issue: Footer.tsx is rendered outside any centering wrapper in App.tsx. If CenteredLayout wraps only screen content, Footer stays left-aligned while content is centered
  - Recommendation: Wrap Footer in CenteredLayout too, or apply consistent padding at App level

- **[All 3 Reviewers] Progressive height degradation required**
  - Issue: Home screen needs ~26-28 rows but default terminal fallback is 24. Split-pane tmux setups often have 20 rows
  - Recommendation: Centralized `useLayout()` hook returning display tier: full (≥28 rows) → compact (≥18-20 rows, no animation/art) → minimal (text only, no decorations). Thresholds as constants

- **[Failure Analyst] Non-TTY guard for all visual decorations**
  - Issue: `qnote | cat` or CI environments have no TTY. Animation/art writes ANSI garbage to piped output
  - Recommendation: Gate animation, title art, and centering on `process.stdout.isTTY`. Skip all visual enhancements when piped

- **[Failure Analyst] No mechanism to disable animation for accessibility**
  - Issue: No --no-animation flag, no REDUCE_MOTION env var support, no screen reader detection
  - Recommendation: For P1 animation: check `REDUCE_MOTION` env var, respect `NO_COLOR`, add `--no-animation` CLI flag

- **[All 3 Reviewers] Resize handling needs debounce**
  - Issue: Rapid resize events cause stale dimension races between components reading process.stdout.columns at different times
  - Recommendation: Debounce resize events (~100ms). Use single source of truth for dimensions (state variable from debounced handler, not direct process.stdout reads)

- **[Failure Analyst R2 NEW-2] Recursive TUI restart accumulates signal handlers**
  - Issue: `bin/qnote.ts` recursive `startTui` calls add fresh SIGINT/SIGTERM handlers each cycle. If editor spawn throws between removeListener and recursive call, handlers accumulate
  - Recommendation: Use `process.once()` instead of `process.on()` for signal handlers, or hoist outside recursive function

- **[Failure Analyst R2 NEW-3] Animation/title assets loaded in CLI-only mode**
  - Issue: Hardcoded string assets are bundled and loaded even when qnote runs as CLI (`qnote search foo` — no TUI)
  - Recommendation: Lazy-load assets via dynamic `import()` only when TUI is launched

- **[Impl Architect] fullscreen-ink v0.1.0 compatibility risk**
  - Issue: Pre-1.0 semver means any minor bump can break. `^0.1.0` allows breaking changes
  - Recommendation: Pin to exact version `0.1.0` or vendor the dependency

### Minor (Note During Implementation)

- **[Devil's Advocate]** useTerminalSize should use Ink's `useStdout().stdout` rather than `process.stdout` directly, to respect Ink's stream configuration for testing. Check if Ink 6 provides reactive terminal dimensions built-in first
- **[Devil's Advocate]** No ASCII fallback for terminals without Unicode block character support. Detect via TERM env var or chalk level
- **[Devil's Advocate]** Animation/title colors not tested against light terminal themes. Cyan block characters on white background may be invisible
- **[Failure Analyst]** Trailing spaces in animation frames may be stripped by editors/linters. Pad programmatically, not with embedded whitespace
- **[Failure Analyst]** First render may use fallback dimensions before stdout is initialized. Accept `?? 80` fallback — cosmetic only
- **[Failure Analyst]** Math.floor rounding in centering creates 1-char asymmetry on odd-width terminals. Use Math.floor (left-bias) as intentional standard convention
- **[Failure Analyst]** Terminal state corruption after exception during animation. Add `\x1b[0m` (reset attributes) before alternate screen exit in `restoreTerminal()`
- **[Impl Architect]** Test harness for terminal size mocking should be established in Task 1 so subsequent tasks reuse the pattern
- **[Failure Analyst GAP-1]** No visual test strategy in design. Use ink-testing-library's `lastFrame()` with snapshot tests at specific terminal dimensions (80x24, 40x20, 120x40) to verify centering and layout, not just content presence

## Resolved Contested Items

| Item | Resolution | Votes | Key reasoning |
|------|-----------|-------|---------------|
| C1: TitleBanner separate vs inline | **Keep separate** | 3-0 (DA accepted) | Natural error boundary isolation point for P1 animation |
| C2: useContentWidth() hook vs inline | **Centralized hook (useLayout())** | 2-1 (DA compromise: plain function) | Prevents inconsistent width calculations across 6+ usage sites. DA's point about pure calculation is valid — final implementation may be hook wrapping a pure function |
| C3: CenteredLayout component vs App.tsx padding | **CenteredLayout component** | 3-0 (DA accepted) | 6+ usage points (5 screens + Footer); Footer alignment gap proves need for reusable wrapper |
| C4: Animation in P1: play-once vs drop | **Defer to P1 as play-once** | 2-1 (DA accepted) | Play-once eliminates 4 of 6 failure modes. Prerequisites documented for safe P1 implementation |
| C5: useLayoutMode() centralized hook | **Combined into useLayout()** | 3-0 | IA proposed `useLayout()` returning `{ contentWidth, showTitleArt, showAnimation }` with boolean flags instead of enum. FA and DA accepted with simplicity caveats |

## Recommended Implementation Order

**Pre-work (prerequisite to all tasks):**
- Verify Ink 6 + React 19 API via Context7 docs (A5)
- Verify `string-width` compatibility with tsup ESM build (A4)
- Rewrite design doc code examples for actual stack

**Phase 1 (parallel, no dependencies):**
1. **useLayout() hook** — terminal size + resize debounce + content width with min guard + display tier booleans + isTTY check
2. **"QNOTE" ASCII Title Art** — filled block chars, ~30 chars wide, width fallback to plain text, Unicode fallback

**Phase 2 (depends on Phase 1 Task 1):**
3. **CenteredLayout component** — uses useLayout() internally, string-width for CJK padding

**Phase 3 (depends on Phase 2 + Phase 1 Task 2):**
4. **Integration** — wrap all screens + Footer in CenteredLayout, add TitleBanner to CommandPalette, progressive height degradation, dynamic rulers, remove hardcoded padding

**Phase 4:**
5. **Polish** — manual testing, resize behavior, narrow/short terminal verification, snapshot tests

**Deferred to P1:**
- Play-once animation: 4-6 frames, no box-drawing, REDUCE_MOTION/NO_COLOR support, error boundary, Ink 6 verified

```
Pre-work (verify Ink 6 + string-width)
        |
Phase 1: Task 1 (useLayout) ----> Phase 2: Task 2 (CenteredLayout) ----> Phase 3: Task 7 ----> Phase 4: Task 8
         Task 3 (titleArt)  ------------------------------------------>  Task 7                  (Integration)   (Polish)
```

Critical path: Pre-work → Task 1 → Task 2 → Task 7 → Task 8

## Edge Cases & Failure Scenarios

| Scenario | Likelihood | Impact | Mitigation |
|----------|-----------|--------|------------|
| Terminal < 50 columns (ASCII title wraps) | M | M | Min width guard + plain text fallback at < 40 cols |
| Terminal height < 24 rows | M | M | Progressive degradation: full → compact → minimal |
| Non-TTY piped output (`qnote \| cat`) | M | H | Gate all visual decorations on `process.stdout.isTTY` |
| CJK text overflows content boundary | H | M | `string-width` package for all width calculations |
| SIGWINCH during render | M | M | Debounce resize events ~100ms, single dimension source |
| $EDITOR spawn while animation running (P1) | H | H | Set active=false before unmount; play-once self-terminates |
| setInterval leak on rapid screen toggle (P1) | H | M | useRef for interval ID; play-once = self-terminating |
| Unicode block chars unsupported | L | M | Plain text "qnote" fallback via TERM/chalk level check |
| Recursive startTui accumulates signal handlers | M | M | Use `process.once()` or hoist handlers outside recursion |
| Terminal state corruption on uncaught exception | L | H | Add `\x1b[0m` reset in `restoreTerminal()` |
| Ink 6 API differs from design assumptions | H | H | Verify via Context7 before implementation (pre-work) |
| fullscreen-ink breaking change in 0.x bump | L | H | Pin to exact version 0.1.0 |

## Open Questions

- **Ink 6 useStdout() API**: Does Ink 6 provide reactive terminal dimensions? If yes, useLayout() hook may be significantly simpler. Must verify via Context7 docs before Task 1.
- **string-width build compatibility**: string-width v7+ is ESM-only. Need to verify it bundles correctly with tsup config before depending on it in production code.
- **Left-bias vs right-bias centering**: Math.floor produces left-bias on odd-width terminals. Is this acceptable? (Recommended: yes, standard convention, document as intentional.)
