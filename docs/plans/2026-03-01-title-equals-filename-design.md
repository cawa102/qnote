# Title = Filename Design

## Summary

Remove the slugify transformation so that a note's title directly determines its filename. Spaces become hyphens; case is preserved. Invalid titles are rejected with errors rather than silently sanitized.

## Conversion Rule: `toFilename(title)`

| Step | Action | Example |
|------|--------|---------|
| 1 | Unicode normalize (NFC) | — |
| 2 | Reject forbidden characters (`/\:*?"<>\|`) | `A/B` → Error |
| 3 | Spaces → hyphens | `My Note` → `My-Note` |
| 4 | Collapse consecutive hyphens | `My--Note` → `My-Note` |
| 5 | Trim leading/trailing hyphens | `-My-Note-` → `My-Note` |
| 6 | Empty result → timestamp fallback | `""` → `2026-03-01-114500` |
| 7 | Byte-length check (max 252 bytes UTF-8, reserving 3 for `.md`) | Over limit → Error |

Case is preserved: `React` stays `React`, not `react`.

## Collision Detection

- Exact filename match → **Error** (reuse `SlugCollisionError`)
- Case-insensitive match (e.g. `Test.md` exists, creating `test`) → **Error**
- Numeric suffix auto-resolution (`-2`, `-3`) is **removed**

## Error Types

| Error | Trigger |
|-------|---------|
| `InvalidTitleError` | Title contains forbidden FS characters |
| `TitleTooLongError` | Filename exceeds 252 bytes (UTF-8) |
| `SlugCollisionError` | Same filename already exists (case-insensitive) |

## Affected Files

### `src/storage/note-repository.ts`

- Replace `slugify()` with `toFilename()` — new conversion rules above
- Replace `resolveCollision()` — instead of suffix, throw on collision (case-insensitive check)
- Remove `MAX_SLUG_LENGTH` constant
- Add byte-length validation

### `src/types.ts`

- Add `InvalidTitleError` class
- Add `TitleTooLongError` class

### `src/core/note-service.ts`

- Update `resolveWikiLink()` — the normalization logic (lines 93-99) currently re-implements slugify. Update to match new `toFilename` rules (spaces→hyphens, preserve case).

### `test/storage/note-repository.test.ts`

- Update all slug-related test expectations:
  - `Test Note` → `Test-Note.md` (not `test-note.md`)
  - CJK titles: `API認証のフロー` → `API認証のフロー.md` (not `api認証のフロー.md`)
  - `Hello! @World# $Test%` → Error (not `hello-world-test.md`)
  - Collision tests: expect errors instead of `-2` suffix
  - Truncation test: expect error instead of truncated filename

### `src/tui/utils/terminal.ts`

- `extractSlugFromPath()` — may need adjustment if consumers assume lowercase slugs

### Backlinks (`src/storage/search-index.ts`)

- `target_slug` column in links table — no schema change needed. The stored value will now match the new filename format.

## Backward Compatibility

Existing notes created with old slug format are left as-is. The title is always sourced from frontmatter, so display is unaffected. New notes follow the new rules.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Forbidden characters | Error | Strict validation; user fixes the title |
| Case collision | Error | macOS APFS is case-insensitive by default |
| Spaces | Hyphens | Terminal-friendly while staying close to title |
| Consecutive spaces | Single hyphen | Clean filenames |
| Leading/trailing whitespace | Trim | Clean filenames |
| Case preservation | Yes | Title = filename principle |
| Max length exceeded | Error | User should shorten the title |
| Empty title | Timestamp fallback | Allow quick capture without title |
| Same-title collision | Error | Strict 1:1 title-filename mapping |
| Existing notes | Leave as-is | Frontmatter is source of truth for title |
