# Footer Badge Style Design

## Summary

Replace plain-text footer hints with LazyVim/htop-style key badges.
Key names are displayed as colored badges (accent background + dark text), descriptions are dim text.

## Before / After

```
Before:  Enter: select   q: quit
After:    Enter  select    q  quit
          ^^^^^            ^^^
          cyan bg badge    cyan bg badge
```

## Design Decisions

- **Badge color**: Accent background (#56b6c2) + dark foreground (#1e1e2e)
- **ANSI fallback**: `chalk.bgCyan.black` for terminals without True Color
- **Badge padding**: 1 space on each side of the key text (` Enter `, ` q `)
- **Description text**: dim (same as current)
- **Separator**: 2 spaces between badge+description pairs

## Data Structure Change

```typescript
interface HintEntry {
  readonly key: string;   // e.g. 'Enter', 'q', '↑↓', 'Esc'
  readonly desc: string;  // e.g. 'select', 'quit', 'back'
}

// HINTS changes from Record<ScreenName, string>
// to Record<ScreenName, readonly HintEntry[]>
```

## Theme Addition

Add `keyBadge` to `Theme` interface in `colors.ts`:

```typescript
keyBadge: supportsColor
  ? chalk.bgHex('#56b6c2').hex('#1e1e2e')
  : chalk.bgCyan.black,
```

## Files to Change

| File | Change |
|------|--------|
| `src/types.ts` | Add `HintEntry` type |
| `src/theme/colors.ts` | Add `keyBadge` to theme |
| `src/tui/components/Footer.tsx` | Restructure HINTS, render badges |
| `test/tui/footer.test.ts` | Update tests for new structure |

## Visual Example (all screens)

```
palette:      Enter  select    q  quit
findFile:     ↑↓  select    Enter  open    Esc  cancel
noteList:     :  cmd    /  search    n  new    Esc  back
notePreview:  :  cmd    e  edit    p  raw    Esc  back
search:       ↑↓  select    Enter  open    Esc  cancel
capture:      ^S  save    Esc  cancel
editor:       ^S  save   ^P  preview   ^E  tree   ^T  title   ^G  tags    Esc  back
```
