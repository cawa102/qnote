# Tag Screen Redesign

Date: 2026-03-01

## Background

The current tag screen reuses the NoteList component by converting tags into NoteListItem objects. This causes multiple problems:

1. **Footer hints are irrelevant** — `cmd`, `search`, `new` are NoteList shortcuts, not tag operations
2. **`:` pushes palette onto stack** — Esc returns to tag screen instead of navigating home
3. **`n` key is unimplemented** — shown in footer but has no handler
4. **Enter crashes the app** — tags have empty `filePath`, so navigating to notePreview with `''` causes a fatal error

## Solution

Replace NoteList reuse with a dedicated **TagListScreen** component.

## Design

### TagListScreen (New Component)

```
┌──────────────────────────────────────┐
│ タグ検索 > search tags...            │  ← prompt + placeholder
└──────────────────────────────────────┘
  ▸ #ruby (12)                          ← selected
    #ruby-on-rails (5)
    #rubygems (2)

 Enter notes  ^R rename  Esc back
```

- **Top**: Text input with prompt `タグ検索 >` and placeholder `search tags...` (same pattern as SearchScreen/FindFileScreen)
- **Middle**: Filtered tag list showing `#tagname (count)`, arrow key navigation
- **Bottom**: Footer hints: `Enter: notes`, `^R: rename`, `Esc: back`
- **Input mode**: `text` (single-key shortcuts disabled, only Esc and Ctrl+ combos work)
- **Filtering**: Real-time fuzzy filter using Fuse.js, matching FindFileScreen pattern
- **Data source**: `SearchIndex.listTags()` returns `{ tag: string, count: number }[]`

### Tag Selection → Note List (Enter)

1. Select a tag (e.g., `#ruby`) → Enter
2. `nav.push('noteList', { tag: 'ruby' })`
3. App.tsx detects `tag` parameter → fetches notes with that tag via NoteService
4. NoteList title: `#ruby のノート`
5. NoteList footer (tag-filtered mode): `Enter: preview`, `^R: rename`, `Esc: back`

### Tag Rename — Global (from TagListScreen)

1. Select `#ruby` → Ctrl+R
2. Tag name becomes inline TextInput (prefilled with current name)
3. Type new name → Enter
4. Confirmation: `"12件のノートが更新されます。続行？ (Enter/Esc)"`
5. Enter confirms → update all notes' frontmatter → reindex SearchIndex
6. Esc cancels

### Tag Rename — Scoped (from NoteList filtered by tag)

1. In `#ruby のノート` list, Ctrl+R on a selected note
2. Scope selection dialog: `「全ノートに適用」/「このノートのみ」`
3. "全ノートに適用" → same global rename flow
4. "このノートのみ" → update only the selected note's frontmatter

### Tag Merge Behavior

When renaming to an existing tag name (e.g., `#ruby → #python` where `#python` exists), the tags merge naturally. The confirmation dialog shows the affected note count.

## Backend Operations

- `NoteService.renameTag(oldTag: string, newTag: string): number` — updates all notes' frontmatter, returns count of modified notes
- `NoteService.renameTagForNote(filePath: string, oldTag: string, newTag: string): void` — updates a single note's frontmatter
- Both operations reindex the SearchIndex after modification

## Navigation Changes

### New ScreenEntry

```typescript
// types.ts
| { readonly screen: 'tagList' }
```

### ScreenName Update

Add `'tagList'` to the `ScreenName` type union.

### CommandPalette Action

Change `handleAction('tags')` from pushing `noteList` with converted items to `nav.push('tagList')`.

### Key Dispatch

No changes needed — TagListScreen uses text input mode, which already disables single-key shortcuts (`:`, `/`, `n`, etc.) via the existing `mode === 'text'` guard.

### Stack Examples

- Tags flow: `[palette] → [palette, tagList] → [palette, tagList, noteList] → [palette, tagList, noteList, notePreview]`
- Esc pops one level at each step

## Footer Changes

### New `tagList` Hints

```typescript
tagList: [
  { key: 'Enter', desc: 'notes' },
  { key: '^R', desc: 'rename' },
  { key: 'Esc', desc: 'back' },
],
```

### NoteList Footer — Context-Aware

When NoteList has a `tag` parameter:
- Show: `Enter: preview`, `^R: rename`, `Esc: back`

When NoteList has no `tag` parameter (normal mode):
- Keep existing: `:: cmd`, `/: search`, `n: new`, `Esc: back`, `^Q: quit`

## Files to Modify

| File | Change |
|------|--------|
| `src/types.ts` | Add `'tagList'` to ScreenName, add ScreenEntry variant |
| `src/tui/screens/TagListScreen.tsx` | **New** — dedicated tag list component |
| `src/tui/App.tsx` | Add TagListScreen routing, change `'tags'` action handler |
| `src/tui/components/Footer.tsx` | Add `tagList` hints, conditional NoteList hints |
| `src/tui/screens/NoteList.tsx` | Add Ctrl+R support when `tag` param present |
| `src/core/note-service.ts` | Add `renameTag()` and `renameTagForNote()` methods |
| `test/` | Tests for all new functionality |
