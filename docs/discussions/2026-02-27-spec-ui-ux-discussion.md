# Discussion Report: qnote Spec & UI/UX Design Review

> **Date:** 2026-02-27
> **Design Documents:**
> - `docs/spec.md` — Full specification
> - `docs/plans/2026-02-27-ui-ux-design.md` — UI/UX design
> - `docs/plans/2026-02-27-qnote-mvp-implementation.md` — Implementation plan
> **Reviewers:** Devil's Advocate, Failure Analyst, Implementation Architect
> **Rounds:** 3

## Summary

The review identified **15 critical design changes**, **8 important planning items**, and **5 contested items** that were resolved through 3 rounds of structured discussion. The most severe findings center on three themes: (1) the storage layer has fundamental flaws for Japanese text — slugify strips CJK characters, FTS5 can't segment Japanese, and backlink detection via FTS is impossible due to bracket stripping; (2) the TUI layer has architectural gaps — modal input system needed, Markdown rendering unimplemented, capture editor overengineered; (3) several data integrity risks exist — slug collisions cause silent data overwrite, no atomic writes, no $EDITOR fallback chain. All contested items reached resolution, with key decisions to keep better-sqlite3, show recent notes below the command palette, drop inline #tag extraction for MVP, implement Markdown rendering, and use CJK-aware slugify.

---

## Findings

### Critical (Design Change Required)

1. **[DA+FA] Slugify catastrophically broken for Japanese (CJK)**
   - Issue: `replace(/[^\w\s-]/g, '')` strips ALL non-ASCII characters. "API設計方針" → `api.md`. Multiple Japanese notes produce empty or colliding slugs. This is a total failure for the target audience (Japanese developers).
   - Impact: Day-one functionality broken. Cannot create notes with Japanese titles.
   - Recommendation: Use Unicode letter property `/[\p{L}\p{N}\s-]/gu` to preserve CJK characters in filenames. Add NFC normalization (`String.prototype.normalize('NFC')`) before writing.
   - Consensus: 3/3 Agreed

2. **[FA] Slug collision causes silent data overwrite**
   - Issue: "API Design" and "api design" both produce `api-design.md`. Second note silently destroys the first.
   - Impact: Data loss — the single most dangerous vector in the current design.
   - Recommendation: Check file existence before writing. On collision, append numeric suffix (`api-design-2.md`). Guard empty slugs with timestamp fallback.
   - Consensus: 3/3 Agreed

3. **[IA] FTS5 [[bracket]] stripping breaks backlinks**
   - Issue: FTS5 tokenizer strips `[[` and `]]` as punctuation during indexing. Searching for `[[auth-flow]]` via FTS MATCH to find backlinks is fundamentally impossible.
   - Impact: Backlinks — a P0 feature and one of qnote's three core values ("knowledge navigator") — silently do not work.
   - Recommendation: Add dedicated `links` table (`source_path`, `target_slug`, `target_text`) populated during indexing. Query this table for backlinks instead of FTS.
   - Consensus: 3/3 Agreed

4. **[DA] FTS5 unicode61 tokenizer can't segment Japanese text**
   - Issue: `unicode61` tokenizes by word boundaries. Japanese has no spaces between words. "認証" inside "API認証のフロー" won't match.
   - Impact: Core search feature broken for Japanese text.
   - Recommendation: Use `tokenize='trigram'` for the FTS5 table. Trigram works for all languages including CJK. Trade-off: ~3x larger index, some noise on very short queries. Add minimum query length (2 chars CJK, 3 chars Latin).
   - Consensus: 3/3 Agreed

5. **[DA+IA+FA] Capture mini-editor is overengineered**
   - Issue: Multi-line text editing in Ink requires building cursor positioning, text wrapping, scrolling, selection, and keyboard handling from scratch. `@inkjs/ui` TextInput is single-line only. Additional issues: `Ctrl+S` conflicts with terminal flow control.
   - Impact: Massive implementation effort for a "quick capture" feature, high bug surface area.
   - Recommendation: Delegate capture to `$EDITOR` with pre-filled template in inbox directory (consistent with `qnote new` / `qnote edit`), or use single-line TextInput for truly quick captures.
   - Consensus: 3/3 Agreed

