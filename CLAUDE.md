# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**qnote** — AI-friendly terminal-native note-taking app built with TypeScript. Notes are standalone Markdown files with YAML frontmatter; SQLite FTS5 (trigram tokenizer) provides search indexing with full CJK support. The TUI uses Ink + React with a single-pane, stack-based navigation model.

## Design Documents (MUST READ before development)

Implementation MUST follow these documents saved at 'docs/spec.md' and 'docs/plans/'. Read the relevant docs before working on any feature.

| Document | Purpose |
|----------|---------|
| `docs/spec.md` | Full specification — features, architecture, commands, config, success criteria |
| `docs/search/` | Competitive analysis (Obsidian, Notion, terminal note apps) |
| docs/plans/ | Implementation plans and design plans |

## Architecture

```
CLI Layer     → commander.js — subcommands (new, daily, capture, search, list, tags, init, reindex)
TUI Layer     → Ink 5 + React 18 + @inkjs/ui — 5 screens (palette, noteList, notePreview, search, capture)
Core Layer    → NoteService, LinkService, SearchService, TemplateService
Storage Layer → FileSystem (Markdown + YAML frontmatter) + SQLite FTS5 trigram (index) + links table (backlinks)
```

Source of truth is always the Markdown files. SQLite is a rebuildable index (`qnote reindex`).

## Tech Stack

| Area | Technology |
|------|-----------|
| Language | TypeScript (ESM, target ES2022) |
| TUI | Ink 5 + React 18 + @inkjs/ui |
| Database | better-sqlite3 + FTS5 (trigram tokenizer) — sql.js as fallback |
| Frontmatter | gray-matter |
| Markdown rendering | marked + marked-terminal |
| Build | tsup |
| Test | Vitest + @vitest/coverage-v8 (80%+ coverage required) |
| CLI | commander |
| Fuzzy search | fuse.js |

## Commands (once bootstrapped)

```bash
npm run build          # Build with tsup
npm run dev            # Build with watch mode
npm run test           # Run tests (vitest run)
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
npm run typecheck      # Type check without emitting (tsc --noEmit)
```

## Directory Structure (planned)

```
bin/qnote.ts           # CLI entry point (shebang, commander setup)
src/
  index.ts             # Library barrel export
  types.ts             # Shared types (Note, NoteMeta, WikiLink, AppError hierarchy, etc.)
  core/                # Business logic services (NoteService, SearchService, LinkService)
  storage/             # File I/O (NoteRepository) + SQLite (SearchIndex) + link parser
  tui/                 # Ink components
    screens/           # 5 screen components (palette, noteList, notePreview, search, capture)
    components/        # Reusable UI components (Footer, etc.)
    hooks/             # React hooks (useGlobalKeys, useInputMode, useNavigation, etc.)
  cli/                 # CLI command handlers
  theme/               # Semantic color system (True Color + ANSI fallback)
test/                  # Mirrors src/ structure
docs/
  spec.md              # Full specification
  plans/               # Implementation plans, design decisions
  discussions/         # Team review reports
  search/              # Competitive analysis (Obsidian, Notion, CLI tools)
```

## Key Design Decisions

- **Single-pane TUI**: One screen at a time with stack-based navigation (Esc = back, `:` = command palette from anywhere)
- **Command palette as home screen**: `qnote` with no args launches TUI starting at the palette (with 5 recent notes below)
- **$EDITOR delegation**: No in-app editing — `e` key opens the user's editor. Fallback chain: $VISUAL → $EDITOR → vi → nano
- **Borderless design**: Whitespace and indentation for structure, not box-drawing characters
- **Modal input system**: Text input screens disable single-key shortcuts (q, c, /, :). Only Esc and Ctrl+ combos work during text input
- **CJK-aware slugify**: Japanese/CJK characters preserved in filenames using Unicode property escapes
- **Trigram FTS5**: `tokenize='trigram'` for Japanese text search (unicode61 can't segment CJK)
- **Backlinks via links table**: Dedicated `links` table (not FTS) because FTS5 strips `[[` brackets
- **Atomic file writes**: temp file → rename() to prevent data loss
- **Vimium link jumps**: Numbers 1-9 only (no multi-digit input)
- **Capture hybrid**: Single-line TextInput for title + Tab to open $EDITOR for longer content
- **Tags from frontmatter only** (MVP): Inline #tag extraction deferred to P1
- **Immutable types**: All interfaces use `readonly` properties
- **ESM-only**: `"type": "module"` in package.json, tsup configured for ESM output
- **better-sqlite3 with createRequire**: Needs `import { createRequire } from 'module'` banner in tsup config since better-sqlite3 is a native module
- **Auto-initialization**: `qnote` works without `qnote init` — directories auto-created on first run

## Note Format

```yaml
---
title: Note Title
tags: [tag1, tag2]
created: 2026-02-27T10:30:00+09:00
modified: 2026-02-27T14:00:00+09:00
---
Markdown body with [[wikilinks]]
```

## Error Handling

Custom `AppError` hierarchy defined in `types.ts`: `NoteNotFoundError`, `SlugCollisionError`, `FileWriteError`, `FtsQueryError`, `EditorNotFoundError`, `FrontmatterParseError`, `NoteSizeLimitError`. TUI has uncaught exception handler to restore terminal state before exit.

## Agent Team Development Rules

AgentTeam による並行開発時、各エージェントはコンテキストウィンドウに余裕を持って作業すること。

**コンテキストウィンドウ管理（必須）:**
- 次のタスクに取り掛かる前に、コンテキストウィンドウの使用率を確認する
- **使用率が50%を超えている場合**: そのエージェントでの開発を続行せず、新しいエージェントをスポーンして引き継ぐ
- 引き継ぎ時は、完了済みタスク・現在の状態・次に着手すべきタスクを明確に伝達する
- これにより各エージェントが十分なコンテキスト容量を持った状態で開発を行い、品質低下を防ぐ

