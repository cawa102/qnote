# Queen Note (qnote)

[![npm version](https://img.shields.io/npm/v/qnote)](https://www.npmjs.com/package/qnote)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg)](https://www.typescriptlang.org/)
[![Test Coverage](https://img.shields.io/badge/coverage-93%25%2B-brightgreen.svg)](https://github.com/cawa102/qnote)

```
 ██████╗ ██╗   ██╗███████╗███████╗███╗   ██╗     ███╗   ██╗ ██████╗ ████████╗███████╗
██╔═══██╗██║   ██║██╔════╝██╔════╝████╗  ██║     ████╗  ██║██╔═══██╗╚══██╔══╝██╔════╝
██║   ██║██║   ██║█████╗  █████╗  ██╔██╗ ██║     ██╔██╗ ██║██║   ██║   ██║   █████╗
██║▄▄ ██║██║   ██║██╔══╝  ██╔══╝  ██║╚██╗██║     ██║╚██╗██║██║   ██║   ██║   ██╔══╝
╚██████╔╝╚██████╔╝███████╗███████╗██║ ╚████║     ██║ ╚████║╚██████╔╝   ██║   ███████╗
 ╚══▀▀═╝  ╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═══╝     ╚═╝  ╚═══╝ ╚═════╝    ╚═╝   ╚══════╝
```

AI-friendly terminal-native note-taking app working fully localy. Your notes are plain Markdown files — always accessible, never locked in.

## Features

- **Plain Markdown** — Each note is a standalone `.md` file with YAML frontmatter. No proprietary format.
- **Full-text search** — SQLite FTS5 with trigram tokenizer. Full CJK (Chinese, Japanese, Korean) support.
- **Bidirectional links** — `[[wikilinks]]` with automatic backlink detection.
- **AI-friendly** — Claude Code and other AI tools can directly read/grep/glob your notes. MCP server supported.
- **Local-first** — All data stays on your machine. No account, no cloud, no vendor lock-in.

## Demo

https://github.com/user-attachments/assets/5be71fc8-33c8-4b69-98da-e7e9d8c39b34

## Installation

```bash
npm install -g qnote
```

Requires Node.js 20+.

## Quick Start

Launch the TUI:

```bash
qnote
```

That's it. No `init` required — directories are created automatically on first run.

The command palette opens as your home screen. From there you can search, create notes, browse tags, and more.

## Usage

### TUI Mode

Run `qnote` with no arguments to launch the fullscreen terminal UI.

**Screens:**

| Screen | Purpose |
|--------|---------|
| Command Palette | Home screen, fuzzy search for any action |
| Note List | Browse and filter notes |
| Note Preview | Read notes with rendered Markdown |
| Search | Incremental full-text search (150ms debounce) |
| Capture | Quick memo — single-line title input |
| Tag Browser | Browse all tags with fuzzy search and rename |
| Editor | Built-in text editor with syntax highlighting |

**Keyboard shortcuts:**

Keyboard shortcuts are always available on footer.
When you edit notes (editor screen), 'Ctrl+/' shows standard keybindings. It's not Vim-ish complex keybinds, no need to spend too much time just to write notes.

### CLI Mode

Every operation is also available as a subcommand for scripting and pipelines.

```bash
# Create a new note and open in $EDITOR
qnote new "API Design Notes"

# Open or create today's daily note
qnote daily

# Quick capture without launching TUI
qnote capture "TODO: review auth flow"

# Full-text search
qnote search "authentication" --tag api

# List notes with filters
qnote list --tag project --sort modified

# List all tags with counts
qnote tags

# Rebuild search index
qnote reindex

# Initialize in a custom directory
qnote init ~/my-notes
```

### Pipeline-friendly

```bash
qnote search "API" | grep "auth"
qnote list --format json | jq '.[]'
```

## Note Format

Notes are standard Markdown with YAML frontmatter:

```yaml
---
title: API Design Notes
tags: [api, design, project-x]
created: 2026-02-27T10:30:00+09:00
modified: 2026-02-27T14:00:00+09:00
---

Your content here with [[wikilinks]] to other notes.
```

The Markdown files are the source of truth. SQLite is a rebuildable search index.

## Configuration

Config lives at `~/.qnote/config.json`:

```json
{
  "notesDir": "~/notes",
  "editor": "$EDITOR",
  "daily": {
    "directory": "daily",
    "template": "daily"
  },
  "capture": {
    "directory": "inbox"
  },
  "search": {
    "excludeDirs": [".git", "node_modules"]
  }
}
```

Templates go in `~/.qnote/templates/` with `{{date}}` and `{{title}}` variable expansion.

## Architecture

```
CLI Layer     → commander.js — subcommands
TUI Layer     → Ink 5 + React 18 — fullscreen terminal UI
Core Layer    → NoteService, SearchService, LinkService
Storage Layer → Markdown files + SQLite FTS5 (trigram) + links table
```

## Development

```bash
git clone https://github.com/user/qnote.git
cd qnote
npm install

npm run build          # Build with tsup
npm run dev            # Build with watch mode
npm run test           # Run tests (vitest)
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report (93%+)
npm run typecheck      # Type check (tsc --noEmit)
```

## License

ISC