6. **[DA+FA] `modified` auto-update has no mechanism**
   - Issue: Editing delegates to `$EDITOR` but no file watcher exists and no mtime check is planned. qnote cannot detect when the user saves a file in their editor.
   - Impact: `listRecent()` sorting is stale. User edits their most important note, returns to TUI, and it's buried in the list.
   - Recommendation: Check file mtime after `$EDITOR` child process returns. If changed, re-parse frontmatter, update `modified` field, re-write file, re-index. ~20 lines in CLI commands and NotePreview's onEdit handler.
   - Consensus: 3/3 Agreed

7. **[DA+FA+IA] TUI requires modal input system**
   - Issue: Global shortcuts (`q` quit, `c` capture, `/` search, `:` palette) conflict with text input fields. Typing `q` in the search field exits the app. Ink's `useInput` is global — no built-in focus management.
   - Impact: Every screen with text input (palette, search, capture) is broken for basic typing.
   - Recommendation: Add `isTextInputActive` flag or `useInputMode('navigation' | 'text')` hook as a foundational TUI task. Disable all single-key shortcuts when TextInput is focused. Only `Esc` and `Ctrl+` combos work in text input mode.
   - Consensus: 3/3 Agreed

8. **[FA] $EDITOR fallback chain needed**
   - Issue: No fallback if `$EDITOR` is unset or points to a non-existent binary. Core editing workflow completely broken.
   - Impact: User creates a note but can never edit it.
   - Recommendation: Check `$VISUAL` → `$EDITOR` → `vi` → `nano`. Validate binary exists with `which` before spawning. Show clear error if none found.
   - Consensus: 3/3 Agreed

9. **[FA+IA] FTS5 query syntax injection**
   - Issue: User input like `"api*` (unbalanced quote) causes FTS5 MATCH to throw an exception, crashing the TUI.
   - Impact: Any user search with special characters crashes the app.
   - Recommendation: Sanitize/escape FTS5 special characters (`*`, `"`, `NEAR`, `OR`, etc.) in SearchIndex.search(). Wrap queries in try-catch as a safety net.
   - Consensus: 3/3 Agreed

10. **[DA+IA] marked + marked-terminal installed but rendering not implemented**
    - Issue: NotePreview renders plain text, but spec requires proper Markdown rendering (success criterion 8.1).
    - Impact: Users see `# Heading` as literal text. The preview screen is just `cat` with extra steps.
    - Recommendation: Implement Markdown rendering using `marked` + `marked-terminal` in NotePreview. Scope boundary: headings, bold, italic, lists, code blocks, horizontal rules. No syntax highlighting or table rendering for MVP. Fallback to raw Markdown with notice if rendering fails.
    - Consensus: 3/3 Agreed to IMPLEMENT (see Contested Item C4 resolution)

11. **[IA] Daily note deduplication missing**
    - Issue: `qnote daily` always calls `service.create()`. Running it twice creates a duplicate or overwrites.
    - Impact: Data loss or confusing duplicate files.
    - Recommendation: Check if file at expected path (`daily/YYYY-MM-DD.md`) exists. If so, open in `$EDITOR` instead of creating.
    - Consensus: 3/3 Agreed

12. **[FA] Atomic file writes needed**
    - Issue: Direct `writeFile()` on disk full produces truncated/empty files = data loss.
    - Impact: Existing good note overwritten with partial content.
    - Recommendation: Write to temp file first, then atomic `rename()`. Apply to NoteRepository.create() and all write paths.
    - Consensus: 3/3 Agreed

