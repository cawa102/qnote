# Tag Screen Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the broken NoteList-based tag screen with a dedicated TagListScreen that supports fuzzy filtering, tag selection → note list navigation, and inline tag rename with confirmation.

**Architecture:** New `TagListScreen` component follows the established FindFileScreen pattern (text input + Fuse.js fuzzy filter + arrow key list). Backend adds `renameTag()`/`renameTagForNote()` to NoteService which update frontmatter files and reindex. NoteList gains a tag-filtered mode with Ctrl+R rename support.

**Tech Stack:** Ink 5, React 18, @inkjs/ui (TextInput), Fuse.js, better-sqlite3, gray-matter

**Design doc:** `docs/plans/2026-03-01-tag-screen-redesign.md`

---

- [ ] Task 1: Types & Footer foundation

**Files:**
- Modify: `src/types.ts:167` (ScreenName union)
- Modify: `src/types.ts:174-181` (ScreenEntry union)
- Modify: `src/tui/components/Footer.tsx:7-50` (HINTS record)
- Test: `test/tui/footer.test.ts`

**What:** Add `'tagList'` to the navigation type system and configure footer hints for the new screen. Also add a `'noteListTag'` hint set for NoteList in tag-filtered mode.

**Interface:**
- `ScreenName` — add `'tagList'` to union: `'palette' | 'noteList' | ... | 'tagList'`
- `ScreenEntry` — add variant: `| { readonly screen: 'tagList' }`
- `HINTS` record — add `tagList` key with 3 entries: `Enter: notes`, `^R: rename`, `Esc: back`

**Details:**

The Footer currently selects hints purely by `ScreenName`. For NoteList's tag-filtered mode, extend `getHintsForScreen()` to accept an optional `tag?: string` param. When `tag` is set, return tag-specific hints (`Enter: preview`, `^R: rename`, `Esc: back`) instead of the default noteList hints.

Update `FooterProps` to accept an optional `tag?: string`. In `App.tsx`, pass the current tag to Footer when `currentEntry.screen === 'noteList'` and `currentEntry.tag` is defined.

**Test scenarios:**
- `getHintsForScreen('tagList')` returns 3 entries (Enter/^R/Esc)
- `getHintsForScreen('noteList')` without tag returns existing 5 entries
- `getHintsForScreen('noteList', undefined, 'ruby')` returns tag-mode 3 entries
- `formatHintEntry` formats tagList entries correctly

**Dependencies:** None

**Commit:** `feat: add tagList screen type and footer hints`

---

- [ ] Task 2: Backend — tag rename operations

**Files:**
- Modify: `src/core/note-service.ts:15-142` (add methods)
- Modify: `src/storage/note-repository.ts:33` (add updateTags helper)
- Test: `test/core/note-service.test.ts`

**What:** Add `renameTag()` for global tag rename and `renameTagForNote()` for single-note tag rename. Both update Markdown frontmatter and reindex.

**Interface:**
- `NoteService.renameTag(oldTag: string, newTag: string): Promise<number>` — rename tag in all notes that have it, returns count of modified notes
- `NoteService.renameTagForNote(filePath: string, oldTag: string, newTag: string): Promise<void>` — rename tag in a single note's frontmatter

**Details:**

`renameTag()` flow:
1. Call `this.index.listByTag(oldTag)` to get all notes with the tag
2. For each note, call `this.repo.read(filePath)` to get current frontmatter
3. Replace `oldTag` with `newTag` in the tags array (if `newTag` already exists in tags, just remove `oldTag` to avoid duplicates)
4. Call `this.repo.update(filePath, { tags: updatedTags })` to write back
5. Call `this.index.upsert(...)` to reindex
6. Return count of modified files

`renameTagForNote()` flow:
1. Read the note at filePath
2. Replace oldTag with newTag in tags array (same dedup logic)
3. Write back and reindex

**Test scenarios:**
- `renameTag('ruby', 'python')` updates all notes with `ruby` tag
- `renameTag` returns correct count of modified notes
- `renameTag` handles tag merge (note already has newTag → removes oldTag, no duplicate)
- `renameTag` with non-existent tag returns 0
- `renameTagForNote` updates only the specified note
- `renameTagForNote` handles tag merge on single note
- `renameTagForNote` throws if note not found

**Dependencies:** `NoteRepository`, `SearchIndex`

**Notes:** `NoteRepository.update()` already supports `{ tags: [...] }` so no new repository method is needed. Use existing `repo.update()` + `index.upsert()` pattern from `NoteService.create()`.

**Commit:** `feat: add tag rename operations to NoteService`

---

- [ ] Task 3: TagListScreen — core component

