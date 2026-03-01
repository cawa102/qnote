# Contributing to qnote

## Prerequisites

- Node.js >= 20
- npm

## Setup

```bash
git clone <repo-url>
cd note-CLI
npm install
```

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `tsup` | Build ESM output to `dist/` with sourcemaps and type declarations |
| `dev` | `tsup --watch` | Build with file watcher for development |
| `test` | `vitest run` | Run all tests once |
| `test:watch` | `vitest` | Run tests in interactive watch mode |
| `test:coverage` | `vitest run --coverage` | Run tests with v8 coverage report (target: 80%+) |
| `typecheck` | `tsc --noEmit` | Type-check without emitting output |

## Build Configuration

- **Bundler**: tsup (ESM-only, target Node 20)
- **Entry points**: `src/index.ts` (library), `bin/qnote.ts` (CLI)
- **External**: `better-sqlite3` (native module, requires `createRequire` banner)
- **Output**: `dist/` with sourcemaps and `.d.ts` declarations

## Development Workflow

1. **Start dev build**: `npm run dev`
2. **Run tests**: `npm run test:watch` (in another terminal)
3. **Type-check**: `npm run typecheck`
4. **Verify coverage**: `npm run test:coverage`

## Testing

- **Framework**: Vitest + @vitest/coverage-v8
- **TUI testing**: ink-testing-library for component tests
- **Coverage target**: 80%+ required
- **Test structure**: Mirrors `src/` directory layout under `test/`

### Running specific tests

```bash
npx vitest run test/core/note-service.test.ts
npx vitest run --reporter=verbose test/tui/
```

## Architecture

See `codemaps/architecture.md` for the full architecture overview.

### Layer Summary

```
bin/qnote.ts        → CLI entry (commander.js)
src/cli/            → CLI command handlers
src/tui/            → Ink 5 + React 18 TUI
  screens/          → 7 screens (palette, noteList, notePreview, findFile, search, capture, editor)
  components/       → 7 components (Footer, CenteredLayout, TitleBanner, BufferTabs, EditorHeaderBar, FileTree, tag-navigation)
  hooks/            → 6 hooks (navigation, input-mode, global-keys, layout, layout-context, debounce)
  editor/           → Editor engine (text-buffer, text-editor, buffer-manager, syntax, renderer, file-tree)
src/core/           → Business logic (NoteService, ConfigService)
src/storage/        → Persistence (NoteRepository, SearchIndex FTS5, file-scanner, frontmatter, link-parser)
src/theme/          → Semantic colors + formatting
src/types.ts        → Shared types and error hierarchy
```

### Key Design Rules

- **Immutable types**: All interfaces use `readonly` properties
- **ESM-only**: `"type": "module"` throughout
- **No mutation**: State updates return new objects (TextBuffer, BufferManager)
- **Source of truth**: Markdown files on disk; SQLite is rebuildable via `qnote reindex`
- **Atomic writes**: temp file → `rename()` to prevent data loss

## Commit Messages

```
<type>: <description>

Types: feat, fix, refactor, docs, test, chore, perf, ci
```

## Dependencies

### Runtime

| Package | Purpose |
|---------|---------|
| ink + react | TUI framework |
| @inkjs/ui | TextInput component |
| better-sqlite3 | SQLite FTS5 search index |
| commander | CLI argument parsing |
| chalk | Terminal colors |
| fuse.js | Fuzzy search (command palette, file finder) |
| gray-matter | YAML frontmatter parsing |
| marked + marked-terminal | Markdown rendering |
| fullscreen-ink | Fullscreen terminal mode |
| string-width | CJK-aware string width |

### Dev

| Package | Purpose |
|---------|---------|
| typescript | Type checking |
| tsup | Bundler |
| vitest + @vitest/coverage-v8 | Testing + coverage |
| ink-testing-library | TUI component testing |