13. **[FA] Graceful TUI shutdown on uncaught exceptions**
    - Issue: Unhandled exception while Ink has terminal in raw mode leaves terminal broken — no echo, no line editing, no Ctrl+C.
    - Impact: User must close terminal tab entirely.
    - Recommendation: Add top-level `process.on('uncaughtException')` and `process.on('unhandledRejection')` that restore terminal state (`setRawMode(false)`, restore cursor), print error, and exit. ~10 lines.
    - Consensus: Raised in R3 by FA, no objections

14. **[DA+FA] Wikilink resolution function completely missing**
    - Issue: Link parser extracts `{ target: 'auth-flow' }` from `[[auth-flow]]`, but no function resolves this to an actual file path. Resolution needed for: Vimium link jumping, backlink table population, dead link detection.
    - Impact: The entire wikilink feature — one of qnote's three core values — is hollow without resolution.
    - Recommendation: Add `resolveWikiLink(target: string): string | null` to NoteService. Resolution order: (1) exact title match, (2) slug match, (3) case-insensitive match. Unresolved = dead link with visual indication. Add as part of Task 8 or new Task 8.5.
    - Consensus: DA and FA raised independently in R3

15. **[IA] Running `qnote` without `qnote init` crashes**
    - Issue: `new Database(dbPath)` throws `SQLITE_CANTOPEN` when `~/notes/.qnote/` doesn't exist.
    - Impact: First-time user experience is a crash.
    - Recommendation: Auto-create `.qnote/` directory and notes directory in constructors. Make `qnote init` optional (for customization, not required setup). ~3 lines each in SearchIndex and NoteService.
    - Consensus: Raised in R3 by IA, no objections

### Important (Must Address in Planning)

1. **[DA] Overlay in Ink doesn't exist**
   - Issue: No z-index or modal layer. UI/UX doc says "overlay" but Ink can't render one.
   - Recommendation: Treat command palette as stack push. Update UI/UX doc language. Implementation plan already handles this correctly.

2. **[DA] Vimium 10+ link numbering is YAGNI**
   - Issue: `g` + 2-digit input adds complexity with timeout ambiguity for a rare edge case.
   - Recommendation: MVP supports 1-9 link jumps only. Selection list for 10+ links if needed.

3. **[DA] Animations impossible in Ink**
   - Issue: No opacity, transitions, or fade support in terminal rendering.
   - Recommendation: Drop all animation references from UI/UX doc. Screen switches are instant.

4. **[IA] NavigationStore params type too loose**
   - Issue: `Record<string, unknown>` allows runtime type errors.
   - Recommendation: Use discriminated union: `{ screen: 'notePreview'; filePath: string } | { screen: 'noteList'; filter?: string } | ...`

5. **[IA] Error types / error boundary architecture missing**
   - Issue: Plan has zero error handling architecture across layers.
   - Recommendation: Define typed errors in `types.ts` (Task 2). Storage layer throws typed errors, core layer catches and returns user-friendly errors, TUI layer displays errors, CLI layer prints to stderr.

6. **[FA] Concurrent access (SQLITE_BUSY)**
   - Issue: TUI + CLI simultaneously causes SQLITE_BUSY without timeout.
   - Recommendation: Add `this.db.pragma('busy_timeout = 5000')` in SearchIndex constructor.

7. **[FA+IA] Reindex should be wrapped in transaction**
   - Issue: Partial failure leaves index half-populated with no indication.
   - Recommendation: Wrap in `db.transaction()`. On error, rollback and report which files failed.

8. **[IA] FTS5 tokenizer spike needed before implementation**
   - Issue: Tokenization strategy (trigram) is the highest-risk decision for the storage layer.
   - Recommendation: Add Task 4.5 spike to verify trigram tokenizer works correctly with Japanese text and wikilink syntax before committing to the approach.

### Minor (Note During Implementation)