**Files:**
- Create: `src/tui/screens/TagListScreen.tsx`
- Test: `test/tui/screens/tag-list-screen.test.ts`

**What:** New dedicated tag list screen with fuzzy search input and selectable tag list. Follow the FindFileScreen pattern exactly for consistency.

**Interface:**
```typescript
interface TagListScreenProps {
  readonly noteService: NoteService;
  readonly nav: NavigationStore;
  readonly inputMode: InputModeStore;
}
```

**Exported pure function for testability:**
```typescript
function buildTagDisplayEntries(
  allTags: readonly TagCount[],
  query: string,
  fuse?: Fuse<TagCount> | null,
): TagCount[]
```

**Details:**

Layout (top to bottom):
1. Bordered text input: `タグ検索 >` prompt + `search tags...` placeholder (same border style as FindFileScreen: `borderStyle="bold" borderColor="#56b6c2"`)
2. Count text: `N 件` (dimColor)
3. Tag list: each row is `▸ #tagname (count)` or `  #tagname (count)` based on selection

Behavior:
- On mount: `inputMode.set('text')`, cleanup restores `'navigation'`
- Load tags from `noteService.listTags()` (synchronous, no loading state needed unlike FindFileScreen's async file scan)
- Fuse.js config: `{ keys: ['tag'], threshold: 0.4 }`
- `useDebounce(query, 150)` for filtering
- Arrow keys (↑↓) for selection navigation via `useInput`
- Enter: `nav.push('noteList', { tag: selectedTag.tag })`
- Ctrl+R: triggers rename mode (Task 6 adds this)

**Test scenarios:**
- `buildTagDisplayEntries` returns all tags when query is empty
- `buildTagDisplayEntries` filters by fuzzy match
- `buildTagDisplayEntries` returns empty when no match
- Component renders search box with prompt and placeholder
- Component renders tag list with `#tagname (count)` format
- Arrow keys move selection
- Enter navigates to noteList with tag parameter
- Renders "0 件" when no tags exist

**Dependencies:** `fuse.js`, `@inkjs/ui`, `NoteService`

**Notes:** Unlike FindFileScreen, `listTags()` is synchronous (SQLite query). No loading state or deferred border rendering needed. Reference `FindFileScreen.tsx:49-159` for structural pattern.

**Commit:** `feat: add TagListScreen with fuzzy filter and navigation`

---

- [ ] Task 4: App.tsx integration

**Files:**
- Modify: `src/tui/App.tsx:1-257` (import, routing, action handler, Footer props)
- Test: `test/tui/command-palette.test.ts` (update tags action test if exists)

**What:** Wire TagListScreen into the app router. Replace the broken `tags` action handler. Pass tag context to NoteList and Footer when in tag-filtered mode.

**Details:**

Changes to `App.tsx`:
1. Import `TagListScreen` from `./screens/TagListScreen.js`
2. Replace `handleAction('tags')` case (lines 141-154): remove NoteListItem conversion, replace with `navStore.push('tagList')`
3. Add rendering block for `currentEntry.screen === 'tagList'`:
   ```
   <TagListScreen noteService={noteService} nav={navStore} inputMode={inputModeStore} />
   ```
4. When `currentEntry.screen === 'noteList'` and `currentEntry.tag` is defined:
   - Load notes: call `noteService.listByTag(currentEntry.tag)` in a `useEffect`
   - Convert SearchHit[] to NoteListItem[] and set as noteListItems
   - Set title to `#${currentEntry.tag} のノート`
5. Pass tag to NoteList component: `tag={currentEntry.tag}`
6. Pass tag to Footer: `tag={currentEntry.screen === 'noteList' ? currentEntry.tag : undefined}`

**Interface changes to NoteList props** (expanded in Task 5):
- Add `tag?: string` prop to NoteListProps

**Test scenarios:**
- Tags action navigates to `tagList` screen (not noteList)
- TagListScreen renders when screen is `tagList`
- NoteList loads tag-filtered notes when `tag` param present
- Footer shows tag-specific hints when tag is present

**Dependencies:** Tasks 1, 3

**Notes:** The `useEffect` for loading tag-filtered notes should watch `currentEntry` changes. SearchHit already has filePath/title/tags/modified fields, so mapping to NoteListItem is straightforward (set `backlinkCount: 0` since it's not relevant for tag-filtered view).

**Commit:** `feat: integrate TagListScreen into app router`

---

- [ ] Task 5: NoteList — tag-filtered mode with Ctrl+R

**Files:**
- Modify: `src/tui/screens/NoteList.tsx:1-75`
- Test: `test/tui/note-list.test.ts`

**What:** Extend NoteList to support tag-filtered mode. When a `tag` prop is present, Ctrl+R triggers a rename flow with scope selection (global vs single note).

**Interface:**
```typescript
interface NoteListProps {
  readonly title: string;
  readonly items: readonly NoteListItem[];
  readonly nav: NavigationStore;
  readonly tag?: string;
  readonly onRenameTag?: (scope: 'all' | 'single', filePath: string) => void;
}
```

**Details:**

Rename mode state machine (local useState):
- `'idle'` → normal list mode
- `'scopeSelect'` → show `「全ノートに適用」/「このノートのみ」` choice
- `'editing'` → inline TextInput for new tag name (prefilled with current tag)
- `'confirming'` → show `"N件のノートが更新されます。続行？ (Enter/Esc)"`

UI changes when `tag` is present:
- Ctrl+R input handler: if tag is set, enter `'scopeSelect'` mode
- In `scopeSelect`: show two options with ↑↓ selection, Enter to confirm, Esc to cancel
- After scope chosen: enter `'editing'` mode with inline TextInput
- After editing confirmed: enter `'confirming'` mode showing count
- On final Enter: call `onRenameTag(scope, selectedItem.filePath)`
- On Esc at any rename step: return to `'idle'`

The actual rename execution happens in App.tsx via the `onRenameTag` callback:
- `scope === 'all'`: `noteService.renameTag(oldTag, newTag)` then reload list
- `scope === 'single'`: `noteService.renameTagForNote(filePath, oldTag, newTag)` then reload list

**Test scenarios:**
- Ctrl+R does nothing when no `tag` prop
- Ctrl+R opens scope selection when `tag` is set
- Scope selection shows two options
- Selecting "全ノートに適用" enters editing mode
- Selecting "このノートのみ" enters editing mode
- Esc cancels at each step
- Enter on confirmation calls `onRenameTag` with correct scope

**Dependencies:** Tasks 1, 2

**Notes:** Keep the rename state machine inside NoteList rather than creating a separate component — the interaction is tightly coupled to the list selection. The `onRenameTag` callback keeps NoteList decoupled from NoteService.

**Commit:** `feat: add tag rename support to NoteList in tag-filtered mode`

---

- [ ] Task 6: TagListScreen — inline rename with Ctrl+R

**Files:**
- Modify: `src/tui/screens/TagListScreen.tsx` (from Task 3)
- Test: `test/tui/screens/tag-list-screen.test.ts` (extend)

**What:** Add Ctrl+R inline rename flow to TagListScreen. When pressed, the selected tag row switches to a TextInput for editing. After entering new name, show confirmation with affected note count, then execute rename.

**Details:**

Rename mode state machine:
- `'idle'` → normal browsing/filtering mode
- `'editing'` → selected tag row becomes TextInput (prefilled with tag name, without `#` prefix)
- `'confirming'` → show `"N件のノートが更新されます。続行？ (Enter/Esc)"`

Implementation:
- State: `renameState: 'idle' | 'editing' | 'confirming'` + `newTagName: string` + `pendingCount: number`
- Ctrl+R in useInput: set `renameState = 'editing'`, store selected tag name
- In `'editing'`: replace the selected tag row with a TextInput. On Enter, compute affected count (`noteService.listByTag(oldTag).length`), move to `'confirming'`. On Esc, return to `'idle'`.
- In `'confirming'`: show message `"N件のノートが更新されます。続行？ (Enter/Esc)"`. On Enter, call `noteService.renameTag(oldTag, newTagName)`, refresh tag list, return to `'idle'`. On Esc, return to `'idle'`.
- After successful rename: re-fetch tags via `noteService.listTags()`, rebuild Fuse index

**Test scenarios:**
- Ctrl+R enters editing mode for selected tag
- Editing shows TextInput with current tag name
- Enter in editing mode shows confirmation with count
- Enter in confirming mode executes rename
- Esc at any step cancels and returns to idle
- Tag list refreshes after successful rename
- Rename to existing tag name works (merge)

**Dependencies:** Tasks 2, 3

**Commit:** `feat: add inline tag rename to TagListScreen`

---

## Task Dependency Graph

```
Task 1 (types/footer) ──┬──> Task 3 (TagListScreen) ──┬──> Task 4 (App.tsx) ──> Task 5 (NoteList tag mode)
                         │                              │
                         │                              └──> Task 6 (TagList rename)
                         │
Task 2 (backend) ────────┴──> Task 5, Task 6
```

**Parallelizable:** Tasks 1 & 2 are independent. Tasks 3 & 2 can overlap (3 only needs types from 1). Tasks 5 & 6 are independent.
