# Title = Filename Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace slugify-based filename generation with direct title-to-filename mapping, where spaces become hyphens and case is preserved. Invalid titles are rejected with errors.

**Architecture:** The `slugify()` method in `NoteRepository` and `buildCaptureSlug()` in `CaptureScreen` are replaced with a shared `toFilename()` utility. Collision detection switches from auto-suffix to error. Two new error classes are added to the existing `AppError` hierarchy.

**Tech Stack:** TypeScript, Vitest

---

- [ ] Task 1: Add error classes and `toFilename` utility

**Files:**
- Modify: `src/types.ts:87` (after `NoteSizeLimitError`)
- Create: `src/storage/title-to-filename.ts`
- Create: `test/storage/title-to-filename.test.ts`

**What:** Add `InvalidTitleError` and `TitleTooLongError` to the error hierarchy. Extract the new filename conversion logic into a standalone pure function `toFilename(title: string): string` so it can be shared by `NoteRepository` and `CaptureScreen`.

**Interface:**
- `InvalidTitleError(title: string, character: string)` — extends `AppError`, code `'INVALID_TITLE'`
- `TitleTooLongError(title: string, byteLength: number, maxBytes: number)` — extends `AppError`, code `'TITLE_TOO_LONG'`
- `toFilename(title: string): string` — pure function implementing the 7-step conversion:
  1. NFC normalize
  2. Throw `InvalidTitleError` if forbidden chars (`/\:*?"<>|`) found
  3. Spaces → hyphens
  4. Collapse consecutive hyphens
  5. Trim leading/trailing hyphens
  6. Empty result → timestamp fallback (`YYYY-MM-DD-HHMMSS`)
  7. Throw `TitleTooLongError` if UTF-8 byte length > 252

**Test scenarios:**
- Preserves case: `'Test Note'` → `'Test-Note'`
- CJK preserved: `'API認証のフロー'` → `'API認証のフロー'`
- Mixed CJK+Latin: `'React コンポーネント設計'` → `'React-コンポーネント設計'`
- Consecutive spaces collapse: `'hello   world'` → `'hello-world'`
- Trims leading/trailing: `' -hello- '` → `'hello'`
- Forbidden char `/` throws `InvalidTitleError`
- Forbidden char `:` throws `InvalidTitleError`
- Forbidden char `*` throws `InvalidTitleError`
- Empty title returns timestamp pattern `YYYY-MM-DD-HHMMSS`
- Symbol-only title (e.g. `'...'`) after stripping forbidden chars produces timestamp fallback (note: `.` is not forbidden, so `'...'` → `'...'` — but title of only forbidden chars like `'///'` throws immediately)
- Title producing 253+ UTF-8 bytes throws `TitleTooLongError`
- Title at exactly 252 UTF-8 bytes succeeds

**Dependencies:** None (pure function + error classes only)

**Commit:** `feat: add toFilename utility and title validation errors`

---

- [ ] Task 2: Replace `slugify` with `toFilename` in NoteRepository

**Files:**
- Modify: `src/storage/note-repository.ts:1-160`
- Modify: `test/storage/note-repository.test.ts:1-224`

**What:** Replace the private `slugify()` method with the shared `toFilename()` from Task 1. Replace `resolveCollision()` with `checkCollision()` that throws `SlugCollisionError` on exact or case-insensitive match. Remove `MAX_SLUG_LENGTH` constant, `timestampSlug()` helper, and the `randomUUID` import (no longer needed for collision resolution).

**Interface:**
- `NoteRepository.create(input)` — now throws `InvalidTitleError`, `TitleTooLongError`, or `SlugCollisionError` instead of silently sanitizing
- Private `checkCollision(dir: string, filename: string): Promise<string>` — lists directory entries, compares case-insensitively, throws `SlugCollisionError` if match found, otherwise returns `join(dir, filename + '.md')`

**Test scenarios (update existing tests):**
- `'Test Note'` → file ends with `Test-Note.md` (was `test-note.md`)
- `'Hello World'` → `Hello-World.md` (was `hello-world.md`)
- `'API認証のフロー'` → `API認証のフロー.md` (was `api認証のフロー.md`)
- `'React コンポーネント設計'` → `React-コンポーネント設計.md` (was `react-コンポーネント設計.md`)
- `'Hello! @World# $Test%'` → throws `InvalidTitleError` (was `hello-world-test.md`)
- Long title (300 bytes+) → throws `TitleTooLongError` (was truncated)
- Empty-producing title → timestamp fallback (unchanged behavior)
- Same title collision → throws `SlugCollisionError` (was `-2` suffix)
- Case collision (`Test` then `test`) → throws `SlugCollisionError` (new)
- CRUD tests (read, update, delete, listFiles) — update filenames in assertions
- Atomic write tests — update filenames in assertions
- Subdirectory test — filenames updated