1. **[DA] Config includes sync settings for unimplemented P1 feature** — Remove sync config from MVP schema.
2. **[DA] `qnote links` CLI command is niche** — Defer to P1. Links visible in note preview only.
3. **[DA] Template variable expansion over-scoped** — Use `string.replace()` for `{{date}}` and `{{title}}` only. No template engine.
4. **[DA] macOS-only restriction is artificial** — Say "tested on macOS" instead. Everything is cross-platform.
5. **[FA] Config file corruption** — Validate JSON, fallback to defaults, warn user.
6. **[FA] Empty collection / first-use UX** — Show "No notes yet. Press `n` to create your first note." in empty states.
7. **[FA] Malformed frontmatter** — Graceful degradation to empty metadata. Never crash, never skip files.
8. **[FA] Notes without frontmatter** — Fallback to first `# heading` as title, or filename sans extension.
9. **[FA] Dead wikilinks** — Visual distinction (dimmed) for links to non-existent notes. Low priority for MVP.
10. **[IA] `qnote edit <query>` in spec but not in plan** — Explicitly descope from MVP. Document as P1.
11. **[FA] Search debounce** — Debounce incremental search input by 150-200ms to prevent SQLite thrashing with trigram tokenizer.
12. **[IA] Verify Ink + $EDITOR terminal cycling** — Manual test during Task 15 integration to confirm Ink resumes cleanly after spawning editor.

---

## Contested Items — Final Resolution

### C1. better-sqlite3 vs fuse.js for MVP

| Reviewer | Final Position |
|----------|---------------|
| Devil's Advocate | COMPROMISE: Replace with `sql.js` (wasm-based SQLite) |
| Failure Analyst | MAINTAIN: Keep `better-sqlite3` |
| Impl Architect | MAINTAIN: Keep `better-sqlite3` (sql.js as fallback) |

**Resolution: Keep `better-sqlite3` for MVP (2/3 majority).**

Rationale: Performance contract (1000 notes < 100ms) is non-negotiable. fuse.js fails this with O(n) in-memory scanning. Architecture rewrite (Tasks 5, 8, 22) is too expensive. Installation risk is manageable with prebuild binaries on macOS. If installation proves problematic in practice, `sql.js` (wasm) is the documented fallback path — same API, zero native dependencies, acceptable performance trade-off.

Action items:
- Add clear error message on better-sqlite3 installation failure (FA finding)
- Document `sql.js` as fallback option if native module issues arise
- Verify prebuild binary works on macOS in Task 1

### C2. Command palette vs recent notes as home screen

| Reviewer | Final Position |
|----------|---------------|
| Devil's Advocate | ACCEPT compromise |
| Failure Analyst | ACCEPT compromise |
| Impl Architect | ACCEPT compromise |

**Resolution: Show recent notes below palette input (3/3 unanimous).**

The command palette remains as the home screen, but shows 3-5 recent notes below the command list when query is empty. Users see their recent context immediately without navigation. When typing begins, recent notes are replaced by filtered commands or search fallback. ~15 lines added to CommandPalette.

### C3. Inline body #tag extraction

| Reviewer | Final Position |
|----------|---------------|
| Devil's Advocate | MAINTAIN: Drop for MVP |
| Failure Analyst | MAINTAIN: Drop for MVP |
| Impl Architect | ACCEPT: Drop for MVP |

**Resolution: Drop inline #tag extraction for MVP (3/3 unanimous).**

Tags come exclusively from frontmatter `tags:` field. Inline tag extraction deferred to P1 with proper Markdown AST-based parsing (not regex). Remove `extractInlineTags` from Task 6. Task 6 becomes wikilink extraction only.

### C4. Markdown rendering (marked + marked-terminal)

| Reviewer | Final Position |
|----------|---------------|
| Devil's Advocate | IMPLEMENT |
| Failure Analyst | COMPROMISE: Implement minimal with scope boundary |
| Impl Architect | IMPLEMENT |

**Resolution: Implement for MVP with scope boundary (3/3 agree to implement).**

Scope for MVP:
- Headings (bold + accent color)
- Bold, italic
- Lists (bullet and numbered)
- Code blocks (dim background)
- Horizontal rules
- Wikilink numbering as post-processing

Out of scope for MVP (P1):
- Syntax highlighting in code blocks
- Table rendering
- Image alt-text

