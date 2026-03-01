# Palette Grid Redesign

## Summary

Command palette screen redesign: vertical list to emoji icon grid (3x2). Remove Recent command.

## Commands (6 items)

| Command | Emoji | Key | Action |
|---------|-------|-----|--------|
| New Note | 📝 | n | new |
| Quick Note | ⚡ | c | capture |
| Daily Note | 📅 | d | daily |
| Find File | 📁 | f | findFile |
| Search | 🔍 | s | search |
| Tags | 🏷️ | t | tags |

**Removed**: Recent (key: r, action: recent)

## Layout

```
         QUEEN NOTE (title art)
      ─────────────────────────── (ruler)

      📝               ⚡               📅
   New Note (n)    Quick Note (c)   Daily Note (d)

      📁               🔍              🏷️
   Find File (f)    Search (s)       Tags (t)

                                Enter select  q quit
```

- Title banner and ruler: unchanged
- Grid: 3 columns x 2 rows, centered
- Each cell: emoji icon (line 1) + label with shortcut (line 2)
- Label format: `Label (key)` e.g. `New Note (n)`

## Selection

- Selected item: label text changes to accent color (cyan)
- Icon stays unchanged
- No indicator symbols (remove `●/○`)

## Navigation

- Arrow keys: 2D grid movement (up/down/left/right)
- Left/right: move within row, stop at edges
- Up/down: move between rows, maintain column position
- Enter: execute selected command
- Shortcut keys (n/c/d/f/s/t): direct execution
- q: quit

## Responsive Breakpoints

| Terminal width | Layout |
|---------------|--------|
| 60+ chars | 3 columns (2 rows) |
| 40-59 chars | 2 columns (3 rows) |
| < 40 chars | Vertical list (emoji + label, no grid) |

Grid cell width scales with available space. Minimum cell width ~18 chars.

## Footer

Palette footer hints: `Enter select  q quit`

## Files to modify

- `src/tui/screens/CommandPalette.tsx` — grid layout, remove Recent, emoji icons
- `src/theme/format.ts` — update `PaletteLayout` and `computePaletteLayout` for grid
- `test/tui/command-palette.test.ts` — update tests for grid navigation and removed Recent

## Out of scope

- Block art icons (rejected during brainstorming)
- Icon animation or transitions
- Recent notes display below palette
