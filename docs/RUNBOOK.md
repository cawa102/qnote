# qnote Runbook

## Installation

```bash
npm run build
npm link          # Makes 'qnote' available globally
```

## Usage

### CLI Commands

```bash
qnote             # Launch TUI (command palette)
qnote new "title" # Create note from CLI
qnote search "q"  # Full-text search
qnote list        # List recent notes
qnote daily       # Create/open today's daily note
qnote capture "t" # Quick capture to inbox
qnote tags        # List all tags
qnote init        # Initialize notes directory
qnote reindex     # Rebuild search index
```

### TUI Navigation

The TUI uses a stack-based single-pane navigation model. Key shortcuts depend on the current input mode:

| Mode | Keys | Action |
|------|------|--------|
| navigation | `:` | Open command palette |
| navigation | `/` | Open full-text search |
| navigation | `q` | Quit |
| navigation | `n` | New note |
| navigation | `e` | Open editor (from note preview) |
| any | `Esc` | Go back (pop stack) |

#### Screens

| Screen | Description | Input Mode |
|--------|-------------|------------|
| Command Palette | Home screen — icon grid with shortcut keys | navigation |
| Note List | Recent notes list | navigation |
| Note Preview | Markdown render with wikilink jumps (1-9) | navigation |
| Find File | Fuzzy file name search (fuse.js) | text |
| Search | Full-text search (SQLite FTS5 trigram) | text |
| Capture | Quick note capture (title + editor) | text |
| Editor | Built-in multi-buffer editor | text |

## Data Locations

| Item | Default Path | Override |
|------|-------------|----------|
| Notes | `~/notes/` | `qnote init <path>` |
| Daily notes | `~/notes/daily/` | config.json |
| Captures | `~/notes/inbox/` | config.json |
| Config | `~/.qnote/config.json` | - |
| Search index | `~/.qnote/search.db` | - |

## Common Issues

### Search not returning expected results

**Symptom**: Notes exist but search doesn't find them.

**Fix**: Rebuild the search index:
```bash
qnote reindex
```

The SQLite FTS5 index is a derived cache. Source of truth is always the Markdown files.

### CJK search requires 3+ characters

FTS5 trigram tokenizer needs at least 3 characters for any query. This is by design for CJK text segmentation.

### Terminal not restored after crash

**Symptom**: Terminal shows raw escape codes or cursor is hidden after abnormal exit.

**Fix**:
```bash
reset            # or
tput cnorm       # show cursor
tput rmcup       # exit alternate screen
```

The app has signal handlers (SIGINT, SIGTERM) and uncaughtException handler to restore terminal state, but edge cases may bypass them.

### better-sqlite3 build failures

**Symptom**: `npm install` fails on native module compilation.

**Fix**:
```bash
# Ensure build tools are installed
xcode-select --install    # macOS
# or
sudo apt install build-essential python3   # Linux

npm rebuild better-sqlite3
```

### Bordered Box rendering corruption after async re-render

**Symptom**: Border top line merges with content, bottom border disappears on screens with async data loading.

**Root cause**: Ink's `log-update` differential terminal rendering can corrupt bordered boxes when async state changes trigger re-renders. `height=3` (border 2 + content 1) is a zero-margin boundary condition.

**Design rule**: Never use explicit `height` on bordered Box components with async state. Defer border rendering until data is loaded so the border is only painted once. See `docs/codex/2026-03-01-findfile-border-height-bug.md` for full analysis.

**Note**: This bug cannot be reproduced in `ink-testing-library` because it uses `debug: true` which bypasses `log-update` entirely.

### Arrow keys not working in command palette

**Symptom**: After typing text and deleting it in the palette, arrow key navigation stops.

**Root cause**: `@inkjs/ui` TextInput's internal useEffect re-fires onChange on every render when the callback reference changes. Fixed in commit da41389 by using `useCallback`.

**Status**: Fixed. If similar issues appear in other screens using TextInput + useInput, apply the same `useCallback` pattern.

## Monitoring

This is a local CLI application. No server-side monitoring needed.

### Health checks

```bash
# Verify build
npm run build && echo "BUILD OK"

# Verify tests
npm run test && echo "TESTS OK"

# Verify types
npm run typecheck && echo "TYPES OK"

# Verify search index
qnote reindex && echo "INDEX OK"
```

## Backup

Notes are plain Markdown files. Back up `~/notes/` with any file backup tool:

```bash
rsync -av ~/notes/ /backup/notes/
# or
tar czf notes-backup-$(date +%Y%m%d).tar.gz ~/notes/
```

The search index (`~/.qnote/search.db`) does not need backup — it can be rebuilt with `qnote reindex`.