Fallback: If `marked-terminal` produces garbled output, fall back to raw Markdown with `[rendering failed — showing raw]` notice.

### C5. CJK slugify strategy

| Reviewer | Final Position |
|----------|---------------|
| Devil's Advocate | ACCEPT: CJK chars in filenames |
| Failure Analyst | COMPROMISE: CJK default + NFC normalization |
| Impl Architect | MAINTAIN: CJK chars in filenames |

**Resolution: Keep CJK characters in filenames with safeguards (3/3 agree on CJK approach).**

Implementation:
```typescript
title
  .normalize('NFC')
  .replace(/[^\p{L}\p{N}\s-]/gu, '')
  .replace(/[\s]+/g, '-')
  .toLowerCase()
```

Safeguards:
- NFC normalization before writing (prevents NFD/NFC invisible collisions)
- Slug collision detection with numeric suffix (A2)
- Empty slug guard → fallback to timestamp
- Truncate to 200 chars for filesystem limits

---

## Recommended Implementation Order

Based on the Implementation Architect's analysis with cross-review refinements:

1. **Phase 1: Project bootstrap (Tasks 1-2)** — No changes. Add error types to `types.ts` (Task 2).
2. **Phase 2: Storage layer (Tasks 3-6)**
   - Task 3 (frontmatter): Add malformed YAML handling, empty frontmatter fallback
   - Task 4 (NoteRepository): CJK-aware slugify, collision detection, atomic writes
   - **Task 4.5 (NEW): FTS5 trigram tokenizer spike** — verify Japanese text search works
   - Task 5 (SearchIndex): Trigram tokenizer, `links` table, `busy_timeout`, `quick_check`, FTS query sanitization
   - Task 6 (LinkParser): Wikilink extraction only (drop inline tags)
3. **Phase 3: Core services (Tasks 8-10)**
   - Task 8 (NoteService): `resolveWikiLink()`, mtime update after editor, reindex in transaction
   - Task 9 (ConfigService): JSON validation with default fallback, auto-create directories
4. **Phase 4: Theme (Task 11)** — Can run parallel with Phase 2
5. **Phase 5: TUI foundation (Tasks 12-15)**
   - Task 12 (NavigationStore): Discriminated union for screen params, stack depth cap
   - **Task 12.5 (NEW): Modal input system** — `useInputMode` hook, foundational before any screens
   - Task 14 (App shell): `isTextInputActive` integration, uncaught exception handler
   - Task 15: Verify Ink + $EDITOR terminal cycling
6. **Phase 6: TUI screens (Tasks 16-21)**
   - Task 16 (CommandPalette): Recent notes below input, search fallback
   - Task 18 (NotePreview): Markdown rendering via marked + marked-terminal, link numbering
   - Task 19 (SearchScreen): Debounced input (150-200ms)
   - Task 20 (CaptureScreen): **Simplified** — single-line TextInput or $EDITOR delegation
7. **Phase 7: CLI (Task 22)** — $EDITOR fallback chain, daily dedup, mtime update, descope `qnote edit`
8. **Phase 8: Polish (Tasks 23-24)** — Coverage, smoke tests, empty state UX

**Parallelization opportunities:**
- After Task 2: Tasks 3, 5, 6, 9, 11, 12 can all start in parallel
- After Task 14: Tasks 16-20 can all run in parallel
- Task 22 (CLI) can run parallel with Phase 5-6

---

## Edge Cases & Failure Scenarios

