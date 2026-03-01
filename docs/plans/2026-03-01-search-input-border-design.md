# Search Input Border Design

## Problem

FindFileScreen and SearchScreen have a `TextInput` that is always rendered in JSX but visually invisible until the user types something. The placeholder text and cursor position are not apparent, making it unclear that the screen is ready for input.

## Solution

Wrap the search input line in a bold border box using Ink's `<Box borderStyle="bold">`, making the input area clearly visible at all times.

## Target Screens

- **FindFileScreen** (`src/tui/screens/FindFileScreen.tsx`) — file fuzzy search
- **SearchScreen** (`src/tui/screens/SearchScreen.tsx`) — full-text note search

## Layout

```
  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
  ┃  ファイル検索 > search files...    ┃
  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  25 件

  ✓ daily/2026-03-01.md
  ○ notes/typescript-tips.md
  ○ quick/meeting-notes.md
```

## Implementation Details

- Use Ink `<Box borderStyle="bold">` for heavy box-drawing characters (┏┓┗┛━┃)
- Consistent with palette grid bold border style
- Border color: `theme.accent` (always active since screen is always in text input mode)
- Width: `contentWidth` to match terminal width
- Existing ruler below the border is kept as section separator
- Apply identical treatment to both FindFileScreen and SearchScreen
