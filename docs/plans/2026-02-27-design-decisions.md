# Design Decisions — Post-Review Resolution

> **Date:** 2026-02-27
> **Source:** Team discussion review (`docs/discussions/2026-02-27-spec-ui-ux-discussion.md`) + brainstorming session
> **Status:** All open questions resolved. Ready for implementation plan update.

---

## 1. sql.js Official Fallback

**Decision:** Document sql.js as official fallback backend.

- README includes sql.js migration instructions
- `better-sqlite3` installation failure error message links to fallback docs
- Same API surface — swap is a single import change
- Performance trade-off: acceptable for <5000 notes

## 2. `qnote edit <query>` — P1 Scope

**Decision:** Keep as P1 feature (not in MVP).

- `qnote edit auth` → fuzzy match → open in $EDITOR
- `qnote edit` (no args) → fzf-style interactive selection
- Pipeline detection: `process.stdin.isTTY` check, warn on piped input
- Explicitly excluded from MVP build phases

## 3. Wikilink Resolution — Flat Only

**Decision:** Slug-based flat resolution. No path syntax.

```
Resolution order:
1. Exact title match (case-sensitive)
2. Slug match (case-insensitive)
3. null (dead link)

NOT supported in MVP:
- [[project-x/api-design]] (path syntax)
- Partial path matching across subdirectories
```

## 4. Search Minimum Query Length

**Decision:** Enforce minimum before executing FTS5 query.

| Script | Minimum | Rationale |
|--------|---------|-----------|
| CJK (Han, Hiragana, Katakana) | 2 chars | Trigram needs ≥3 bytes; 2 CJK chars = 6 bytes |
| Latin / other | 3 chars | Standard trigram minimum |

Below threshold: show hint message, do not execute query.

```typescript
function shouldSearch(query: string): boolean {
  const cjkChars = query.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu);
  if (cjkChars && cjkChars.length > 0) return query.length >= 2;
  return query.length >= 3;
}
```

## 5. Ink + $EDITOR Terminal Cycling

**Decision:** Spike verification in Task 15. No upfront design.

- Test `spawn(editor, { stdio: 'inherit' })` with vim, nano, VS Code
- If Ink resumes cleanly → no additional work
- If broken → evaluate: (a) unmount/remount Ink instance, (b) CLI-only editing
- Decision recorded after spike results

## 6. Capture Screen — Hybrid Approach

**Decision:** Single-line TextInput + $EDITOR delegation.

```
┌─────────────────────────────────────┐
│  Quick Capture                      │
│                                     │
│  Title: [タイトルを入力...       ]  │
│                                     │
│  Enter: 保存  Tab: $EDITORで編集    │
│  Esc: 戻る                          │
└─────────────────────────────────────┘
```

- **Enter**: Create note in `inbox/` with title-only frontmatter, empty body
- **Tab**: Create note in `inbox/`, open in $EDITOR with pre-filled template
- **Esc**: Cancel, return to previous screen
- No multi-line editor in TUI (overengineering risk eliminated)

## 7. Inbox Note Naming

**Decision:** Title-based naming with timestamp fallback.

| Condition | Filename |
|-----------|----------|
| Title provided | `inbox/{slugified-title}.md` |
| Title empty | `inbox/YYYY-MM-DD-HHmmss.md` |

- Same CJK-aware slugify rules as regular notes
- Same collision detection (numeric suffix on duplicate)
- Frontmatter always includes `created` timestamp

## 8. Note Size Limits

**Decision:** Warn at 1MB, refuse TUI preview at 5MB.

| Threshold | Behavior |
|-----------|----------|
| < 1MB | Normal operation |
| 1MB – 5MB | Warning in preview footer: "Large file (X MB)" |
| > 5MB | Preview refused. Show: "ファイルが大きすぎます。$EDITORで開いてください" |

- FTS5 indexing: No size limit (all notes indexed)
- File I/O: No size limit (all notes readable/writable)
- Only TUI rendering is size-gated

## 9. Dead Wikilinks

**Decision:** Dimmed display + creation prompt on jump.

- **Visual**: Gray/dim color in preview (live links use accent color)
- **Vimium numbers**: Assigned normally (1-9 regardless of dead/live)
- **On jump to dead link**: Prompt "ノートが見つかりません。作成しますか？" (Y/N)
  - Y: Create new note with target as title, open in $EDITOR
  - N: Return to preview

## 10. Command Palette — Recent Notes

**Decision:** Show 5 most recently modified notes.

- Displayed below command list when query input is empty
- Sorted by `modified` timestamp descending
- Each entry shows: title, relative time ("2分前", "昨日"), tags (if any)
- When user types: recent notes replaced by filtered commands / search fallback

## 11. Error Handling Architecture

**Decision:** Custom `AppError` class + try/catch pattern.

```
Storage Layer  → throws AppError subclasses
Core Layer     → catches, wraps with context, re-throws or returns
TUI Layer      → global error boundary catches, displays user-friendly message
CLI Layer      → catches at command level, prints to stderr, sets exit code
```

Error types (defined in `types.ts`):
- `NoteNotFoundError`
- `SlugCollisionError`
- `FileWriteError`
- `FtsQueryError`
- `EditorNotFoundError`
- `FrontmatterParseError`
- `NoteSizeLimitError`

## 12. Search Debounce

**Decision:** 150ms debounce.

- Applied to all incremental search inputs (palette, search screen)
- Combined with minimum query length enforcement (Decision #4)
- Flow: keystroke → debounce 150ms → check minimum length → execute FTS5 query

## 13. Vimium Link Jump Limit

**Decision:** 1-9 only. No multi-digit input.

| Link position | Behavior |
|---------------|----------|
| 1st – 9th | Numbered [1] – [9], jumpable via number key |
| 10th+ | Displayed as normal text (no number, no jump shortcut) |

- No timeout ambiguity for 2-digit input
- No `g` + number combo
- Sufficient for most notes (rarely >9 wikilinks per note)

---

## Impact on Implementation Plan

These decisions affect the following tasks in `docs/plans/2026-02-27-qnote-mvp-implementation.md`:

| Task | Change |
|------|--------|
| Task 2 (types.ts) | Add `AppError` class hierarchy, `NoteSizeLimitError`, etc. |
| Task 4 (NoteRepository) | Inbox directory support, size check on read |
| Task 5 (SearchIndex) | `shouldSearch()` minimum query length guard |
| Task 6 (LinkParser) | No change (wikilink extraction only, confirmed) |
| Task 8 (NoteService) | `resolveWikiLink()` flat resolution, dead link detection |
| Task 12 (NavigationStore) | No change (discriminated union confirmed) |
| Task 16 (CommandPalette) | 5 recent notes, 150ms debounce |
| Task 18 (NotePreview) | 1-9 Vimium limit, dead link dimming, size guard |
| Task 19 (SearchScreen) | 150ms debounce, minimum query length |
| Task 20 (CaptureScreen) | Hybrid: single-line + $EDITOR, inbox/ naming |
| Task 22 (CLI) | sql.js fallback docs, $EDITOR fallback chain |