| Scenario | Likelihood | Impact | Mitigation |
|----------|-----------|--------|------------|
| Slug collision (same title, different case) | H | H | Check existence, append numeric suffix |
| CJK slug produces empty string | H | H | Fallback to timestamp-based filename |
| $EDITOR not set or broken | H | H | Fallback chain: $VISUAL → $EDITOR → vi → nano |
| FTS5 query syntax injection | M | M | Sanitize special chars, wrap in try-catch |
| SQLite corruption (process killed mid-write) | L | H | WAL mode, quick_check on startup, `qnote reindex` |
| Concurrent TUI + CLI (SQLITE_BUSY) | M | H | `busy_timeout = 5000`, graceful error handling |
| Disk full during write | L | H | Atomic write (temp + rename) |
| `qnote` without `qnote init` | H | H | Auto-create directories, make init optional |
| $EDITOR crashes mid-edit | M | M | Check exit code, always re-read file, re-index |
| Uncaught exception in Ink raw mode | L | H | Process-level exception handler restores terminal |
| Malformed YAML frontmatter | M | M | Graceful degradation to empty metadata |
| Typing `q` in search field exits app | H | M | Modal input system (navigation/text modes) |
| `marked-terminal` garbled output | L | M | Fallback to raw Markdown with notice |
| 10MB+ note freezes TUI | L | M | Size guard (warn 1MB, refuse 5MB, suggest $EDITOR) |
| Reindex fails halfway | L | H | Transaction wrapper, rollback on error |
| Navigation stack overflow (50+ deep) | L | L | Cap at 100 entries |

---

## Open Questions — RESOLVED

All open questions were resolved in a follow-up brainstorming session (2026-02-27).

1. **sql.js as official fallback** — **RESOLVED: Document as official fallback.** README and error messages will include sql.js migration instructions for environments where better-sqlite3 native compilation fails.

2. **`qnote edit <query>` scope** — **RESOLVED: Keep as P1.** Will include fuzzy matching, fzf-style selection UI, and pipeline detection (`process.stdin.isTTY`).

3. **Wikilink resolution for subdirectories** — **RESOLVED: Flat resolution only.** Slug-based matching ignores directory depth. `[[api-design]]` resolves only to root-level matches. Path syntax (`[[project-x/api-design]]`) is not supported in MVP.

4. **Search minimum query length** — **RESOLVED: Enforce minimum.** CJK ≥ 2 characters, Latin ≥ 3 characters. Below threshold shows "もう少し入力してください" hint instead of executing query.

5. **Ink + $EDITOR terminal cycling** — **RESOLVED: Spike in Task 15.** No upfront design. Verify `spawn(editor, { stdio: 'inherit' })` works, and decide fallback (unmount/remount or CLI-only editing) based on results.

---

## Additional Design Decisions (2026-02-27)

Resolved during brainstorming session to address gaps identified in the team discussion.

### Capture Screen — Hybrid Approach
- Default: Single-line TextInput for title entry
- Enter: Save to inbox with title-only frontmatter
- Tab: Switch to $EDITOR with pre-filled template for longer content
- Esc: Cancel and return to previous screen

### Inbox Note Naming
- With title: `inbox/{slugified-title}.md` (same CJK-aware slug rules as regular notes)
- Without title: `inbox/YYYY-MM-DD-HHmmss.md` (timestamp fallback)

### Note Size Limits
- 1MB+: Warning displayed in TUI preview footer
- 5MB+: TUI preview refused, prompt to open in $EDITOR instead
- FTS indexing: No size limit (all notes indexed regardless of size)

### Dead Wikilinks
- Visual: Dimmed/gray text in preview (distinct from live links which use accent color)
- Vimium numbers: Still assigned to dead links
- On jump: Prompt "ノートが見つかりません。作成しますか？" with Y/N confirmation

### Command Palette — Recent Notes
- Show 5 most recently modified notes below command list when query is empty
- Replace with filtered results when user begins typing

### Error Handling Architecture
- Custom `AppError` class hierarchy extending `Error`
- Each layer throws typed errors
- TUI layer has global error boundary that catches and displays user-friendly messages
- CLI layer catches at command level and prints to stderr with exit code

### Search Debounce
- 150ms debounce on incremental search input
- Combined with minimum query length enforcement

### Vimium Link Jump Limit
- Numbers 1-9 assigned to first 9 wikilinks in a note
- Links beyond 9 are displayed normally but without jump numbers
- No 2-digit input timeout logic needed