**Dependencies:** Task 1 (`toFilename`, error classes)

**Commit:** `refactor: replace slugify with toFilename in NoteRepository`

---

- [ ] Task 3: Update `buildCaptureSlug` in CaptureScreen

**Files:**
- Modify: `src/tui/screens/CaptureScreen.tsx:11-40`
- Modify: `test/tui/capture-screen.test.ts:1-47`

**What:** Replace the inline `buildCaptureSlug` function with the shared `toFilename()`. The capture screen's `buildCaptureSlug` currently duplicates the old slugify logic. Replace it to call `toFilename()` instead, with a try/catch around the capture flow to handle `InvalidTitleError` and `TitleTooLongError` gracefully (show error in UI instead of crash).

**Interface:**
- `buildCaptureSlug(title: string): string` — wraps `toFilename()`, keeps `'capture-'` prefix on timestamp fallback. Rename to `buildCaptureFilename` for clarity.

**Test scenarios (update existing tests):**
- `'My Quick Note'` → `'My-Quick-Note'` (was `'my-quick-note'`)
- CJK title preserves case and characters
- Empty title → timestamp fallback with `capture-` prefix
- Symbol-only title → timestamp fallback with `capture-` prefix
- Mixed CJK+Latin → preserves case
- Collapse multiple spaces
- Trim leading/trailing
- Long title → throws `TitleTooLongError` (was truncated)

**Dependencies:** Task 1 (`toFilename`)

**Commit:** `refactor: use shared toFilename in CaptureScreen`

---

- [ ] Task 4: Update `resolveWikiLink` in NoteService

**Files:**
- Modify: `src/core/note-service.ts:92-119`
- Modify: `test/core/note-service.test.ts:113-146`

**What:** The `resolveWikiLink` method at lines 93-99 re-implements the old slugify logic to normalize wikilink targets before matching against filenames. Update this to use `toFilename()` for the normalization step. Strategy 1 (match by filename) now compares the `toFilename(target)` result against the filename portion of each note's path. Strategy 2 (match by title, case-insensitive) remains unchanged.

**Interface:**
- `resolveWikiLink(target: string)` — unchanged return type. Normalization uses `toFilename()` wrapped in try/catch (if target contains forbidden chars, skip Strategy 1 and fall through to Strategy 2 title match).

**Test scenarios:**
- `'api-design'` resolves to note titled `'API Design'` — now Strategy 1 needs `toFilename('api-design')` = `'api-design'` matching filename `'API-Design'` case-insensitively
- `'my title note'` resolves via title match (Strategy 2) — unchanged
- `'non-existent'` returns null — unchanged
- Wikilink with forbidden chars (e.g., `'A/B'`) gracefully falls through to title match

**Dependencies:** Task 1 (`toFilename`)

**Commit:** `refactor: update resolveWikiLink to use toFilename normalization`

---

- [ ] Task 5: Update CLI commands and terminal utility

**Files:**
- Modify: `src/cli/commands.ts:18`
- Modify: `test/cli/commands.test.ts:32-44`
- Modify: `src/tui/utils/terminal.ts:12-22`
- Modify: `test/tui/terminal.test.ts:48-59`

**What:** The CLI `newNote` command currently generates an `untitled-{timestamp}` title. This is fine as-is since it produces a valid filename. Just verify it still works with the new rules. The `extractSlugFromPath` utility extracts the filename stem — rename to `extractFilenameFromPath` for consistency with the new naming. Update its JSDoc. The function body is unchanged (it already just strips `.md`).

**Interface:**
- `extractFilenameFromPath(filePath: string): string` — renamed from `extractSlugFromPath`, same behavior
- Update all import sites of the old name

**Test scenarios:**
- CLI `newNote()` with no title → file starts with `untitled-` (unchanged)
- CLI `newNote('Test CLI Note')` → creates file (unchanged, title has no forbidden chars)
- `extractFilenameFromPath` — same test cases, just renamed describe block

**Dependencies:** Tasks 1-4 (run after core changes to avoid conflicts)

**Notes:** Search for all imports of `extractSlugFromPath` across `src/` to update them. Also update `getBacklinks(slug)` parameter name to `getBacklinks(filename)` in `note-service.ts` for consistency (no behavior change).

**Commit:** `refactor: rename extractSlugFromPath to extractFilenameFromPath`
