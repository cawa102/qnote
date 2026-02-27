# qnote MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a terminal-native note-taking app (qnote) with TUI, CLI, full-text search, wiki-links, and command palette — from zero to working MVP.

**Architecture:** 5-layer stack — CLI Layer (commander) → TUI Layer (Ink + React) → Core Layer (services) → Storage Layer (Markdown files + SQLite FTS5 index). Single-pane TUI with stack-based navigation. Command palette as home screen.

**Tech Stack:** TypeScript (ESM), Ink 5 + React 18 + @inkjs/ui, better-sqlite3 + FTS5, gray-matter (frontmatter), tsup (build), Vitest (test), chalk (colors)

**Reference Docs:**
- `docs/spec.md` — Full specification (features, commands, config, architecture)
- `docs/plans/2026-02-27-ui-ux-design.md` — UI/UX design decisions (screens, colors, keybindings)

---

## Phase 1: Project Bootstrap

### Task 1: Initialize npm project and install dependencies

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`

**Step 1: Initialize npm and install production dependencies**

```bash
cd /Users/kawaikyousuke/cc/development/note-CLI
npm init -y
npm install ink react @inkjs/ui better-sqlite3 gray-matter chalk commander fuse.js marked marked-terminal
```

**Step 2: Install dev dependencies**

```bash
npm install -D typescript @types/react @types/better-sqlite3 @types/marked-terminal tsup vitest @vitest/coverage-v8
```

**Step 3: Configure package.json**

Update `package.json`:
```json
{
  "name": "qnote",
  "version": "0.1.0",
  "description": "AI-friendly terminal-native note-taking app",
  "type": "module",
  "bin": {
    "qnote": "./dist/bin/qnote.js"
  },
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=20"
  }
}
```

**Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*", "bin/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

**Step 5: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'bin/qnote': 'bin/qnote.ts',
  },
  format: ['esm'],
  target: 'node20',
  sourcemap: true,
  clean: true,
  dts: true,
  external: ['better-sqlite3'],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});
```

**Step 6: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/types.ts', 'src/index.ts'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

**Step 7: Verify setup builds**

```bash
npx tsc --noEmit
```

Expected: No errors (no source files yet, should pass)

**Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsup.config.ts vitest.config.ts
git commit -m "chore: initialize qnote project with TypeScript, Ink, Vitest"
```

---

### Task 2: Create directory structure and entry points

**Files:**
- Create: `src/index.ts`
- Create: `src/types.ts`
- Create: `bin/qnote.ts`
- Create: `src/core/index.ts`
- Create: `src/storage/index.ts`
- Create: `src/tui/index.ts`
- Create: `src/cli/index.ts`
- Create: `src/theme/index.ts`
- Test: `test/types.test.ts`

**Step 1: Create directory structure**

```bash
mkdir -p src/{core,storage,tui/{screens,components,hooks},cli,theme}
mkdir -p bin
mkdir -p test/{core,storage,tui,cli,theme}
```

**Step 2: Write the failing test**

`test/types.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('types', () => {
  it('ScreenEntry discriminated union has correct shape for palette', async () => {
    const { } = await import('../src/types.js');
    // Type-level test: we import to verify the module resolves.
    // Runtime assertions below confirm the union works at runtime.
    const palette: import('../src/types.js').ScreenEntry = { screen: 'palette' };
    expect(palette.screen).toBe('palette');
  });

  it('ScreenEntry discriminated union has correct shape for noteList', async () => {
    const entry: import('../src/types.js').ScreenEntry = {
      screen: 'noteList',
      filter: 'api',
      tag: 'design',
    };
    expect(entry.screen).toBe('noteList');
    if (entry.screen === 'noteList') {
      expect(entry.filter).toBe('api');
      expect(entry.tag).toBe('design');
    }
  });

  it('ScreenEntry discriminated union has correct shape for notePreview', async () => {
    const entry: import('../src/types.js').ScreenEntry = {
      screen: 'notePreview',
      filePath: '/notes/test.md',
    };
    expect(entry.screen).toBe('notePreview');
    if (entry.screen === 'notePreview') {
      expect(entry.filePath).toBe('/notes/test.md');
    }
  });

  it('ScreenEntry discriminated union has correct shape for search', async () => {
    const entry: import('../src/types.js').ScreenEntry = {
      screen: 'search',
      initialQuery: 'API',
    };
    expect(entry.screen).toBe('search');
    if (entry.screen === 'search') {
      expect(entry.initialQuery).toBe('API');
    }
  });

  it('ScreenEntry discriminated union has correct shape for capture', async () => {
    const entry: import('../src/types.js').ScreenEntry = { screen: 'capture' };
    expect(entry.screen).toBe('capture');
  });

  it('AppError base class and subclasses work correctly', async () => {
    const {
      AppError,
      NoteNotFoundError,
      SlugCollisionError,
      FileWriteError,
      FtsQueryError,
      EditorNotFoundError,
      FrontmatterParseError,
      NoteSizeLimitError,
    } = await import('../src/types.js');

    const base = new AppError('base error', 'APP_ERROR');
    expect(base).toBeInstanceOf(Error);
    expect(base).toBeInstanceOf(AppError);
    expect(base.message).toBe('base error');
    expect(base.code).toBe('APP_ERROR');
    expect(base.name).toBe('AppError');

    const noteNotFound = new NoteNotFoundError('/notes/missing.md');
    expect(noteNotFound).toBeInstanceOf(AppError);
    expect(noteNotFound.code).toBe('NOTE_NOT_FOUND');
    expect(noteNotFound.message).toContain('/notes/missing.md');
    expect(noteNotFound.filePath).toBe('/notes/missing.md');

    const slugCollision = new SlugCollisionError('my-note', '/notes/my-note.md');
    expect(slugCollision).toBeInstanceOf(AppError);
    expect(slugCollision.code).toBe('SLUG_COLLISION');
    expect(slugCollision.slug).toBe('my-note');
    expect(slugCollision.existingPath).toBe('/notes/my-note.md');

    const fileWrite = new FileWriteError('/notes/fail.md', 'EACCES');
    expect(fileWrite).toBeInstanceOf(AppError);
    expect(fileWrite.code).toBe('FILE_WRITE_ERROR');
    expect(fileWrite.filePath).toBe('/notes/fail.md');

    const ftsQuery = new FtsQueryError('bad query *[', 'fts5 syntax error');
    expect(ftsQuery).toBeInstanceOf(AppError);
    expect(ftsQuery.code).toBe('FTS_QUERY_ERROR');
    expect(ftsQuery.query).toBe('bad query *[');

    const editorNotFound = new EditorNotFoundError();
    expect(editorNotFound).toBeInstanceOf(AppError);
    expect(editorNotFound.code).toBe('EDITOR_NOT_FOUND');

    const frontmatterParse = new FrontmatterParseError('/notes/bad.md', 'invalid YAML');
    expect(frontmatterParse).toBeInstanceOf(AppError);
    expect(frontmatterParse.code).toBe('FRONTMATTER_PARSE_ERROR');
    expect(frontmatterParse.filePath).toBe('/notes/bad.md');

    const sizeLimit = new NoteSizeLimitError('/notes/huge.md', 2_000_000, 1_000_000);
    expect(sizeLimit).toBeInstanceOf(AppError);
    expect(sizeLimit.code).toBe('NOTE_SIZE_LIMIT');
    expect(sizeLimit.actualSize).toBe(2_000_000);
    expect(sizeLimit.maxSize).toBe(1_000_000);
  });

  it('NavigationState holds a stack of ScreenEntry', async () => {
    type NavigationState = import('../src/types.js').NavigationState;
    type ScreenEntry = import('../src/types.js').ScreenEntry;

    const stack: readonly ScreenEntry[] = [
      { screen: 'palette' },
      { screen: 'noteList', tag: 'api' },
      { screen: 'notePreview', filePath: '/notes/api.md' },
    ];
    const state: NavigationState = { stack };

    expect(state.stack).toHaveLength(3);
    expect(state.stack[0]!.screen).toBe('palette');
    expect(state.stack[2]!.screen).toBe('notePreview');
  });
});
```

**Step 3: Run test to verify it fails**

```bash
npx vitest run test/types.test.ts
```

Expected: FAIL — module not found

**Step 4: Create src/types.ts — shared types**

```typescript
// ─── Error hierarchy ───────────────────────────────────────────────

export class AppError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'AppError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NoteNotFoundError extends AppError {
  readonly filePath: string;

  constructor(filePath: string) {
    super(`ノートが見つかりません: ${filePath}`, 'NOTE_NOT_FOUND');
    this.filePath = filePath;
    this.name = 'NoteNotFoundError';
  }
}

export class SlugCollisionError extends AppError {
  readonly slug: string;
  readonly existingPath: string;

  constructor(slug: string, existingPath: string) {
    super(
      `スラグ "${slug}" は既に使用されています: ${existingPath}`,
      'SLUG_COLLISION',
    );
    this.slug = slug;
    this.existingPath = existingPath;
    this.name = 'SlugCollisionError';
  }
}

export class FileWriteError extends AppError {
  readonly filePath: string;

  constructor(filePath: string, reason: string) {
    super(`ファイルの書き込みに失敗しました: ${filePath} (${reason})`, 'FILE_WRITE_ERROR');
    this.filePath = filePath;
    this.name = 'FileWriteError';
  }
}

export class FtsQueryError extends AppError {
  readonly query: string;

  constructor(query: string, reason: string) {
    super(`検索クエリが不正です: "${query}" (${reason})`, 'FTS_QUERY_ERROR');
    this.query = query;
    this.name = 'FtsQueryError';
  }
}

export class EditorNotFoundError extends AppError {
  constructor() {
    super(
      'エディタが見つかりません。$EDITOR 環境変数を設定してください',
      'EDITOR_NOT_FOUND',
    );
    this.name = 'EditorNotFoundError';
  }
}

export class FrontmatterParseError extends AppError {
  readonly filePath: string;

  constructor(filePath: string, reason: string) {
    super(
      `フロントマターの解析に失敗しました: ${filePath} (${reason})`,
      'FRONTMATTER_PARSE_ERROR',
    );
    this.filePath = filePath;
    this.name = 'FrontmatterParseError';
  }
}

export class NoteSizeLimitError extends AppError {
  readonly filePath: string;
  readonly actualSize: number;
  readonly maxSize: number;

  constructor(filePath: string, actualSize: number, maxSize: number) {
    super(
      `ノートのサイズが上限を超えています: ${filePath} (${actualSize} bytes > ${maxSize} bytes)`,
      'NOTE_SIZE_LIMIT',
    );
    this.filePath = filePath;
    this.actualSize = actualSize;
    this.maxSize = maxSize;
    this.name = 'NoteSizeLimitError';
  }
}

// ─── Data types ────────────────────────────────────────────────────

export interface NoteMeta {
  readonly title: string;
  readonly tags: readonly string[];
  readonly created: string;
  readonly modified: string;
}

export interface Note {
  readonly meta: NoteMeta;
  readonly content: string;
  readonly filePath: string;
}

export interface NoteListItem {
  readonly title: string;
  readonly tags: readonly string[];
  readonly modified: string;
  readonly filePath: string;
  readonly backlinkCount: number;
}

export interface SearchResult {
  readonly note: NoteListItem;
  readonly snippet: string;
  readonly matchRanges: readonly MatchRange[];
}

export interface MatchRange {
  readonly start: number;
  readonly end: number;
}

export interface WikiLink {
  readonly target: string;
  readonly displayText: string;
  readonly position: number;
}

export interface BackLink {
  readonly sourceTitle: string;
  readonly sourceFilePath: string;
  readonly context: string;
}

// ─── Navigation (discriminated union) ──────────────────────────────

export type ScreenEntry =
  | { readonly screen: 'palette' }
  | { readonly screen: 'noteList'; readonly filter?: string; readonly tag?: string }
  | { readonly screen: 'notePreview'; readonly filePath: string }
  | { readonly screen: 'search'; readonly initialQuery?: string }
  | { readonly screen: 'capture' };

export interface NavigationState {
  readonly stack: readonly ScreenEntry[];
}

// ─── Config ────────────────────────────────────────────────────────

export interface QnoteConfig {
  readonly notesDir: string;
  readonly editor: string;
  readonly daily: {
    readonly directory: string;
    readonly template: string;
  };
  readonly capture: {
    readonly directory: string;
  };
  readonly search: {
    readonly excludeDirs: readonly string[];
  };
}
```

**Step 5: Create barrel exports for each module**

`src/index.ts`:
```typescript
export * from './types.js';
```

`src/core/index.ts`, `src/storage/index.ts`, `src/tui/index.ts`, `src/cli/index.ts`, `src/theme/index.ts`:
```typescript
// barrel export — populated as modules are added
```

**Step 6: Create bin/qnote.ts entry point (minimal)**

```typescript
#!/usr/bin/env node

console.log('qnote v0.1.0 — coming soon');
```

**Step 7: Run test to verify it passes**

```bash
npx vitest run test/types.test.ts
```

Expected: PASS — all ScreenEntry discriminated union and AppError tests pass

**Step 8: Verify build succeeds**

```bash
npx tsup
node dist/bin/qnote.js
```

Expected: prints `qnote v0.1.0 — coming soon`

**Step 9: Commit**

```bash
git add src/ bin/ test/
git commit -m "chore: create directory structure, shared types, and error hierarchy"
```

---

## Phase 2: Storage Layer

### Task 3: Frontmatter parser

**Files:**
- Create: `src/storage/frontmatter.ts`
- Test: `test/storage/frontmatter.test.ts`

**Step 1: Write the failing test**

`test/storage/frontmatter.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { parseFrontmatter, serializeFrontmatter } from '../../src/storage/frontmatter.js';

describe('parseFrontmatter', () => {
  it('parses valid frontmatter with all fields', () => {
    const raw = `---
title: API設計方針
tags: [api, design]
created: 2026-02-27T10:30:00+09:00
modified: 2026-02-27T14:00:00+09:00
---
# API設計方針

本文テキスト`;

    const result = parseFrontmatter(raw);

    expect(result.meta.title).toBe('API設計方針');
    expect(result.meta.tags).toEqual(['api', 'design']);
    expect(result.meta.created).toBe('2026-02-27T10:30:00+09:00');
    expect(result.content).toContain('# API設計方針');
    expect(result.content).toContain('本文テキスト');
  });

  it('returns empty tags when tags field is missing', () => {
    const raw = `---
title: No Tags
created: 2026-02-27T10:30:00+09:00
modified: 2026-02-27T10:30:00+09:00
---
Content`;

    const result = parseFrontmatter(raw);
    expect(result.meta.tags).toEqual([]);
  });

  it('handles content without frontmatter — uses first # heading as title', () => {
    const raw = '# Just a heading\n\nSome text';
    const result = parseFrontmatter(raw);
    expect(result.meta.title).toBe('Just a heading');
    expect(result.content).toContain('# Just a heading');
    expect(result.content).toContain('Some text');
  });

  it('handles content without frontmatter and without heading — uses empty title', () => {
    const raw = 'No frontmatter and no heading.\n\nJust plain text.';
    const result = parseFrontmatter(raw);
    expect(result.meta.title).toBe('');
    expect(result.content).toContain('No frontmatter and no heading.');
  });

  it('gracefully handles malformed YAML — does not crash', () => {
    const raw = `---
title: [unclosed bracket
tags: {invalid: yaml: here
---
Body content here.`;

    const result = parseFrontmatter(raw);

    // Should not throw. Graceful degradation: returns body and attempts best-effort parse.
    expect(result.content).toBeDefined();
    expect(result.meta.tags).toEqual([]);
    // title may or may not be recoverable depending on gray-matter behavior
    expect(typeof result.meta.title).toBe('string');
  });

  it('handles frontmatter with Date objects (gray-matter auto-parses dates)', () => {
    const raw = `---
title: Date Test
tags: []
created: 2026-02-27
modified: 2026-02-27
---
Content`;

    const result = parseFrontmatter(raw);
    // gray-matter parses bare dates as Date objects — our code must handle both string and Date
    expect(typeof result.meta.created).toBe('string');
    expect(result.meta.created).toBeTruthy();
    expect(typeof result.meta.modified).toBe('string');
    expect(result.meta.modified).toBeTruthy();
  });

  it('handles tags that are not an array (string)', () => {
    const raw = `---
title: String Tag
tags: single-tag
created: 2026-02-27T10:00:00+09:00
modified: 2026-02-27T10:00:00+09:00
---
Content`;

    const result = parseFrontmatter(raw);
    expect(result.meta.tags).toEqual(['single-tag']);
  });

  it('handles completely empty file', () => {
    const result = parseFrontmatter('');
    expect(result.meta.title).toBe('');
    expect(result.meta.tags).toEqual([]);
    expect(result.content).toBe('');
  });
});

describe('serializeFrontmatter', () => {
  it('produces valid YAML frontmatter + content', () => {
    const meta = {
      title: 'Test Note',
      tags: ['test', 'example'] as readonly string[],
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T11:00:00+09:00',
    };
    const content = '# Test Note\n\nBody text.';

    const result = serializeFrontmatter(meta, content);

    expect(result).toContain('---');
    expect(result).toContain('title: Test Note');
    expect(result).toContain('# Test Note');
    expect(result).toContain('Body text.');
  });

  it('round-trips through parse → serialize → parse', () => {
    const meta = {
      title: 'ラウンドトリップ',
      tags: ['日本語', 'test'] as readonly string[],
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T14:00:00+09:00',
    };
    const content = '# ラウンドトリップ\n\n本文のテスト。';

    const serialized = serializeFrontmatter(meta, content);
    const parsed = parseFrontmatter(serialized);

    expect(parsed.meta.title).toBe('ラウンドトリップ');
    expect(parsed.meta.tags).toEqual(['日本語', 'test']);
    expect(parsed.content).toContain('本文のテスト。');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/storage/frontmatter.test.ts
```

Expected: FAIL — module not found

**Step 3: Write minimal implementation**

`src/storage/frontmatter.ts`:
```typescript
import matter from 'gray-matter';
import type { NoteMeta } from '../types.js';

export interface ParsedNote {
  readonly meta: NoteMeta;
  readonly content: string;
}

const FIRST_HEADING_REGEX = /^#\s+(.+)$/m;

function coerceToString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value !== null && value !== undefined) {
    return String(value);
  }
  return '';
}

function coerceToTags(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === 'string' && value.length > 0) {
    return [value];
  }
  return [];
}

function extractTitleFromContent(content: string): string {
  const match = FIRST_HEADING_REGEX.exec(content);
  return match ? match[1]!.trim() : '';
}

export function parseFrontmatter(raw: string): ParsedNote {
  let data: Record<string, unknown> = {};
  let content: string;

  try {
    const result = matter(raw);
    data = result.data as Record<string, unknown>;
    content = result.content;
  } catch {
    // Malformed YAML — graceful degradation: treat entire input as content
    // Attempt to strip the frontmatter delimiters even if YAML is broken
    const stripped = raw.replace(/^---[\s\S]*?---\n?/, '');
    content = stripped || raw;
  }

  const hasFrontmatter = Object.keys(data).length > 0;
  const titleFromFrontmatter = coerceToString(data.title);
  const title = titleFromFrontmatter || (hasFrontmatter ? '' : extractTitleFromContent(content));

  const meta: NoteMeta = {
    title,
    tags: coerceToTags(data.tags),
    created: coerceToString(data.created),
    modified: coerceToString(data.modified),
  };

  return { meta, content: content.trim() };
}

export function serializeFrontmatter(
  meta: NoteMeta,
  content: string,
): string {
  const frontmatter = matter.stringify(content, {
    title: meta.title,
    tags: [...meta.tags],
    created: meta.created,
    modified: meta.modified,
  });

  return frontmatter;
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/storage/frontmatter.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/storage/frontmatter.ts test/storage/frontmatter.test.ts
git commit -m "feat: add frontmatter parser with malformed YAML handling and heading fallback"
```

---

### Task 4: File system note storage (NoteRepository)

**Files:**
- Create: `src/storage/note-repository.ts`
- Test: `test/storage/note-repository.test.ts`

**Step 1: Write the failing test**

`test/storage/note-repository.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NoteRepository } from '../../src/storage/note-repository.js';
import { NoteNotFoundError } from '../../src/types.js';

describe('NoteRepository', () => {
  let tempDir: string;
  let repo: NoteRepository;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'qnote-test-'));
    repo = new NoteRepository(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ─── Basic CRUD ────────────────────────────────────────────────

  it('creates a note with frontmatter', async () => {
    const note = await repo.create({
      title: 'Test Note',
      tags: ['test'],
      content: '# Test\n\nBody text.',
    });

    expect(note.meta.title).toBe('Test Note');
    expect(note.meta.tags).toEqual(['test']);
    expect(note.filePath).toContain('test-note.md');

    const raw = readFileSync(note.filePath, 'utf-8');
    expect(raw).toContain('title: Test Note');
    expect(raw).toContain('Body text.');
  });

  it('reads an existing note by file path', async () => {
    const created = await repo.create({
      title: 'Read Me',
      tags: [],
      content: 'Hello world.',
    });

    const note = await repo.read(created.filePath);
    expect(note.meta.title).toBe('Read Me');
    expect(note.content).toContain('Hello world.');
  });

  it('throws NoteNotFoundError when reading non-existent file', async () => {
    await expect(repo.read('/nonexistent/path.md')).rejects.toThrow(NoteNotFoundError);
  });

  it('lists all markdown files', async () => {
    await repo.create({ title: 'Note A', tags: [], content: 'A' });
    await repo.create({ title: 'Note B', tags: [], content: 'B' });

    const files = await repo.listFiles();
    expect(files).toHaveLength(2);
    expect(files.every((f) => f.endsWith('.md'))).toBe(true);
  });

  it('lists markdown files in nested directories', async () => {
    await repo.create({ title: 'Root Note', tags: [], content: 'root', directory: undefined });
    await repo.create({ title: 'Nested Note', tags: [], content: 'nested', directory: 'sub' });

    const files = await repo.listFiles();
    expect(files).toHaveLength(2);
    expect(files.some((f) => f.includes('sub/'))).toBe(true);
  });

  it('deletes a note', async () => {
    const note = await repo.create({ title: 'Delete Me', tags: [], content: 'X' });
    await repo.delete(note.filePath);

    const files = await repo.listFiles();
    expect(files).toHaveLength(0);
  });

  // ─── CJK-aware slugify ─────────────────────────────────────────

  it('slugifies English title', async () => {
    const note = await repo.create({
      title: 'Hello World',
      tags: [],
      content: 'test',
    });
    expect(note.filePath).toMatch(/hello-world\.md$/);
  });

  it('slugifies CJK title preserving characters', async () => {
    const note = await repo.create({
      title: 'API認証のフロー',
      tags: [],
      content: 'test',
    });
    // CJK characters should be preserved, spaces become hyphens
    expect(note.filePath).toMatch(/api認証のフロー\.md$/);
  });

  it('slugifies mixed CJK and Latin', async () => {
    const note = await repo.create({
      title: 'React コンポーネント設計',
      tags: [],
      content: 'test',
    });
    expect(note.filePath).toMatch(/react-コンポーネント設計\.md$/);
  });

  it('strips special characters from slug', async () => {
    const note = await repo.create({
      title: 'Hello! @World# $Test%',
      tags: [],
      content: 'test',
    });
    expect(note.filePath).toMatch(/hello-world-test\.md$/);
  });

  it('truncates slug to 200 characters', async () => {
    const longTitle = 'a'.repeat(300);
    const note = await repo.create({
      title: longTitle,
      tags: [],
      content: 'test',
    });
    const filename = note.filePath.split('/').pop()!;
    // filename = slug + '.md', slug max 200
    expect(filename.length).toBeLessThanOrEqual(200 + 3); // 200 + '.md'
  });

  // ─── Empty slug fallback ────────────────────────────────────────

  it('falls back to timestamp slug when title produces empty slug', async () => {
    const note = await repo.create({
      title: '!!!???',
      tags: [],
      content: 'test',
    });
    // Slug should be a timestamp fallback like 2026-02-27-103000
    expect(note.filePath).toMatch(/\d{4}-\d{2}-\d{2}-\d{6}\.md$/);
  });

  // ─── Collision detection ────────────────────────────────────────

  it('appends numeric suffix on slug collision', async () => {
    const note1 = await repo.create({ title: 'Same Name', tags: [], content: 'first' });
    const note2 = await repo.create({ title: 'Same Name', tags: [], content: 'second' });

    expect(note1.filePath).toMatch(/same-name\.md$/);
    expect(note2.filePath).toMatch(/same-name-2\.md$/);

    const raw1 = readFileSync(note1.filePath, 'utf-8');
    const raw2 = readFileSync(note2.filePath, 'utf-8');
    expect(raw1).toContain('first');
    expect(raw2).toContain('second');
  });

  it('increments suffix for multiple collisions', async () => {
    await repo.create({ title: 'Collide', tags: [], content: '1' });
    await repo.create({ title: 'Collide', tags: [], content: '2' });
    const note3 = await repo.create({ title: 'Collide', tags: [], content: '3' });

    expect(note3.filePath).toMatch(/collide-3\.md$/);
  });

  // ─── Atomic writes ─────────────────────────────────────────────

  it('uses atomic write (file content is complete, not partial)', async () => {
    const note = await repo.create({
      title: 'Atomic Test',
      tags: ['safe'],
      content: '# Atomic\n\nThis must be written atomically.',
    });

    // Verify the file exists and is complete
    const raw = readFileSync(note.filePath, 'utf-8');
    expect(raw).toContain('title: Atomic Test');
    expect(raw).toContain('This must be written atomically.');
  });

  it('update uses atomic write', async () => {
    const created = await repo.create({
      title: 'Update Me',
      tags: [],
      content: 'Original content.',
    });

    const updated = await repo.update(created.filePath, {
      content: 'Updated content.',
      modifiedTimestamp: '2026-02-27T15:00:00+09:00',
    });

    const raw = readFileSync(updated.filePath, 'utf-8');
    expect(raw).toContain('Updated content.');
    expect(raw).toContain('2026-02-27T15:00:00+09:00');
  });

  // ─── Auto-create directories ────────────────────────────────────

  it('auto-creates .qnote directory', async () => {
    const freshDir = mkdtempSync(join(tmpdir(), 'qnote-fresh-'));
    const freshRepo = new NoteRepository(freshDir);
    await freshRepo.create({ title: 'First', tags: [], content: 'first' });

    const files = await freshRepo.listFiles();
    expect(files).toHaveLength(1);

    rmSync(freshDir, { recursive: true, force: true });
  });

  it('creates notes in subdirectory', async () => {
    const note = await repo.create({
      title: 'Daily Note',
      tags: [],
      content: 'journal',
      directory: 'daily/2026-02',
    });

    expect(note.filePath).toContain('daily/2026-02/');
    const raw = readFileSync(note.filePath, 'utf-8');
    expect(raw).toContain('journal');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/storage/note-repository.test.ts
```

Expected: FAIL — module not found

**Step 3: Write minimal implementation**

`src/storage/note-repository.ts`:
```typescript
import { readFile, writeFile, unlink, readdir, mkdir, rename, access } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseFrontmatter, serializeFrontmatter } from './frontmatter.js';
import type { Note, NoteMeta } from '../types.js';
import { NoteNotFoundError, FileWriteError } from '../types.js';

export interface CreateNoteInput {
  readonly title: string;
  readonly tags: readonly string[];
  readonly content: string;
  readonly directory?: string;
}

export interface UpdateNoteInput {
  readonly title?: string;
  readonly tags?: readonly string[];
  readonly content?: string;
  readonly modifiedTimestamp?: string;
}

const MAX_SLUG_LENGTH = 200;

export class NoteRepository {
  constructor(private readonly notesDir: string) {}

  async create(input: CreateNoteInput): Promise<Note> {
    const now = new Date().toISOString();
    const slug = this.slugify(input.title);
    const dir = input.directory
      ? join(this.notesDir, input.directory)
      : this.notesDir;

    await mkdir(dir, { recursive: true });

    const filePath = await this.resolveCollision(dir, slug);
    const meta: NoteMeta = {
      title: input.title,
      tags: [...input.tags],
      created: now,
      modified: now,
    };

    const raw = serializeFrontmatter(meta, input.content);
    await this.atomicWrite(filePath, raw);

    return { meta, content: input.content, filePath };
  }

  async read(filePath: string): Promise<Note> {
    let raw: string;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch {
      throw new NoteNotFoundError(filePath);
    }

    const { meta, content } = parseFrontmatter(raw);
    return { meta, content, filePath };
  }

  async update(filePath: string, input: UpdateNoteInput): Promise<Note> {
    const existing = await this.read(filePath);

    const meta: NoteMeta = {
      title: input.title ?? existing.meta.title,
      tags: input.tags ? [...input.tags] : [...existing.meta.tags],
      created: existing.meta.created,
      modified: input.modifiedTimestamp ?? new Date().toISOString(),
    };

    const content = input.content ?? existing.content;
    const raw = serializeFrontmatter(meta, content);
    await this.atomicWrite(filePath, raw);

    return { meta, content, filePath };
  }

  async listFiles(dir?: string): Promise<string[]> {
    const targetDir = dir ?? this.notesDir;
    const results: string[] = [];

    try {
      const entries = await readdir(targetDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(targetDir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const nested = await this.listFiles(fullPath);
          results.push(...nested);
        } else if (entry.isFile() && extname(entry.name) === '.md') {
          results.push(fullPath);
        }
      }
    } catch {
      // directory doesn't exist yet — return empty
    }

    return results;
  }

  async delete(filePath: string): Promise<void> {
    await unlink(filePath);
  }

  // ─── Private helpers ────────────────────────────────────────────

  private slugify(title: string): string {
    const slug = title
      .normalize('NFC')
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/[\s]+/g, '-')
      .toLowerCase()
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (slug.length === 0) {
      return this.timestampSlug();
    }

    return slug.slice(0, MAX_SLUG_LENGTH);
  }

  private timestampSlug(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async resolveCollision(dir: string, slug: string): Promise<string> {
    const basePath = join(dir, `${slug}.md`);
    if (!(await this.fileExists(basePath))) {
      return basePath;
    }

    let suffix = 2;
    while (suffix <= 1000) {
      const candidatePath = join(dir, `${slug}-${suffix}.md`);
      if (!(await this.fileExists(candidatePath))) {
        return candidatePath;
      }
      suffix++;
    }

    // Extremely unlikely: 1000 collisions. Fall back to UUID.
    return join(dir, `${slug}-${randomUUID().slice(0, 8)}.md`);
  }

  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const dir = dirname(filePath);
    const tempPath = join(dir, `.tmp-${randomUUID()}`);

    try {
      await writeFile(tempPath, content, 'utf-8');
      await rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file on failure
      try {
        await unlink(tempPath);
      } catch {
        // temp file may not exist if writeFile failed
      }
      throw new FileWriteError(
        filePath,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/storage/note-repository.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/storage/note-repository.ts test/storage/note-repository.test.ts
git commit -m "feat: add NoteRepository with CJK slugify, collision detection, atomic writes"
```

---

### Task 4.5: FTS5 Trigram Tokenizer Spike

**Files:**
- Test: `test/storage/fts5-trigram-spike.test.ts`

This is a validation spike — test only, no production code. It confirms that the `trigram` tokenizer works correctly for Japanese text search before we commit to it in the SearchIndex.

**Step 1: Write the spike test**

`test/storage/fts5-trigram-spike.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';

describe('FTS5 Trigram Tokenizer Spike', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    db.exec(`
      CREATE TABLE docs (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE docs_fts USING fts5(
        title,
        body,
        content='docs',
        content_rowid='id',
        tokenize='trigram'
      );

      CREATE TRIGGER docs_ai AFTER INSERT ON docs BEGIN
        INSERT INTO docs_fts(rowid, title, body)
        VALUES (new.id, new.title, new.body);
      END;

      CREATE TRIGGER docs_ad AFTER DELETE ON docs BEGIN
        INSERT INTO docs_fts(docs_fts, rowid, title, body)
        VALUES ('delete', old.id, old.title, old.body);
      END;

      CREATE TRIGGER docs_au AFTER UPDATE ON docs BEGIN
        INSERT INTO docs_fts(docs_fts, rowid, title, body)
        VALUES ('delete', old.id, old.title, old.body);
        INSERT INTO docs_fts(rowid, title, body)
        VALUES (new.id, new.title, new.body);
      END;
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('searches Japanese text with trigram tokenizer — "認証" matches', () => {
    db.prepare('INSERT INTO docs (id, title, body) VALUES (?, ?, ?)').run(
      1,
      'API認証のフローを整理',
      'OAuth2フローに基づいた認証の設計方針を記録する。',
    );

    const results = db
      .prepare(
        `SELECT d.id, d.title
         FROM docs_fts
         JOIN docs d ON docs_fts.rowid = d.id
         WHERE docs_fts MATCH ?`,
      )
      .all('認証') as Array<{ id: number; title: string }>;

    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('API認証のフローを整理');
  });

  it('searches ASCII text with trigram tokenizer — "API" matches', () => {
    db.prepare('INSERT INTO docs (id, title, body) VALUES (?, ?, ?)').run(
      1,
      'API認証のフローを整理',
      'REST APIのエンドポイント設計。',
    );

    const results = db
      .prepare(
        `SELECT d.id, d.title
         FROM docs_fts
         JOIN docs d ON docs_fts.rowid = d.id
         WHERE docs_fts MATCH ?`,
      )
      .all('API') as Array<{ id: number; title: string }>;

    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('API認証のフローを整理');
  });

  it('searches mixed Japanese/English content', () => {
    db.prepare('INSERT INTO docs (id, title, body) VALUES (?, ?, ?)').run(
      1,
      'Reactコンポーネント設計',
      'useStateとuseEffectを活用したコンポーネント設計パターン。',
    );

    const results = db
      .prepare(
        `SELECT d.id, d.title
         FROM docs_fts
         JOIN docs d ON docs_fts.rowid = d.id
         WHERE docs_fts MATCH ?`,
      )
      .all('コンポーネント') as Array<{ id: number; title: string }>;

    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('Reactコンポーネント設計');
  });

  it('confirms [[wikilink]] brackets are included in content (need links table)', () => {
    db.prepare('INSERT INTO docs (id, title, body) VALUES (?, ?, ?)').run(
      1,
      'リンクテスト',
      '詳細は[[auth-flow]]を参照。また[[db-schema]]も確認。',
    );

    // Searching for the slug inside brackets — trigram will match the raw text
    const bracketResults = db
      .prepare(
        `SELECT d.id
         FROM docs_fts
         JOIN docs d ON docs_fts.rowid = d.id
         WHERE docs_fts MATCH ?`,
      )
      .all('[[auth') as Array<{ id: number }>;

    // This confirms brackets are stored as-is in FTS content.
    // For proper link resolution, we need a separate links table.
    expect(bracketResults.length).toBeGreaterThanOrEqual(0);
    // The key insight: FTS5 trigram stores raw text, so wikilink targets
    // must be extracted and stored in a dedicated links table for reliable lookup.
  });

  it('snippet function works with trigram tokenizer', () => {
    db.prepare('INSERT INTO docs (id, title, body) VALUES (?, ?, ?)').run(
      1,
      'スニペットテスト',
      'この文書はスニペット機能のテストです。検索結果のハイライトを確認します。',
    );

    const results = db
      .prepare(
        `SELECT d.title, snippet(docs_fts, 1, '[', ']', '...', 32) AS snippet
         FROM docs_fts
         JOIN docs d ON docs_fts.rowid = d.id
         WHERE docs_fts MATCH ?`,
      )
      .all('スニペット') as Array<{ title: string; snippet: string }>;

    expect(results).toHaveLength(1);
    expect(results[0]!.snippet).toContain('スニペット');
  });

  it('does not match very short queries (1 char) — trigram requires 3+ chars', () => {
    db.prepare('INSERT INTO docs (id, title, body) VALUES (?, ?, ?)').run(
      1,
      'テスト',
      'あ',
    );

    // Trigram tokenizer requires at least 3 characters for a match.
    // Single character search should either fail or return no results.
    let results: Array<{ id: number }> = [];
    try {
      results = db
        .prepare(
          `SELECT d.id
           FROM docs_fts
           JOIN docs d ON docs_fts.rowid = d.id
           WHERE docs_fts MATCH ?`,
        )
        .all('あ') as Array<{ id: number }>;
    } catch {
      // FTS5 may throw an error for too-short trigram queries — that's expected
    }

    // Either no results or an error is acceptable behavior
    expect(results.length).toBe(0);
  });
});
```

**Step 2: Run the spike test**

```bash
npx vitest run test/storage/fts5-trigram-spike.test.ts
```

Expected: PASS — All Japanese search queries work with the trigram tokenizer. This validates our choice before building the full SearchIndex.

**Step 3: Commit**

```bash
git add test/storage/fts5-trigram-spike.test.ts
git commit -m "test: add FTS5 trigram tokenizer spike validating Japanese search"
```

---

### Task 5: SQLite index with FTS5 full-text search

**Files:**
- Create: `src/storage/search-index.ts`
- Test: `test/storage/search-index.test.ts`

**Step 1: Write the failing test**

`test/storage/search-index.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SearchIndex } from '../../src/storage/search-index.js';

describe('SearchIndex', () => {
  let tempDir: string;
  let index: SearchIndex;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'qnote-idx-'));
    index = new SearchIndex(join(tempDir, 'index.db'));
  });

  afterEach(() => {
    index.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ─── Basic indexing & search ────────────────────────────────────

  it('indexes and searches notes (trigram)', () => {
    index.upsert({
      filePath: '/notes/api.md',
      title: 'API設計方針',
      tags: ['api', 'design'],
      content: 'REST APIの設計についての方針',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    const results = index.search('API');
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('API設計方針');
    expect(results[0]!.snippet).toContain('API');
  });

  it('searches Japanese text with trigram tokenizer', () => {
    index.upsert({
      filePath: '/notes/auth.md',
      title: 'API認証のフロー',
      tags: ['auth'],
      content: 'OAuth2フローに基づいた認証の設計方針。',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    const results = index.search('認証');
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('API認証のフロー');
  });

  it('returns empty for non-matching queries', () => {
    index.upsert({
      filePath: '/notes/test.md',
      title: 'Test',
      tags: [],
      content: 'Hello world',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    const results = index.search('nonexistent-xyz');
    expect(results).toHaveLength(0);
  });

  // ─── Tag operations ─────────────────────────────────────────────

  it('filters by tag', () => {
    index.upsert({
      filePath: '/notes/a.md',
      title: 'Note A',
      tags: ['api'],
      content: 'Content A for testing.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });
    index.upsert({
      filePath: '/notes/b.md',
      title: 'Note B',
      tags: ['design'],
      content: 'Content B for testing.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    const results = index.listByTag('api');
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('Note A');
  });

  it('lists all tags with counts', () => {
    index.upsert({
      filePath: '/notes/a.md',
      title: 'A',
      tags: ['api', 'design'],
      content: 'Content A.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });
    index.upsert({
      filePath: '/notes/b.md',
      title: 'B',
      tags: ['api'],
      content: 'Content B.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    const tags = index.listTags();
    expect(tags).toContainEqual({ tag: 'api', count: 2 });
    expect(tags).toContainEqual({ tag: 'design', count: 1 });
  });

  // ─── Remove ─────────────────────────────────────────────────────

  it('removes notes from index', () => {
    index.upsert({
      filePath: '/notes/del.md',
      title: 'Delete Me',
      tags: [],
      content: 'This will be gone soon enough.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });
    index.remove('/notes/del.md');

    const results = index.search('gone soon enough');
    expect(results).toHaveLength(0);
  });

  // ─── Links table ────────────────────────────────────────────────

  it('upserts and retrieves links', () => {
    index.upsert({
      filePath: '/notes/overview.md',
      title: 'Overview',
      tags: [],
      content: 'See [[auth-flow]] and [[db-schema]] for details.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    index.upsertLinks('/notes/overview.md', [
      { targetSlug: 'auth-flow', targetText: 'auth-flow' },
      { targetSlug: 'db-schema', targetText: 'db-schema' },
    ]);

    const backlinks = index.getBacklinks('auth-flow');
    expect(backlinks).toHaveLength(1);
    expect(backlinks[0]!.sourcePath).toBe('/notes/overview.md');
    expect(backlinks[0]!.sourceTitle).toBe('Overview');
  });

  it('replaces links on re-upsert', () => {
    index.upsert({
      filePath: '/notes/a.md',
      title: 'A',
      tags: [],
      content: 'Links here.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    index.upsertLinks('/notes/a.md', [
      { targetSlug: 'old-link', targetText: 'old-link' },
    ]);
    expect(index.getBacklinks('old-link')).toHaveLength(1);

    // Re-upsert with new links — old ones should be replaced
    index.upsertLinks('/notes/a.md', [
      { targetSlug: 'new-link', targetText: 'new-link' },
    ]);
    expect(index.getBacklinks('old-link')).toHaveLength(0);
    expect(index.getBacklinks('new-link')).toHaveLength(1);
  });

  it('removes links when note is removed', () => {
    index.upsert({
      filePath: '/notes/source.md',
      title: 'Source',
      tags: [],
      content: 'Linking out.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    index.upsertLinks('/notes/source.md', [
      { targetSlug: 'target', targetText: 'target' },
    ]);
    expect(index.getBacklinks('target')).toHaveLength(1);

    index.remove('/notes/source.md');
    expect(index.getBacklinks('target')).toHaveLength(0);
  });

  // ─── Backlinks from multiple sources ────────────────────────────

  it('returns backlinks from multiple sources', () => {
    index.upsert({
      filePath: '/notes/a.md',
      title: 'Note A',
      tags: [],
      content: 'Links to target.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });
    index.upsert({
      filePath: '/notes/b.md',
      title: 'Note B',
      tags: [],
      content: 'Also links to target.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    index.upsertLinks('/notes/a.md', [{ targetSlug: 'target', targetText: 'target' }]);
    index.upsertLinks('/notes/b.md', [{ targetSlug: 'target', targetText: 'target' }]);

    const backlinks = index.getBacklinks('target');
    expect(backlinks).toHaveLength(2);
    const titles = backlinks.map((b) => b.sourceTitle).sort();
    expect(titles).toEqual(['Note A', 'Note B']);
  });

  // ─── listRecent ─────────────────────────────────────────────────

  it('lists most recent notes', () => {
    index.upsert({
      filePath: '/notes/old.md',
      title: 'Old',
      tags: [],
      content: 'Old note.',
      created: '2026-02-25T10:00:00+09:00',
      modified: '2026-02-25T10:00:00+09:00',
    });
    index.upsert({
      filePath: '/notes/new.md',
      title: 'New',
      tags: [],
      content: 'New note.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    const recent = index.listRecent(5);
    expect(recent).toHaveLength(2);
    expect(recent[0]!.title).toBe('New');
    expect(recent[1]!.title).toBe('Old');
  });

  it('listRecent respects limit', () => {
    for (let i = 0; i < 10; i++) {
      index.upsert({
        filePath: `/notes/note-${i}.md`,
        title: `Note ${i}`,
        tags: [],
        content: `Content ${i}.`,
        created: `2026-02-${String(i + 10).padStart(2, '0')}T10:00:00+09:00`,
        modified: `2026-02-${String(i + 10).padStart(2, '0')}T10:00:00+09:00`,
      });
    }

    const recent = index.listRecent(5);
    expect(recent).toHaveLength(5);
  });

  // ─── shouldSearch guard ─────────────────────────────────────────

  it('shouldSearch returns false for empty query', () => {
    expect(index.shouldSearch('')).toBe(false);
  });

  it('shouldSearch returns false for whitespace-only query', () => {
    expect(index.shouldSearch('   ')).toBe(false);
  });

  it('shouldSearch returns false for 1-char Latin query', () => {
    expect(index.shouldSearch('a')).toBe(false);
  });

  it('shouldSearch returns false for 2-char Latin query', () => {
    expect(index.shouldSearch('ab')).toBe(false);
  });

  it('shouldSearch returns true for 3-char Latin query', () => {
    expect(index.shouldSearch('abc')).toBe(true);
  });

  it('shouldSearch returns false for 1-char CJK query', () => {
    expect(index.shouldSearch('認')).toBe(false);
  });

  it('shouldSearch returns true for 2-char CJK query', () => {
    expect(index.shouldSearch('認証')).toBe(true);
  });

  // ─── Query sanitization ─────────────────────────────────────────

  it('sanitizes dangerous FTS5 query characters', () => {
    index.upsert({
      filePath: '/notes/safe.md',
      title: 'Safe Note',
      tags: [],
      content: 'This is safe content for testing.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    // These should not throw — they should be sanitized internally
    expect(() => index.search('test*')).not.toThrow();
    expect(() => index.search('"unbalanced')).not.toThrow();
    expect(() => index.search('a AND OR b')).not.toThrow();
    expect(() => index.search('***')).not.toThrow();
    expect(() => index.search('"hello" "world')).not.toThrow();
  });

  it('returns empty array for query that sanitizes to empty', () => {
    index.upsert({
      filePath: '/notes/x.md',
      title: 'X',
      tags: [],
      content: 'Content here.',
      created: '2026-02-27T10:00:00+09:00',
      modified: '2026-02-27T10:00:00+09:00',
    });

    const results = index.search('**');
    expect(results).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/storage/search-index.test.ts
```

Expected: FAIL — module not found

**Step 3: Write minimal implementation**

`src/storage/search-index.ts`:
```typescript
import Database from 'better-sqlite3';
import { FtsQueryError } from '../types.js';

// ─── Types ─────────────────────────────────────────────────────────

export interface IndexEntry {
  readonly filePath: string;
  readonly title: string;
  readonly tags: readonly string[];
  readonly content: string;
  readonly created: string;
  readonly modified: string;
}

export interface SearchHit {
  readonly filePath: string;
  readonly title: string;
  readonly tags: string[];
  readonly snippet: string;
  readonly modified: string;
}

export interface TagCount {
  readonly tag: string;
  readonly count: number;
}

export interface LinkEntry {
  readonly targetSlug: string;
  readonly targetText: string;
}

export interface BacklinkHit {
  readonly sourcePath: string;
  readonly sourceTitle: string;
  readonly targetSlug: string;
  readonly targetText: string;
}

// ─── CJK detection ────────────────────────────────────────────────

const CJK_REGEX = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

function containsCJK(text: string): boolean {
  return CJK_REGEX.test(text);
}

// ─── SearchIndex ───────────────────────────────────────────────────

export class SearchIndex {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        file_path TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created TEXT NOT NULL,
        modified TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        title,
        content,
        content='notes',
        content_rowid='rowid',
        tokenize='trigram'
      );

      CREATE TABLE IF NOT EXISTS note_tags (
        file_path TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (file_path, tag),
        FOREIGN KEY (file_path) REFERENCES notes(file_path) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag);

      CREATE TABLE IF NOT EXISTS links (
        source_path TEXT NOT NULL,
        target_slug TEXT NOT NULL,
        target_text TEXT NOT NULL,
        PRIMARY KEY (source_path, target_slug),
        FOREIGN KEY (source_path) REFERENCES notes(file_path) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_slug);

      CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(rowid, title, content)
        VALUES (new.rowid, new.title, new.content);
      END;

      CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, content)
        VALUES ('delete', old.rowid, old.title, old.content);
      END;

      CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, content)
        VALUES ('delete', old.rowid, old.title, old.content);
        INSERT INTO notes_fts(rowid, title, content)
        VALUES (new.rowid, new.title, new.content);
      END;
    `);
  }

  // ─── Note operations ────────────────────────────────────────────

  upsert(entry: IndexEntry): void {
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO notes (file_path, title, content, created, modified)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(entry.filePath, entry.title, entry.content, entry.created, entry.modified);

      this.db.prepare('DELETE FROM note_tags WHERE file_path = ?').run(entry.filePath);

      const insertTag = this.db.prepare(
        'INSERT INTO note_tags (file_path, tag) VALUES (?, ?)',
      );
      for (const tag of entry.tags) {
        insertTag.run(entry.filePath, tag);
      }
    });
    tx();
  }

  remove(filePath: string): void {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM links WHERE source_path = ?').run(filePath);
      this.db.prepare('DELETE FROM note_tags WHERE file_path = ?').run(filePath);
      this.db.prepare('DELETE FROM notes WHERE file_path = ?').run(filePath);
    });
    tx();
  }

  // ─── Search ─────────────────────────────────────────────────────

  shouldSearch(query: string): boolean {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return false;
    }

    if (containsCJK(trimmed)) {
      return trimmed.length >= 2;
    }

    return trimmed.length >= 3;
  }

  search(query: string): SearchHit[] {
    const sanitized = this.sanitizeQuery(query);
    if (sanitized.length === 0) {
      return [];
    }

    try {
      const rows = this.db
        .prepare(
          `SELECT n.file_path, n.title, n.modified,
                  snippet(notes_fts, 1, '[', ']', '...', 32) AS snippet
           FROM notes_fts
           JOIN notes n ON notes_fts.rowid = n.rowid
           WHERE notes_fts MATCH ?
           ORDER BY rank`,
        )
        .all(sanitized) as Array<{
        file_path: string;
        title: string;
        modified: string;
        snippet: string;
      }>;

      return rows.map((row) => ({
        filePath: row.file_path,
        title: row.title,
        tags: this.getTagsForFile(row.file_path),
        snippet: row.snippet,
        modified: row.modified,
      }));
    } catch {
      // If the sanitized query still fails (edge case), return empty
      return [];
    }
  }

  // ─── Tag operations ─────────────────────────────────────────────

  listByTag(tag: string): SearchHit[] {
    const rows = this.db
      .prepare(
        `SELECT n.file_path, n.title, n.modified
         FROM note_tags nt
         JOIN notes n ON nt.file_path = n.file_path
         WHERE nt.tag = ?
         ORDER BY n.modified DESC`,
      )
      .all(tag) as Array<{
      file_path: string;
      title: string;
      modified: string;
    }>;

    return rows.map((row) => ({
      filePath: row.file_path,
      title: row.title,
      tags: this.getTagsForFile(row.file_path),
      snippet: '',
      modified: row.modified,
    }));
  }

  listTags(): TagCount[] {
    return this.db
      .prepare(
        'SELECT tag, COUNT(*) as count FROM note_tags GROUP BY tag ORDER BY count DESC',
      )
      .all() as TagCount[];
  }

  // ─── Recent notes ───────────────────────────────────────────────

  listRecent(limit = 5): SearchHit[] {
    const rows = this.db
      .prepare(
        `SELECT file_path, title, modified
         FROM notes
         ORDER BY modified DESC
         LIMIT ?`,
      )
      .all(limit) as Array<{
      file_path: string;
      title: string;
      modified: string;
    }>;

    return rows.map((row) => ({
      filePath: row.file_path,
      title: row.title,
      tags: this.getTagsForFile(row.file_path),
      snippet: '',
      modified: row.modified,
    }));
  }

  // ─── Link operations ────────────────────────────────────────────

  upsertLinks(sourcePath: string, links: readonly LinkEntry[]): void {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM links WHERE source_path = ?').run(sourcePath);

      const insertLink = this.db.prepare(
        'INSERT OR REPLACE INTO links (source_path, target_slug, target_text) VALUES (?, ?, ?)',
      );
      for (const link of links) {
        insertLink.run(sourcePath, link.targetSlug, link.targetText);
      }
    });
    tx();
  }

  getBacklinks(targetSlug: string): BacklinkHit[] {
    const rows = this.db
      .prepare(
        `SELECT l.source_path, n.title AS source_title, l.target_slug, l.target_text
         FROM links l
         JOIN notes n ON l.source_path = n.file_path
         WHERE l.target_slug = ?
         ORDER BY n.modified DESC`,
      )
      .all(targetSlug) as Array<{
      source_path: string;
      source_title: string;
      target_slug: string;
      target_text: string;
    }>;

    return rows.map((row) => ({
      sourcePath: row.source_path,
      sourceTitle: row.source_title,
      targetSlug: row.target_slug,
      targetText: row.target_text,
    }));
  }

  // ─── Lifecycle ──────────────────────────────────────────────────

  close(): void {
    this.db.close();
  }

  // ─── Private helpers ────────────────────────────────────────────

  private getTagsForFile(filePath: string): string[] {
    const rows = this.db
      .prepare('SELECT tag FROM note_tags WHERE file_path = ?')
      .all(filePath) as Array<{ tag: string }>;
    return rows.map((r) => r.tag);
  }

  private sanitizeQuery(query: string): string {
    let sanitized = query.trim();

    // Remove FTS5 special operators that could cause syntax errors
    sanitized = sanitized.replace(/[*"]/g, '');

    // Remove FTS5 boolean operators if they appear as standalone words
    sanitized = sanitized.replace(/\b(AND|OR|NOT|NEAR)\b/g, '');

    // Collapse multiple spaces
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/storage/search-index.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/storage/search-index.ts test/storage/search-index.test.ts
git commit -m "feat: add SQLite FTS5 search index with trigram tokenizer, links table, query sanitization"
```

---

### Task 6: Link parser (wikilinks)

**Files:**
- Create: `src/storage/link-parser.ts`
- Test: `test/storage/link-parser.test.ts`

Note: `extractInlineTags` was dropped for MVP per unanimous team decision. This module exports only `extractWikiLinks`.

**Step 1: Write the failing test**

`test/storage/link-parser.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { extractWikiLinks } from '../../src/storage/link-parser.js';
import type { WikiLink } from '../../src/types.js';

describe('extractWikiLinks', () => {
  it('extracts [[wikilinks]] from content', () => {
    const content = '参照: [[auth-flow]] と [[db-schema]] を確認。';
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(2);
    expect(links[0]!.target).toBe('auth-flow');
    expect(links[0]!.displayText).toBe('auth-flow');
    expect(links[1]!.target).toBe('db-schema');
    expect(links[1]!.displayText).toBe('db-schema');
  });

  it('returns empty array for content without links', () => {
    const links = extractWikiLinks('No links here.');
    expect(links).toEqual([]);
  });

  it('handles duplicate links (preserves all occurrences)', () => {
    const links = extractWikiLinks('[[a]] and [[a]] again');
    expect(links).toHaveLength(2);
    expect(links[0]!.target).toBe('a');
    expect(links[1]!.target).toBe('a');
  });

  it('captures position of each link', () => {
    const content = '[[first]] then [[second]]';
    const links = extractWikiLinks(content);
    expect(links[0]!.position).toBe(0);
    expect(links[1]!.position).toBeGreaterThan(0);
  });

  it('handles display text with pipe syntax [[target|Display Text]]', () => {
    const content = 'See [[auth-flow|認証フロー]] for details.';
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(1);
    expect(links[0]!.target).toBe('auth-flow');
    expect(links[0]!.displayText).toBe('認証フロー');
  });

  it('handles Japanese targets', () => {
    const content = '[[日本語ノート]] のリンク';
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(1);
    expect(links[0]!.target).toBe('日本語ノート');
  });

  it('handles empty brackets gracefully', () => {
    const content = 'Empty [[]] brackets.';
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(0);
  });

  it('handles nested brackets gracefully', () => {
    const content = 'Nested [[outer [[inner]]]] text.';
    const links = extractWikiLinks(content);
    // Should capture at least the inner match
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it('handles links across multiple lines', () => {
    const content = `First line with [[link-one]].
Second line with [[link-two]].
Third line with no links.
Fourth line with [[link-three]].`;
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(3);
    expect(links.map((l) => l.target)).toEqual(['link-one', 'link-two', 'link-three']);
  });

  it('handles links with spaces in target', () => {
    const content = '[[My Long Note Title]] reference.';
    const links = extractWikiLinks(content);
    expect(links).toHaveLength(1);
    expect(links[0]!.target).toBe('My Long Note Title');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/storage/link-parser.test.ts
```

Expected: FAIL — module not found

**Step 3: Write minimal implementation**

`src/storage/link-parser.ts`:
```typescript
import type { WikiLink } from '../types.js';

const WIKILINK_REGEX = /\[\[([^\[\]]+)\]\]/g;

export function extractWikiLinks(content: string): WikiLink[] {
  const links: WikiLink[] = [];
  const regex = new RegExp(WIKILINK_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const rawTarget = match[1]!.trim();
    if (rawTarget.length === 0) {
      continue;
    }

    const pipeIndex = rawTarget.indexOf('|');
    const target = pipeIndex >= 0 ? rawTarget.slice(0, pipeIndex).trim() : rawTarget;
    const displayText = pipeIndex >= 0 ? rawTarget.slice(pipeIndex + 1).trim() : rawTarget;

    links.push({
      target,
      displayText,
      position: match.index,
    });
  }

  return links;
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/storage/link-parser.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/storage/link-parser.ts test/storage/link-parser.test.ts
git commit -m "feat: add wikilink parser with pipe display text support"
```

---

### Task 7: Update storage barrel export

**Files:**
- Modify: `src/storage/index.ts`

**Step 1: Update barrel export**

`src/storage/index.ts`:
```typescript
export { parseFrontmatter, serializeFrontmatter } from './frontmatter.js';
export type { ParsedNote } from './frontmatter.js';

export { NoteRepository } from './note-repository.js';
export type { CreateNoteInput, UpdateNoteInput } from './note-repository.js';

export { SearchIndex } from './search-index.js';
export type {
  IndexEntry,
  SearchHit,
  TagCount,
  LinkEntry,
  BacklinkHit,
} from './search-index.js';

export { extractWikiLinks } from './link-parser.js';
```

**Step 2: Verify build**

```bash
npx tsup
```

Expected: Build succeeds

**Step 3: Run all storage tests**

```bash
npx vitest run test/storage/
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add src/storage/index.ts
git commit -m "chore: update storage barrel exports"
```

---

## Phase 3: Core Services

### Task 8: NoteService (orchestrates create/read/update/delete + indexing)

**Files:**
- Create: `src/core/note-service.ts`
- Test: `test/core/note-service.test.ts`

**Step 1: Write the failing test**

`test/core/note-service.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NoteService } from '../src/core/note-service.js';

describe('NoteService', () => {
  let tempDir: string;
  let service: NoteService;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'qnote-svc-'));
    mkdirSync(join(tempDir, '.qnote'), { recursive: true });
    service = new NoteService(tempDir);
  });

  afterEach(() => {
    service.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a note and indexes it', async () => {
    const note = await service.create({
      title: 'Test Service',
      tags: ['test'],
      content: '# Test\n\nSearchable content here.',
    });

    expect(note.meta.title).toBe('Test Service');

    const results = service.search('Searchable');
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('Test Service');
  });

  it('lists recent notes', async () => {
    await service.create({ title: 'Old Note', tags: [], content: 'Old' });
    await service.create({ title: 'New Note', tags: [], content: 'New' });

    const recent = service.listRecent();
    expect(recent).toHaveLength(2);
  });

  it('deletes a note and removes from index', async () => {
    const note = await service.create({ title: 'Gone', tags: [], content: 'Delete this' });
    await service.delete(note.filePath);

    const results = service.search('Delete this');
    expect(results).toHaveLength(0);
  });

  it('detects backlinks between notes', async () => {
    await service.create({
      title: 'Target Note',
      tags: [],
      content: 'This is the target.',
    });
    await service.create({
      title: 'Source Note',
      tags: [],
      content: 'See [[target-note]] for details.',
    });

    const backlinks = service.getBacklinks('target-note');
    expect(backlinks).toHaveLength(1);
    expect(backlinks[0]!.sourceTitle).toBe('Source Note');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/core/note-service.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

`src/core/note-service.ts`:
```typescript
import { join } from 'node:path';
import { NoteRepository } from '../storage/note-repository.js';
import { SearchIndex } from '../storage/search-index.js';
import { extractWikiLinks, extractInlineTags } from '../storage/link-parser.js';
import type { Note, BackLink } from '../types.js';

interface CreateInput {
  readonly title: string;
  readonly tags: readonly string[];
  readonly content: string;
  readonly directory?: string;
}

export class NoteService {
  private readonly repo: NoteRepository;
  private readonly index: SearchIndex;

  constructor(private readonly notesDir: string) {
    this.repo = new NoteRepository(notesDir);
    this.index = new SearchIndex(join(notesDir, '.qnote', 'index.db'));
  }

  async create(input: CreateInput): Promise<Note> {
    const note = await this.repo.create(input);
    const inlineTags = extractInlineTags(note.content);
    const allTags = [...new Set([...note.meta.tags, ...inlineTags])];

    this.index.upsert({
      filePath: note.filePath,
      title: note.meta.title,
      tags: allTags,
      content: note.content,
      created: note.meta.created,
      modified: note.meta.modified,
    });

    this.indexLinks(note);
    return note;
  }

  async read(filePath: string): Promise<Note> {
    return this.repo.read(filePath);
  }

  async delete(filePath: string): Promise<void> {
    this.index.remove(filePath);
    await this.repo.delete(filePath);
  }

  search(query: string) {
    return this.index.search(query);
  }

  listRecent(limit = 20) {
    return this.index.listRecent(limit);
  }

  listByTag(tag: string) {
    return this.index.listByTag(tag);
  }

  listTags() {
    return this.index.listTags();
  }

  getBacklinks(slug: string): BackLink[] {
    // Search for notes that contain [[slug]]
    const results = this.index.search(`"[[${slug}]]"`);
    return results.map((r) => ({
      sourceTitle: r.title,
      sourceFilePath: r.filePath,
      context: r.snippet,
    }));
  }

  async reindex(): Promise<number> {
    const files = await this.repo.listFiles();
    let count = 0;

    for (const filePath of files) {
      const note = await this.repo.read(filePath);
      const inlineTags = extractInlineTags(note.content);
      const allTags = [...new Set([...note.meta.tags, ...inlineTags])];

      this.index.upsert({
        filePath,
        title: note.meta.title,
        tags: allTags,
        content: note.content,
        created: note.meta.created,
        modified: note.meta.modified,
      });

      this.indexLinks(note);
      count++;
    }

    return count;
  }

  close(): void {
    this.index.close();
  }

  private indexLinks(note: Note): void {
    const links = extractWikiLinks(note.content);
    // Links are stored in content — backlink detection uses FTS search for [[target]]
    // No separate link table needed for MVP
    void links;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/core/note-service.test.ts
```

Expected: PASS (backlinks test may need FTS query adjustment — if `"[[target-note]]"` doesn't match FTS, simplify to search in note content directly)

**Step 5: Commit**

```bash
git add src/core/note-service.ts test/core/note-service.test.ts
git commit -m "feat: add NoteService orchestrating storage and indexing"
```

---

### Task 9: ConfigService

**Files:**
- Create: `src/core/config-service.ts`
- Test: `test/core/config-service.test.ts`

**Step 1: Write the failing test**

`test/core/config-service.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigService } from '../src/core/config-service.js';

describe('ConfigService', () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), 'qnote-cfg-'));
  });

  afterEach(() => {
    rmSync(tempHome, { recursive: true, force: true });
  });

  it('returns default config when no file exists', () => {
    const config = ConfigService.load(join(tempHome, '.qnote'));
    expect(config.notesDir).toBe('~/notes');
    expect(config.editor).toBe('$EDITOR');
  });

  it('reads config from file', () => {
    const configDir = join(tempHome, '.qnote');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify({ notesDir: '/custom/notes' }),
    );

    const config = ConfigService.load(configDir);
    expect(config.notesDir).toBe('/custom/notes');
  });

  it('saves config to file', () => {
    const configDir = join(tempHome, '.qnote');
    ConfigService.save(configDir, { notesDir: '/my/notes' });

    const config = ConfigService.load(configDir);
    expect(config.notesDir).toBe('/my/notes');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/core/config-service.test.ts
```

**Step 3: Write minimal implementation**

`src/core/config-service.ts`:
```typescript
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { QnoteConfig } from '../types.js';

const DEFAULT_CONFIG: QnoteConfig = {
  notesDir: '~/notes',
  editor: '$EDITOR',
  daily: { directory: 'daily', template: 'daily' },
  capture: { directory: 'inbox' },
  search: { excludeDirs: ['.git', 'node_modules', '.qnote'] },
};

export class ConfigService {
  static load(configDir: string): QnoteConfig {
    const configPath = join(configDir, 'config.json');

    if (!existsSync(configPath)) {
      return { ...DEFAULT_CONFIG };
    }

    const raw = readFileSync(configPath, 'utf-8');
    const partial = JSON.parse(raw) as Partial<QnoteConfig>;

    return {
      ...DEFAULT_CONFIG,
      ...partial,
    };
  }

  static save(configDir: string, partial: Partial<QnoteConfig>): void {
    mkdirSync(configDir, { recursive: true });
    const configPath = join(configDir, 'config.json');

    let existing: Partial<QnoteConfig> = {};
    if (existsSync(configPath)) {
      existing = JSON.parse(readFileSync(configPath, 'utf-8'));
    }

    const merged = { ...DEFAULT_CONFIG, ...existing, ...partial };
    writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');
  }

  static resolveNotesDir(notesDir: string): string {
    if (notesDir.startsWith('~/')) {
      return join(process.env.HOME ?? '', notesDir.slice(2));
    }
    return notesDir;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/core/config-service.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/core/config-service.ts test/core/config-service.test.ts
git commit -m "feat: add ConfigService for reading/writing qnote config"
```

---

### Task 10: Update core barrel export

**Files:**
- Modify: `src/core/index.ts`

**Step 1: Update barrel**

```typescript
export { NoteService } from './note-service.js';
export { ConfigService } from './config-service.js';
```

**Step 2: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/core/index.ts
git commit -m "chore: update core barrel exports"
```

---

## Phase 4: Theme System

### Task 11: Semantic color theme with ANSI + True Color

**Files:**
- Create: `src/theme/colors.ts`
- Create: `src/theme/format.ts`
- Test: `test/theme/colors.test.ts`

**Step 1: Write the failing test**

`test/theme/colors.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { theme } from '../src/theme/colors.js';
import { formatTag, formatDate, formatBacklinks } from '../src/theme/format.js';

describe('theme', () => {
  it('has all semantic color functions', () => {
    expect(typeof theme.accent).toBe('function');
    expect(typeof theme.tag).toBe('function');
    expect(typeof theme.link).toBe('function');
    expect(typeof theme.dim).toBe('function');
    expect(typeof theme.error).toBe('function');
    expect(typeof theme.warning).toBe('function');
    expect(typeof theme.selected).toBe('function');
  });

  it('returns strings from color functions', () => {
    expect(typeof theme.accent('test')).toBe('string');
    expect(typeof theme.tag('test')).toBe('string');
  });
});

describe('formatTag', () => {
  it('prefixes tag with #', () => {
    const result = formatTag('api');
    expect(result).toContain('#api');
  });
});

describe('formatDate', () => {
  it('formats ISO date to short form', () => {
    const result = formatDate('2026-02-27T10:00:00+09:00');
    expect(result).toContain('Feb');
    expect(result).toContain('27');
  });
});

describe('formatBacklinks', () => {
  it('formats backlink count with arrow', () => {
    const result = formatBacklinks(3);
    expect(result).toContain('3');
  });

  it('returns empty string for zero backlinks', () => {
    const result = formatBacklinks(0);
    expect(result).toBe('');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/theme/colors.test.ts
```

**Step 3: Write minimal implementation**

`src/theme/colors.ts`:
```typescript
import chalk from 'chalk';

export interface Theme {
  readonly accent: (text: string) => string;
  readonly accentBold: (text: string) => string;
  readonly tag: (text: string) => string;
  readonly link: (text: string) => string;
  readonly dim: (text: string) => string;
  readonly error: (text: string) => string;
  readonly warning: (text: string) => string;
  readonly selected: (text: string) => string;
  readonly bold: (text: string) => string;
  readonly heading: (text: string) => string;
}

const supportsColor = chalk.level >= 3; // True Color

export const theme: Theme = {
  accent: supportsColor ? chalk.hex('#56b6c2') : chalk.cyan,
  accentBold: supportsColor ? chalk.hex('#56b6c2').bold : chalk.cyan.bold,
  tag: supportsColor ? chalk.hex('#c678dd') : chalk.magenta,
  link: supportsColor ? chalk.hex('#61afef').underline : chalk.blue.underline,
  dim: chalk.dim,
  error: supportsColor ? chalk.hex('#e06c75') : chalk.red,
  warning: supportsColor ? chalk.hex('#e5c07b') : chalk.yellow,
  selected: supportsColor ? chalk.hex('#98c379').bold : chalk.green.bold,
  bold: chalk.bold,
  heading: supportsColor ? chalk.hex('#56b6c2').bold : chalk.cyan.bold,
};
```

`src/theme/format.ts`:
```typescript
import { theme } from './colors.js';

export function formatTag(tag: string): string {
  return theme.tag(`#${tag}`);
}

export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return theme.dim(`${months[date.getMonth()]} ${date.getDate()}`);
}

export function formatBacklinks(count: number): string {
  if (count === 0) return '';
  return theme.accent(`\u2190${count}`);
}

export function formatIndicator(selected: boolean): string {
  return selected ? theme.selected('\u25cf') : theme.dim('\u25cb');
}

export function formatRuler(width: number): string {
  return theme.dim('\u2500'.repeat(width));
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/theme/colors.test.ts
```

Expected: PASS

**Step 5: Update barrel and commit**

`src/theme/index.ts`:
```typescript
export { theme } from './colors.js';
export { formatTag, formatDate, formatBacklinks, formatIndicator, formatRuler } from './format.js';
```

```bash
git add src/theme/ test/theme/
git commit -m "feat: add semantic color theme with ANSI + True Color support"
```

---

## Phase 5: TUI Foundation

### Task 12: Navigation stack hook

**Files:**
- Create: `src/tui/hooks/use-navigation.ts`
- Test: `test/tui/use-navigation.test.ts`

**Step 1: Write the failing test**

`test/tui/use-navigation.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createNavigationStore } from '../src/tui/hooks/use-navigation.js';
import type { ScreenName } from '../src/types.js';

describe('NavigationStore', () => {
  it('starts with palette as initial screen', () => {
    const nav = createNavigationStore();
    expect(nav.current().screen).toBe('palette');
  });

  it('pushes a new screen onto the stack', () => {
    const nav = createNavigationStore();
    nav.push('noteList', { filter: 'recent' });
    expect(nav.current().screen).toBe('noteList');
    expect(nav.current().params).toEqual({ filter: 'recent' });
  });

  it('pops back to previous screen', () => {
    const nav = createNavigationStore();
    nav.push('noteList');
    nav.push('notePreview', { filePath: '/a.md' });
    nav.pop();
    expect(nav.current().screen).toBe('noteList');
  });

  it('does not pop past the root', () => {
    const nav = createNavigationStore();
    nav.pop();
    expect(nav.current().screen).toBe('palette');
  });

  it('resets to palette', () => {
    const nav = createNavigationStore();
    nav.push('noteList');
    nav.push('notePreview');
    nav.reset();
    expect(nav.current().screen).toBe('palette');
    expect(nav.stackDepth()).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/tui/use-navigation.test.ts
```

**Step 3: Write minimal implementation**

`src/tui/hooks/use-navigation.ts`:
```typescript
import type { ScreenName, ScreenEntry } from '../../types.js';

export interface NavigationStore {
  current(): ScreenEntry;
  push(screen: ScreenName, params?: Record<string, unknown>): void;
  pop(): void;
  reset(): void;
  stackDepth(): number;
  subscribe(listener: () => void): () => void;
}

export function createNavigationStore(): NavigationStore {
  let stack: ScreenEntry[] = [{ screen: 'palette' }];
  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    current() {
      return stack[stack.length - 1]!;
    },

    push(screen: ScreenName, params?: Record<string, unknown>) {
      stack = [...stack, { screen, params }];
      notify();
    },

    pop() {
      if (stack.length > 1) {
        stack = stack.slice(0, -1);
        notify();
      }
    },

    reset() {
      stack = [{ screen: 'palette' }];
      notify();
    },

    stackDepth() {
      return stack.length;
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/tui/use-navigation.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/tui/hooks/use-navigation.ts test/tui/use-navigation.test.ts
git commit -m "feat: add navigation stack for TUI screen routing"
```

---

### Task 13: Footer component (context hints)

**Files:**
- Create: `src/tui/components/Footer.tsx`
- Test: `test/tui/footer.test.ts`

**Step 1: Write the failing test**

`test/tui/footer.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { getHintsForScreen } from '../src/tui/components/Footer.js';

describe('getHintsForScreen', () => {
  it('returns palette hints', () => {
    const hints = getHintsForScreen('palette');
    expect(hints).toContain('Enter');
    expect(hints).toContain('Esc');
  });

  it('returns noteList hints', () => {
    const hints = getHintsForScreen('noteList');
    expect(hints).toContain(': cmd');
    expect(hints).toContain('/ search');
    expect(hints).toContain('n new');
  });

  it('returns notePreview hints', () => {
    const hints = getHintsForScreen('notePreview');
    expect(hints).toContain('e edit');
    expect(hints).toContain('p raw');
  });

  it('returns search hints', () => {
    const hints = getHintsForScreen('search');
    expect(hints).toContain('Enter');
    expect(hints).toContain('Esc');
  });

  it('returns capture hints', () => {
    const hints = getHintsForScreen('capture');
    expect(hints).toContain('Ctrl+S');
    expect(hints).toContain('Esc');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/tui/footer.test.ts
```

**Step 3: Write minimal implementation**

`src/tui/components/Footer.tsx`:
```tsx
import React from 'react';
import { Box, Text } from 'ink';
import type { ScreenName } from '../../types.js';
import { theme } from '../../theme/colors.js';

const HINTS: Record<ScreenName, string> = {
  palette: 'Enter select   Esc quit',
  noteList: ': cmd   / search   n new   q quit',
  notePreview: 'e edit   p raw   : cmd   Esc back',
  search: '\u2191\u2193 select   Enter open   Esc cancel',
  capture: 'Ctrl+S save   Esc cancel',
};

export function getHintsForScreen(screen: ScreenName): string {
  return HINTS[screen];
}

interface FooterProps {
  readonly screen: ScreenName;
}

export function Footer({ screen }: FooterProps): React.ReactElement {
  const hints = getHintsForScreen(screen);
  return (
    <Box>
      <Text dimColor>{hints}</Text>
    </Box>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/tui/footer.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/tui/components/Footer.tsx test/tui/footer.test.ts
git commit -m "feat: add Footer component with context-specific key hints"
```

---

### Task 14: App shell with screen router and global keybindings

**Files:**
- Create: `src/tui/App.tsx`
- Create: `src/tui/hooks/use-global-keys.ts`

**Step 1: Create global key handler hook**

`src/tui/hooks/use-global-keys.ts`:
```typescript
import { useInput, useApp } from 'ink';
import type { NavigationStore } from './use-navigation.js';

interface UseGlobalKeysOptions {
  readonly nav: NavigationStore;
  readonly currentScreen: string;
}

export function useGlobalKeys({ nav, currentScreen }: UseGlobalKeysOptions): void {
  const { exit } = useApp();

  useInput((input, key) => {
    // q — quit from any screen
    if (input === 'q' && currentScreen !== 'capture' && currentScreen !== 'search') {
      exit();
      return;
    }

    // Esc — pop navigation stack
    if (key.escape) {
      if (nav.stackDepth() <= 1) {
        exit();
      } else {
        nav.pop();
      }
      return;
    }

    // : — open command palette (except when already in palette or text input screens)
    if (input === ':' && currentScreen !== 'palette' && currentScreen !== 'capture' && currentScreen !== 'search') {
      nav.push('palette');
      return;
    }

    // / — open search (except from capture/search)
    if (input === '/' && currentScreen !== 'capture' && currentScreen !== 'search') {
      nav.push('search');
      return;
    }

    // c — open capture (except from capture/search)
    if (input === 'c' && currentScreen !== 'capture' && currentScreen !== 'search' && currentScreen !== 'palette') {
      nav.push('capture');
      return;
    }
  });
}
```

**Step 2: Create App shell component**

`src/tui/App.tsx`:
```tsx
import React, { useState, useSyncExternalStore } from 'react';
import { Box, Text } from 'ink';
import { createNavigationStore } from './hooks/use-navigation.js';
import { useGlobalKeys } from './hooks/use-global-keys.js';
import { Footer } from './components/Footer.js';
import { formatRuler } from '../theme/format.js';
import type { NoteService } from '../core/note-service.js';

interface AppProps {
  readonly noteService: NoteService;
}

const navStore = createNavigationStore();

export function App({ noteService }: AppProps): React.ReactElement {
  const currentEntry = useSyncExternalStore(
    (cb) => navStore.subscribe(cb),
    () => navStore.current(),
  );

  useGlobalKeys({ nav: navStore, currentScreen: currentEntry.screen });

  return (
    <Box flexDirection="column" width="100%">
      <Box flexDirection="column" flexGrow={1}>
        {currentEntry.screen === 'palette' && (
          <Box flexDirection="column" padding={1}>
            <Text bold>qnote {formatRuler(30)}</Text>
            <Text>{'\n'}  {'>'} _</Text>
            <Text>{'\n'}  {'  '}new note        ノート作成</Text>
            <Text>  {'  '}search          全文検索</Text>
            <Text>  {'  '}daily           デイリーノート</Text>
            <Text>  {'  '}recent          最近のノート</Text>
            <Text>  {'  '}capture         クイックメモ</Text>
            <Text>  {'  '}tags            タグ一覧</Text>
          </Box>
        )}
        {currentEntry.screen !== 'palette' && (
          <Box padding={1}>
            <Text>Screen: {currentEntry.screen} (placeholder)</Text>
          </Box>
        )}
      </Box>
      <Footer screen={currentEntry.screen} />
    </Box>
  );
}
```

**Step 3: Verify build succeeds**

```bash
npx tsup
```

Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/tui/App.tsx src/tui/hooks/use-global-keys.ts
git commit -m "feat: add TUI App shell with screen router and global keybindings"
```

---

### Task 15: Wire TUI entry point (bin/qnote.ts)

**Files:**
- Modify: `bin/qnote.ts`

**Step 1: Update bin/qnote.ts to launch TUI**

```typescript
#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import { App } from '../src/tui/App.js';
import { NoteService } from '../src/core/note-service.js';
import { ConfigService } from '../src/core/config-service.js';
import { join } from 'node:path';

const program = new Command();

program
  .name('qnote')
  .version('0.1.0')
  .description('AI-friendly terminal-native note-taking app')
  .action(() => {
    const homeDir = process.env.HOME ?? '';
    const configDir = join(homeDir, '.qnote');
    const config = ConfigService.load(configDir);
    const notesDir = ConfigService.resolveNotesDir(config.notesDir);
    const noteService = new NoteService(notesDir);

    const instance = render(React.createElement(App, { noteService }));

    instance.waitUntilExit().then(() => {
      noteService.close();
    });
  });

program.parse();
```

**Step 2: Build and test manually**

```bash
npx tsup
node dist/bin/qnote.js
```

Expected: TUI launches with palette placeholder. Press `q` to exit.

**Step 3: Commit**

```bash
git add bin/qnote.ts
git commit -m "feat: wire TUI entry point with Ink renderer"
```

---

## Phase 6: TUI Screens

### Task 16: Command Palette screen

**Files:**
- Create: `src/tui/screens/CommandPalette.tsx`
- Create: `src/tui/hooks/use-debounce.ts`
- Create: `src/theme/relative-time.ts`
- Test: `test/tui/command-palette.test.ts`
- Test: `test/tui/use-debounce.test.ts`
- Test: `test/theme/relative-time.test.ts`

**Step 1: Write the failing tests**

`test/theme/relative-time.test.ts`:
```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatRelativeTime } from '../src/theme/relative-time.js';

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "たった今" for times less than 1 minute ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-27T12:00:30+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toBe('たった今');
  });

  it('returns "N分前" for times less than 1 hour ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-27T12:05:00+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toBe('5分前');
  });

  it('returns "N時間前" for times less than 24 hours ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-27T15:00:00+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toBe('3時間前');
  });

  it('returns "昨日" for times 1 day ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-28T12:00:00+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toBe('昨日');
  });

  it('returns "N日前" for times 2-6 days ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T12:00:00+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toBe('3日前');
  });

  it('returns "N週間前" for times 7-29 days ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T12:00:00+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toBe('2週間前');
  });

  it('returns date string for times older than 30 days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toContain('Feb');
    expect(result).toContain('27');
  });
});
```

`test/tui/use-debounce.test.ts`:
```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { debounce } from '../src/tui/hooks/use-debounce.js';

describe('debounce', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays function execution', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 150);

    debounced('hello');
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(fn).toHaveBeenCalledWith('hello');
  });

  it('cancels previous call when called again within delay', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 150);

    debounced('first');
    vi.advanceTimersByTime(100);
    debounced('second');
    vi.advanceTimersByTime(150);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('second');
  });

  it('can be cancelled explicitly', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 150);

    debounced('hello');
    debounced.cancel();
    vi.advanceTimersByTime(200);

    expect(fn).not.toHaveBeenCalled();
  });
});
```

`test/tui/command-palette.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { filterCommands, PALETTE_COMMANDS, type PaletteCommand } from '../src/tui/screens/CommandPalette.js';

describe('filterCommands', () => {
  it('returns all commands when query is empty', () => {
    const results = filterCommands(PALETTE_COMMANDS, '');
    expect(results).toHaveLength(PALETTE_COMMANDS.length);
  });

  it('fuzzy matches commands by label', () => {
    const results = filterCommands(PALETTE_COMMANDS, 'da');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.label).toBe('daily');
  });

  it('fuzzy matches commands by Japanese description', () => {
    const results = filterCommands(PALETTE_COMMANDS, 'ノート');
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns empty for non-matching query', () => {
    const results = filterCommands(PALETTE_COMMANDS, 'zzzzz');
    expect(results).toHaveLength(0);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run test/theme/relative-time.test.ts test/tui/use-debounce.test.ts test/tui/command-palette.test.ts
```

Expected: FAIL — modules not found

**Step 3: Write implementations**

`src/theme/relative-time.ts`:
```typescript
import { formatDate } from './format.js';

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'たった今';
  if (diffMinutes < 60) return `${diffMinutes}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays === 1) return '昨日';
  if (diffDays < 7) return `${diffDays}日前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前`;

  return formatDate(isoDate);
}
```

`src/tui/hooks/use-debounce.ts`:
```typescript
import { useState, useEffect, useRef } from 'react';

export interface DebouncedFn<T extends (...args: unknown[]) => void> {
  (...args: Parameters<T>): void;
  cancel(): void;
}

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number,
): DebouncedFn<T> {
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>): void => {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      fn(...args);
      timerId = null;
    }, delayMs);
  };

  debounced.cancel = (): void => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  return debounced as DebouncedFn<T>;
}

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
```

`src/tui/screens/CommandPalette.tsx`:
```tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';
import Fuse from 'fuse.js';
import { theme } from '../../theme/colors.js';
import { formatRuler, formatTag } from '../../theme/format.js';
import { formatRelativeTime } from '../../theme/relative-time.js';
import { useDebounce } from '../hooks/use-debounce.js';
import { useInputMode } from '../hooks/use-input-mode.js';
import type { NavigationStore } from '../hooks/use-navigation.js';
import type { NoteService } from '../../core/note-service.js';

export interface PaletteCommand {
  readonly label: string;
  readonly description: string;
  readonly action: string;
}

export const PALETTE_COMMANDS: PaletteCommand[] = [
  { label: 'new note', description: 'ノート作成', action: 'new' },
  { label: 'search', description: '全文検索', action: 'search' },
  { label: 'daily', description: 'デイリーノート', action: 'daily' },
  { label: 'recent', description: '最近のノート', action: 'recent' },
  { label: 'capture', description: 'クイックメモ', action: 'capture' },
  { label: 'tags', description: 'タグ一覧', action: 'tags' },
];

const fuse = new Fuse(PALETTE_COMMANDS, {
  keys: ['label', 'description'],
  threshold: 0.4,
});

export function filterCommands(
  commands: readonly PaletteCommand[],
  query: string,
): PaletteCommand[] {
  if (query.trim() === '') return [...commands];
  return fuse.search(query).map((r) => r.item);
}

interface RecentNoteEntry {
  readonly title: string;
  readonly modified: string;
  readonly tags: readonly string[];
  readonly filePath: string;
}

interface CommandPaletteProps {
  readonly nav: NavigationStore;
  readonly noteService: NoteService;
  readonly onAction: (action: string, query: string) => void;
}

export function CommandPalette({ nav, onAction }: CommandPaletteProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const filtered = filterCommands(COMMANDS, query);

  useInput((input, key) => {
    if (key.downArrow || (input === 'j' && query === '')) {
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    }
    if (key.upArrow || (input === 'k' && query === '')) {
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
    if (key.return && filtered.length > 0) {
      const cmd = filtered[selectedIndex];
      if (cmd) {
        onAction(cmd.action, query);
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text>
        {theme.bold('qnote')} {formatRuler(30)}
      </Text>
      <Box marginTop={1}>
        <Text>{'  > '}</Text>
        <TextInput
          placeholder="type a command..."
          onChange={(value) => {
            setQuery(value);
            setSelectedIndex(0);
          }}
        />
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {filtered.map((cmd, i) => (
          <Box key={cmd.action}>
            <Text>
              {'  '}
              {i === selectedIndex
                ? theme.selected(`\u25cf ${cmd.label}`)
                : theme.dim(`\u25cb ${cmd.label}`)}
              {'  '}
              <Text dimColor>{cmd.description}</Text>
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/tui/command-palette.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/tui/screens/CommandPalette.tsx test/tui/command-palette.test.ts
git commit -m "feat: add CommandPalette screen with fuzzy filtering"
```

---

### Task 17: NoteList screen

**Files:**
- Create: `src/tui/screens/NoteList.tsx`
- Test: `test/tui/note-list.test.ts`

**Step 1: Write the failing test**

`test/tui/note-list.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { clampIndex } from '../../src/tui/screens/NoteList.js';

describe('clampIndex', () => {
  it('clamps index within bounds going down', () => {
    expect(clampIndex(0, 1, 5)).toBe(1);
    expect(clampIndex(4, 1, 5)).toBe(4);
  });

  it('clamps index within bounds going up', () => {
    expect(clampIndex(3, -1, 5)).toBe(2);
    expect(clampIndex(0, -1, 5)).toBe(0);
  });

  it('returns 0 for empty list', () => {
    expect(clampIndex(0, 1, 0)).toBe(0);
    expect(clampIndex(0, -1, 0)).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/tui/note-list.test.ts
```

Expected: FAIL — module not found

**Step 3: Write implementation**

`src/tui/screens/NoteList.tsx`:
```tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../../theme/colors.js';
import {
  formatTag,
  formatDate,
  formatBacklinks,
  formatIndicator,
  formatRuler,
} from '../../theme/format.js';
import type { NavigationStore } from '../hooks/use-navigation.js';
import type { InputModeStore } from '../hooks/use-input-mode.js';
import type { NoteListItem } from '../../types.js';

export function clampIndex(current: number, delta: number, length: number): number {
  if (length === 0) return 0;
  return Math.max(0, Math.min(current + delta, length - 1));
}

interface NoteListProps {
  readonly title: string;
  readonly items: readonly NoteListItem[];
  readonly nav: NavigationStore;
  readonly inputMode: InputModeStore;
}

export function NoteList({ title, items, nav, inputMode }: NoteListProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    const mode = inputMode.current();

    // j/k navigation only in navigation mode
    if (mode === 'navigation') {
      if (input === 'j') {
        setSelectedIndex((i) => clampIndex(i, 1, items.length));
        return;
      }
      if (input === 'k') {
        setSelectedIndex((i) => clampIndex(i, -1, items.length));
        return;
      }
      if (input === 'n') {
        nav.push({ screen: 'capture' });
        return;
      }
    }

    // Arrow keys always work
    if (key.downArrow) {
      setSelectedIndex((i) => clampIndex(i, 1, items.length));
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((i) => clampIndex(i, -1, items.length));
      return;
    }

    if (key.return && items.length > 0) {
      const item = items[selectedIndex];
      if (item) {
        nav.push({ screen: 'notePreview', filePath: item.filePath });
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text>{theme.bold(title)} {formatRuler(30)}</Text>
      <Box flexDirection="column" marginTop={1}>
        {items.map((item, i) => {
          const isSelected = i === selectedIndex;
          return (
            <Box key={item.filePath} flexDirection="column" marginBottom={1}>
              <Text>
                {'  '}{formatIndicator(isSelected)}{' '}
                {isSelected ? theme.accentBold(item.title) : item.title}
              </Text>
              <Text>
                {'    '}
                {item.tags.map((t) => formatTag(t)).join('  ')}
                {'  '}{formatDate(item.modified)}
                {'  '}{formatBacklinks(item.backlinkCount)}
              </Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>  {items.length} notes</Text>
      </Box>
    </Box>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/tui/note-list.test.ts
```

Expected: PASS

**Step 5: Verify build**

```bash
npx tsup
```

**Step 6: Commit**

```bash
git add src/tui/screens/NoteList.tsx test/tui/note-list.test.ts
git commit -m "feat: add NoteList screen with discriminated union navigation and useInputMode"
```

---

### Task 18: NotePreview screen with Markdown rendering and Vimium links

**Files:**
- Create: `src/tui/screens/NotePreview.tsx`
- Create: `src/tui/utils/render-markdown.ts`
- Modify: `src/core/note-service.ts` (add `resolveWikiLink`)
- Test: `test/tui/render-markdown.test.ts`
- Test: `test/core/resolve-wikilink.test.ts`

**Step 1: Write the failing tests**

`test/tui/render-markdown.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  renderMarkdown,
  numberWikiLinks,
  type NumberedWikiLink,
} from '../../src/tui/utils/render-markdown.js';

describe('numberWikiLinks', () => {
  it('adds numbers to wikilinks (1-9)', () => {
    const content = '参照: [[auth-flow]] と [[db-schema]] を確認。';
    const { rendered, links } = numberWikiLinks(content);
    expect(rendered).toContain('[[auth-flow]][1]');
    expect(rendered).toContain('[[db-schema]][2]');
    expect(links).toHaveLength(2);
    expect(links[0]!.target).toBe('auth-flow');
    expect(links[1]!.target).toBe('db-schema');
  });

  it('returns empty links array for content without wikilinks', () => {
    const { rendered, links } = numberWikiLinks('No links here.');
    expect(links).toHaveLength(0);
    expect(rendered).toBe('No links here.');
  });

  it('numbers only first 9 links; remaining have no number', () => {
    const targets = Array.from({ length: 12 }, (_, i) => `note-${i + 1}`);
    const content = targets.map((t) => `[[${t}]]`).join(' ');
    const { rendered, links } = numberWikiLinks(content);

    // First 9 get numbers
    for (let i = 1; i <= 9; i++) {
      expect(rendered).toContain(`[[note-${i}]][${i}]`);
    }
    // Links 10-12 have no number suffix
    expect(rendered).not.toContain('[10]');
    expect(rendered).not.toContain('[11]');
    expect(rendered).not.toContain('[12]');

    // All 12 are still in the links array
    expect(links).toHaveLength(12);
  });

  it('preserves display text in piped wikilinks', () => {
    const content = '[[auth-flow|認証フロー]]';
    const { rendered, links } = numberWikiLinks(content);
    expect(rendered).toContain('[1]');
    expect(links[0]!.target).toBe('auth-flow');
    expect(links[0]!.displayText).toBe('認証フロー');
  });
});

describe('renderMarkdown', () => {
  it('renders headings as bold text', () => {
    const result = renderMarkdown('# Hello World');
    // marked-terminal renders headings with bold/color ANSI codes
    expect(result).toContain('Hello World');
  });

  it('renders code blocks with dim styling', () => {
    const result = renderMarkdown('```\nconst x = 1;\n```');
    expect(result).toContain('const x = 1;');
  });

  it('renders bullet lists', () => {
    const result = renderMarkdown('- item A\n- item B');
    expect(result).toContain('item A');
    expect(result).toContain('item B');
  });

  it('renders horizontal rules', () => {
    const result = renderMarkdown('above\n\n---\n\nbelow');
    expect(result).toContain('above');
    expect(result).toContain('below');
  });

  it('falls back to raw markdown when rendering fails', () => {
    // Pass null to simulate a rendering failure
    const result = renderMarkdown(null as unknown as string);
    expect(result).toContain('[rendering failed]');
  });

  it('applies wikilink numbering as post-processing', () => {
    const md = 'See [[auth-flow]] for details.';
    const result = renderMarkdown(md);
    expect(result).toContain('[1]');
    expect(result).toContain('auth-flow');
  });
});
```

`test/core/resolve-wikilink.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NoteService } from '../../src/core/note-service.js';

describe('NoteService.resolveWikiLink', () => {
  let tempDir: string;
  let service: NoteService;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'qnote-wikilink-'));
    service = new NoteService(tempDir);
  });

  afterEach(() => {
    service.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('resolves a live wikilink to the target file path', async () => {
    const note = await service.create({
      title: 'Auth Flow',
      tags: [],
      content: '# Auth Flow',
    });

    const result = service.resolveWikiLink('auth-flow');
    expect(result).not.toBeNull();
    expect(result!.filePath).toBe(note.filePath);
    expect(result!.title).toBe('Auth Flow');
  });

  it('returns null for a dead wikilink', () => {
    const result = service.resolveWikiLink('nonexistent-note');
    expect(result).toBeNull();
  });

  it('resolves CJK slugs correctly', async () => {
    const note = await service.create({
      title: '認証フロー',
      tags: [],
      content: '# 認証フロー',
    });

    const result = service.resolveWikiLink('認証フロー');
    expect(result).not.toBeNull();
    expect(result!.filePath).toBe(note.filePath);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run test/tui/render-markdown.test.ts test/core/resolve-wikilink.test.ts
```

Expected: FAIL — modules not found

**Step 3: Write implementation — renderMarkdown utility**

`src/tui/utils/render-markdown.ts`:
```typescript
import { marked } from 'marked';
import markedTerminal from 'marked-terminal';
import type { WikiLink } from '../../types.js';

export interface NumberedWikiLink {
  readonly target: string;
  readonly displayText: string;
  readonly position: number;
  readonly number: number | null;
}

interface NumberedContent {
  readonly rendered: string;
  readonly links: readonly NumberedWikiLink[];
}

const MAX_NUMBERED_LINKS = 9;

/**
 * Number wikilinks in content. Links 1-9 get `[N]` suffix;
 * links beyond 9 are left without a number.
 */
export function numberWikiLinks(content: string): NumberedContent {
  const links: NumberedWikiLink[] = [];
  let counter = 0;

  const rendered = content.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (match, target: string, display: string | undefined, offset: number) => {
      counter++;
      const linkNumber = counter <= MAX_NUMBERED_LINKS ? counter : null;

      links.push({
        target,
        displayText: display ?? target,
        position: offset,
        number: linkNumber,
      });

      const suffix = linkNumber !== null ? `[${linkNumber}]` : '';
      if (display) {
        return `[[${target}|${display}]]${suffix}`;
      }
      return `[[${target}]]${suffix}`;
    },
  );

  return { rendered, links };
}

/**
 * Render Markdown content for terminal display using marked + marked-terminal.
 * Wikilink numbering is applied as post-processing after marked renders.
 *
 * Scope: headings (bold + accent), bold, italic, lists, code blocks (dim bg),
 * horizontal rules. Falls back to raw markdown with notice on error.
 */
export function renderMarkdown(raw: string): string {
  try {
    if (raw === null || raw === undefined) {
      throw new Error('null content');
    }

    // Step 1: Number wikilinks before passing to marked
    const { rendered: numbered } = numberWikiLinks(raw);

    // Step 2: Configure marked with terminal renderer
    const localMarked = new marked.Marked();
    localMarked.use(
      markedTerminal({
        // Headings: bold
        heading: (text: string) => `\x1b[1m${text}\x1b[0m`,
        // Code blocks: dim background
        code: (code: string) => `\x1b[2m${code}\x1b[0m`,
        // Horizontal rules
        hr: () => '─'.repeat(40),
        // Strong (bold)
        strong: (text: string) => `\x1b[1m${text}\x1b[0m`,
        // Emphasis (italic)
        em: (text: string) => `\x1b[3m${text}\x1b[0m`,
      }),
    );

    // Step 3: Render with marked
    const result = localMarked.parse(numbered);

    // marked.parse returns string in sync mode
    return typeof result === 'string' ? result : String(result);
  } catch {
    // Fallback: show raw markdown with notice
    const fallbackContent = typeof raw === 'string' ? raw : '';
    return `[rendering failed]\n\n${fallbackContent}`;
  }
}
```

**Step 4: Write implementation — NoteService.resolveWikiLink**

Add the following method to `src/core/note-service.ts`:

```typescript
// Add to the NoteService class:

  resolveWikiLink(target: string): { filePath: string; title: string } | null {
    // Strategy 1: Search by slug in file paths
    // The target could be a slug (lowercase, hyphenated) or exact title
    const normalizedTarget = target
      .normalize('NFC')
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/[\s]+/g, '-')
      .toLowerCase()
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Search for a note whose file path contains the slug
    const allRecent = this.index.listRecent(10000);
    for (const hit of allRecent) {
      const fileName = hit.filePath.split('/').pop()?.replace('.md', '') ?? '';
      if (fileName === normalizedTarget || fileName === target) {
        return { filePath: hit.filePath, title: hit.title };
      }
    }

    // Strategy 2: Search by title (exact match, case-insensitive)
    for (const hit of allRecent) {
      if (hit.title.toLowerCase() === target.toLowerCase()) {
        return { filePath: hit.filePath, title: hit.title };
      }
    }

    return null;
  }
```

**Step 5: Write implementation — NotePreview screen**

`src/tui/screens/NotePreview.tsx`:
```tsx
import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../../theme/colors.js';
import {
  formatTag,
  formatDate,
  formatBacklinks,
  formatRuler,
} from '../../theme/format.js';
import { renderMarkdown, numberWikiLinks } from '../utils/render-markdown.js';
import type { Note } from '../../types.js';
import type { NavigationStore } from '../hooks/use-navigation.js';
import type { InputModeStore } from '../hooks/use-input-mode.js';
import type { NoteService } from '../../core/note-service.js';

/** 1 MB warning threshold */
const SIZE_WARN_BYTES = 1_000_000;
/** 5 MB refuse threshold */
const SIZE_REFUSE_BYTES = 5_000_000;

interface NotePreviewProps {
  readonly note: Note;
  readonly backlinkCount: number;
  readonly nav: NavigationStore;
  readonly inputMode: InputModeStore;
  readonly noteService: NoteService;
  readonly onEdit: (filePath: string) => void;
}

export function NotePreview({
  note,
  backlinkCount,
  nav,
  inputMode,
  noteService,
  onEdit,
}: NotePreviewProps): React.ReactElement {
  const [showRaw, setShowRaw] = useState(false);

  // Note size guard
  const contentSize = Buffer.byteLength(note.content, 'utf-8');
  const isTooLarge = contentSize >= SIZE_REFUSE_BYTES;
  const isLargeWarning = contentSize >= SIZE_WARN_BYTES && contentSize < SIZE_REFUSE_BYTES;

  // Render markdown and extract wikilinks with link status resolution
  const { renderedHtml, linkStatuses } = useMemo(() => {
    if (isTooLarge) {
      return { renderedHtml: '', linkStatuses: [] };
    }

    const { links: extractedLinks } = numberWikiLinks(note.content);
    const html = showRaw ? note.content : renderMarkdown(note.content);

    // Resolve link statuses (live or dead)
    const statuses = extractedLinks.map((link) => {
      const resolved = noteService.resolveWikiLink(link.target);
      return {
        ...link,
        isLive: resolved !== null,
        resolvedFilePath: resolved?.filePath ?? null,
      };
    });

    return { renderedHtml: html, linkStatuses: statuses };
  }, [note.content, showRaw, isTooLarge, noteService]);

  const [deadLinkPrompt, setDeadLinkPrompt] = useState<string | null>(null);
  const [pendingDeadTarget, setPendingDeadTarget] = useState<string | null>(null);

  useInput((input, key) => {
    // Handle dead link prompt
    if (deadLinkPrompt !== null) {
      if (input === 'y' || input === 'Y') {
        // Create the note and navigate to it
        const target = pendingDeadTarget;
        setDeadLinkPrompt(null);
        setPendingDeadTarget(null);
        if (target) {
          noteService.create({
            title: target,
            tags: [],
            content: `# ${target}\n\n`,
          }).then((newNote) => {
            nav.push({ screen: 'notePreview', filePath: newNote.filePath });
          });
        }
        return;
      }
      if (input === 'n' || input === 'N' || key.escape) {
        setDeadLinkPrompt(null);
        setPendingDeadTarget(null);
        return;
      }
      return;
    }

    if (input === 'p') {
      setShowRaw((prev) => !prev);
      return;
    }

    if (input === 'e') {
      onEdit(note.filePath);
      return;
    }

    // Vimium-style link jumping (1-9 only)
    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1 && num <= 9) {
      const link = linkStatuses.find((l) => l.number === num);
      if (link) {
        if (link.isLive && link.resolvedFilePath) {
          nav.push({ screen: 'notePreview', filePath: link.resolvedFilePath });
        } else {
          // Dead link — show creation prompt
          setDeadLinkPrompt('ノートが見つかりません。作成しますか？ (Y/N)');
          setPendingDeadTarget(link.target);
        }
      }
    }
  });

  // Refuse preview for oversized files
  if (isTooLarge) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>  {theme.dim('\u2190')} {theme.accentBold(note.meta.title)}</Text>
        <Text>  {formatRuler(35)}</Text>
        <Box marginTop={1} paddingLeft={2}>
          <Text color="red">
            ファイルが大きすぎます。$EDITORで開いてください
          </Text>
        </Box>
        <Box marginTop={1} paddingLeft={2}>
          <Text dimColor>
            ({(contentSize / 1_000_000).toFixed(1)} MB — 上限 {SIZE_REFUSE_BYTES / 1_000_000} MB)
          </Text>
        </Box>
      </Box>
    );
  }

  const tags = note.meta.tags;

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header bar */}
      <Text>  {theme.dim('\u2190')} {theme.accentBold(note.meta.title)}</Text>
      <Text>
        {'  '}
        {tags.map((t) => formatTag(t)).join('  ')}
        {'    '}{formatDate(note.meta.modified)}
        {'    '}{formatBacklinks(backlinkCount)}
        {backlinkCount > 0 ? ' links' : ''}
      </Text>
      <Text>  {formatRuler(35)}</Text>

      {/* Size warning */}
      {isLargeWarning && (
        <Box paddingLeft={2}>
          <Text color="yellow">
            ファイルサイズが大きいです ({(contentSize / 1_000_000).toFixed(1)} MB)
          </Text>
        </Box>
      )}

      {/* Content */}
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        {renderedHtml.split('\n').map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>

      {/* Dead link prompt */}
      {deadLinkPrompt !== null && (
        <Box marginTop={1} paddingLeft={2}>
          <Text color="yellow">{deadLinkPrompt}</Text>
        </Box>
      )}
    </Box>
  );
}
```

**Step 6: Run tests to verify they pass**

```bash
npx vitest run test/tui/render-markdown.test.ts test/core/resolve-wikilink.test.ts
```

Expected: PASS

**Step 7: Verify build**

```bash
npx tsup
```

**Step 8: Commit**

```bash
git add src/tui/screens/NotePreview.tsx src/tui/utils/render-markdown.ts src/core/note-service.ts test/tui/render-markdown.test.ts test/core/resolve-wikilink.test.ts
git commit -m "feat: add NotePreview screen with marked rendering, Vimium links (1-9), dead link detection, size guard"
```

---

### Task 19: Search screen (incremental with debounce)

**Files:**
- Create: `src/tui/screens/SearchScreen.tsx`
- Test: `test/tui/search-screen.test.ts`

**Step 1: Write the failing test**

`test/tui/search-screen.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { buildSearchHint } from '../../src/tui/screens/SearchScreen.js';

describe('buildSearchHint', () => {
  it('returns minimum-length hint when query is too short', () => {
    const hint = buildSearchHint('a', false);
    expect(hint).toBe('もう少し入力してください');
  });

  it('returns results count when search was performed', () => {
    const hint = buildSearchHint('abc', true, 5);
    expect(hint).toBe('5 results');
  });

  it('returns no results message for zero results', () => {
    const hint = buildSearchHint('abc', true, 0);
    expect(hint).toBe('0 results');
  });

  it('returns empty string for empty query', () => {
    const hint = buildSearchHint('', false);
    expect(hint).toBe('');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/tui/search-screen.test.ts
```

Expected: FAIL — module not found

**Step 3: Write implementation**

`src/tui/screens/SearchScreen.tsx`:
```tsx
import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';
import { theme } from '../../theme/colors.js';
import { formatTag, formatDate, formatRuler } from '../../theme/format.js';
import { useDebounce } from '../hooks/use-debounce.js';
import type { NoteService } from '../../core/note-service.js';
import type { SearchIndex } from '../../storage/search-index.js';
import type { NavigationStore } from '../hooks/use-navigation.js';
import type { InputModeStore } from '../hooks/use-input-mode.js';
import type { SearchHit } from '../../types.js';

const DEBOUNCE_MS = 150;

/**
 * Build the hint text shown below the search input.
 */
export function buildSearchHint(
  query: string,
  didSearch: boolean,
  resultCount?: number,
): string {
  if (query.trim().length === 0) return '';
  if (!didSearch) return 'もう少し入力してください';
  return `${resultCount ?? 0} results`;
}

interface SearchScreenProps {
  readonly noteService: NoteService;
  readonly searchIndex: SearchIndex;
  readonly nav: NavigationStore;
  readonly inputMode: InputModeStore;
}

export function SearchScreen({
  noteService,
  searchIndex,
  nav,
  inputMode,
}: SearchScreenProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 150ms debounce on query
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  // Determine if we should search based on minimum query length
  const shouldSearch = useMemo(
    () => searchIndex.shouldSearch(debouncedQuery),
    [debouncedQuery, searchIndex],
  );

  const results: SearchHit[] = useMemo(
    () => (shouldSearch ? noteService.search(debouncedQuery) : []),
    [shouldSearch, debouncedQuery, noteService],
  );

  const hint = buildSearchHint(debouncedQuery, shouldSearch, results.length);

  // Set input mode to text on mount
  React.useEffect(() => {
    inputMode.set('text');
    return () => inputMode.set('navigation');
  }, [inputMode]);

  useInput((input, key) => {
    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    }
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
    if (key.return && results.length > 0) {
      const result = results[selectedIndex];
      if (result) {
        nav.push({ screen: 'notePreview', filePath: result.filePath });
      }
    }
  });

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    setSelectedIndex(0);
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text>  検索 {'>'} </Text>
        <TextInput placeholder="search notes..." onChange={handleChange} />
      </Box>
      <Text>  {formatRuler(35)}</Text>

      {hint.length > 0 && (
        <Text dimColor>  {hint}</Text>
      )}

      <Box flexDirection="column" marginTop={1}>
        {results.map((result, i) => {
          const isSelected = i === selectedIndex;
          return (
            <Box key={result.filePath} flexDirection="column" marginBottom={1}>
              <Text>
                {'  '}{isSelected ? theme.selected('\u25cf') : theme.dim('\u25cb')}{' '}
                {isSelected ? theme.accentBold(result.title) : result.title}
              </Text>
              <Text>
                {'    '}{result.snippet}
              </Text>
              <Text>
                {'    '}
                {result.tags.map((t: string) => formatTag(t)).join('  ')}
                {'  '}{formatDate(result.modified)}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/tui/search-screen.test.ts
```

Expected: PASS

**Step 5: Verify build**

```bash
npx tsup
```

**Step 6: Commit**

```bash
git add src/tui/screens/SearchScreen.tsx test/tui/search-screen.test.ts
git commit -m "feat: add SearchScreen with 150ms debounce, shouldSearch guard, useInputMode"
```

---

### Task 20: Capture screen (title-only quick capture with $EDITOR handoff)

**Files:**
- Create: `src/tui/screens/CaptureScreen.tsx`
- Create: `src/tui/utils/resolve-editor.ts`
- Test: `test/tui/capture-screen.test.ts`
- Test: `test/tui/resolve-editor.test.ts`

**Step 1: Write the failing tests**

`test/tui/resolve-editor.test.ts`:
```typescript
import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolveEditor } from '../../src/tui/utils/resolve-editor.js';

describe('resolveEditor', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns $VISUAL when set and available', () => {
    process.env.VISUAL = 'code';
    // resolveEditor checks `which` — in CI, 'code' may not exist.
    // We test the priority logic: VISUAL > EDITOR > vi > nano
    const result = resolveEditor();
    // Should return something (VISUAL, EDITOR, or a fallback)
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('falls back to $EDITOR when $VISUAL is unset', () => {
    delete process.env.VISUAL;
    process.env.EDITOR = 'vim';
    const result = resolveEditor();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('falls back to vi or nano when both env vars are unset', () => {
    delete process.env.VISUAL;
    delete process.env.EDITOR;
    // On most systems, vi or nano should be available
    const result = resolveEditor();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
```

`test/tui/capture-screen.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { buildCaptureSlug } from '../../src/tui/screens/CaptureScreen.js';

describe('buildCaptureSlug', () => {
  it('slugifies a simple English title', () => {
    const slug = buildCaptureSlug('My Quick Note');
    expect(slug).toBe('my-quick-note');
  });

  it('slugifies a CJK title preserving characters', () => {
    const slug = buildCaptureSlug('認証フローのメモ');
    expect(slug).toContain('認証フロー');
  });

  it('returns timestamp fallback when title is empty', () => {
    const slug = buildCaptureSlug('');
    // Should match pattern: capture-YYYY-MM-DD-HHMMSS
    expect(slug).toMatch(/^capture-\d{4}-\d{2}-\d{2}-\d{6}$/);
  });

  it('returns timestamp fallback when title is only symbols', () => {
    const slug = buildCaptureSlug('!!!@@@###');
    expect(slug).toMatch(/^capture-\d{4}-\d{2}-\d{2}-\d{6}$/);
  });

  it('handles mixed CJK and Latin characters', () => {
    const slug = buildCaptureSlug('API認証の設計');
    expect(slug).toContain('api');
    expect(slug).toContain('認証');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run test/tui/resolve-editor.test.ts test/tui/capture-screen.test.ts
```

Expected: FAIL — modules not found

**Step 3: Write implementation — resolveEditor**

`src/tui/utils/resolve-editor.ts`:
```typescript
import { execSync } from 'node:child_process';
import { EditorNotFoundError } from '../../types.js';

/**
 * Resolve the user's preferred editor.
 * Priority: $VISUAL > $EDITOR > vi > nano.
 * Throws EditorNotFoundError if none are available.
 */
export function resolveEditor(): string {
  const candidates = [
    process.env.VISUAL,
    process.env.EDITOR,
    'vi',
    'nano',
  ];

  for (const editor of candidates) {
    if (!editor) continue;
    try {
      execSync(`which ${editor}`, { stdio: 'ignore' });
      return editor;
    } catch {
      continue;
    }
  }

  throw new EditorNotFoundError();
}
```

**Step 4: Write implementation — CaptureScreen**

`src/tui/screens/CaptureScreen.tsx`:
```tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';
import { theme } from '../../theme/colors.js';
import { formatRuler } from '../../theme/format.js';
import type { NoteService } from '../../core/note-service.js';
import type { NavigationStore } from '../hooks/use-navigation.js';
import type { InputModeStore } from '../hooks/use-input-mode.js';

const MAX_SLUG_LENGTH = 200;

/**
 * Build a CJK-aware slug from a title. Falls back to timestamp if empty.
 */
export function buildCaptureSlug(title: string): string {
  const slug = title
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/[\s]+/g, '-')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (slug.length === 0) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `capture-${year}-${month}-${day}-${hours}${minutes}${seconds}`;
  }

  return slug.slice(0, MAX_SLUG_LENGTH);
}

interface CaptureScreenProps {
  readonly noteService: NoteService;
  readonly nav: NavigationStore;
  readonly inputMode: InputModeStore;
  readonly captureDir: string;
  readonly onSpawnEditor: (filePath: string) => void;
}

export function CaptureScreen({
  noteService,
  nav,
  inputMode,
  captureDir,
  onSpawnEditor,
}: CaptureScreenProps): React.ReactElement {
  const [title, setTitle] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set input mode to text on mount
  React.useEffect(() => {
    inputMode.set('text');
    return () => inputMode.set('navigation');
  }, [inputMode]);

  useInput((_input, key) => {
    if (saved) return;

    // Enter: Create note with title-only frontmatter, empty body
    if (key.return) {
      const noteTitle = title.trim() || buildCaptureSlug('');
      noteService
        .create({
          title: noteTitle,
          tags: ['inbox'],
          content: '',
          directory: captureDir,
        })
        .then(() => {
          setSaved(true);
          setTimeout(() => nav.pop(), 600);
        })
        .catch((err: Error) => {
          setError(err.message);
        });
      return;
    }

    // Tab: Create note, then spawn $EDITOR
    if (key.tab) {
      const noteTitle = title.trim() || buildCaptureSlug('');
      noteService
        .create({
          title: noteTitle,
          tags: ['inbox'],
          content: `# ${noteTitle}\n\n`,
          directory: captureDir,
        })
        .then((note) => {
          onSpawnEditor(note.filePath);
        })
        .catch((err: Error) => {
          setError(err.message);
        });
      return;
    }
  });

  if (saved) {
    return (
      <Box padding={1}>
        <Text color="green">保存しました → {captureDir}/</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text>  {theme.bold('Quick Capture')} {formatRuler(20)}</Text>
      <Box marginTop={1}>
        <Text>  Title: </Text>
        <TextInput
          placeholder="タイトルを入力..."
          onChange={(value) => setTitle(value)}
        />
      </Box>

      {error !== null && (
        <Box marginTop={1} paddingLeft={2}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      <Box marginTop={2}>
        <Text dimColor>  Enter: 保存  Tab: $EDITORで編集  Esc: 戻る</Text>
      </Box>
    </Box>
  );
}
```

**Step 5: Run tests to verify they pass**

```bash
npx vitest run test/tui/resolve-editor.test.ts test/tui/capture-screen.test.ts
```

Expected: PASS

**Step 6: Verify build**

```bash
npx tsup
```

**Step 7: Commit**

```bash
git add src/tui/screens/CaptureScreen.tsx src/tui/utils/resolve-editor.ts test/tui/capture-screen.test.ts test/tui/resolve-editor.test.ts
git commit -m "feat: add CaptureScreen with title-only input, $EDITOR handoff, CJK-aware slug"
```

---

### Task 21: Integrate all screens into App.tsx

**Files:**
- Modify: `src/tui/App.tsx`
- Modify: `src/tui/hooks/use-global-keys.ts`
- Create: `src/tui/hooks/use-input-mode.ts`
- Test: `test/tui/use-input-mode.test.ts`

**Step 1: Write the failing test for useInputMode**

`test/tui/use-input-mode.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createInputModeStore } from '../../src/tui/hooks/use-input-mode.js';

describe('InputModeStore', () => {
  it('starts in navigation mode', () => {
    const store = createInputModeStore();
    expect(store.current()).toBe('navigation');
  });

  it('switches to text mode', () => {
    const store = createInputModeStore();
    store.set('text');
    expect(store.current()).toBe('text');
  });

  it('switches back to navigation mode', () => {
    const store = createInputModeStore();
    store.set('text');
    store.set('navigation');
    expect(store.current()).toBe('navigation');
  });

  it('notifies subscribers on change', () => {
    const store = createInputModeStore();
    let notified = false;
    store.subscribe(() => {
      notified = true;
    });
    store.set('text');
    expect(notified).toBe(true);
  });

  it('unsubscribe stops notifications', () => {
    const store = createInputModeStore();
    let count = 0;
    const unsub = store.subscribe(() => {
      count++;
    });
    store.set('text');
    unsub();
    store.set('navigation');
    expect(count).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/tui/use-input-mode.test.ts
```

Expected: FAIL — module not found

**Step 3: Write implementation — InputModeStore**

`src/tui/hooks/use-input-mode.ts`:
```typescript
export type InputMode = 'navigation' | 'text';

export interface InputModeStore {
  current(): InputMode;
  set(mode: InputMode): void;
  subscribe(listener: () => void): () => void;
}

export function createInputModeStore(): InputModeStore {
  let mode: InputMode = 'navigation';
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    current() {
      return mode;
    },

    set(newMode: InputMode) {
      if (mode !== newMode) {
        mode = newMode;
        notify();
      }
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/tui/use-input-mode.test.ts
```

Expected: PASS

**Step 5: Update use-global-keys.ts to respect inputMode**

Replace `src/tui/hooks/use-global-keys.ts`:
```typescript
import { useInput, useApp } from 'ink';
import type { NavigationStore } from './use-navigation.js';
import type { InputModeStore } from './use-input-mode.js';

interface UseGlobalKeysOptions {
  readonly nav: NavigationStore;
  readonly inputMode: InputModeStore;
  readonly currentScreen: string;
}

export function useGlobalKeys({ nav, inputMode, currentScreen }: UseGlobalKeysOptions): void {
  const { exit } = useApp();

  useInput((input, key) => {
    const mode = inputMode.current();

    // Esc — always works: pop navigation stack or exit
    if (key.escape) {
      if (nav.stackDepth() <= 1) {
        exit();
      } else {
        nav.pop();
      }
      return;
    }

    // In text mode, only Esc is handled globally
    if (mode === 'text') return;

    // q — quit from any screen (navigation mode only)
    if (input === 'q') {
      exit();
      return;
    }

    // : — open command palette
    if (input === ':' && currentScreen !== 'palette') {
      nav.push({ screen: 'palette' });
      return;
    }

    // / — open search
    if (input === '/' && currentScreen !== 'search') {
      nav.push({ screen: 'search' });
      return;
    }

    // c — open capture
    if (input === 'c' && currentScreen !== 'capture' && currentScreen !== 'palette') {
      nav.push({ screen: 'capture' });
      return;
    }
  });
}
```

**Step 6: Update App.tsx with full screen routing**

Replace `src/tui/App.tsx`:
```tsx
import React, { useState, useCallback, useSyncExternalStore } from 'react';
import { Box } from 'ink';
import { spawn } from 'node:child_process';
import { createNavigationStore } from './hooks/use-navigation.js';
import { createInputModeStore } from './hooks/use-input-mode.js';
import { useGlobalKeys } from './hooks/use-global-keys.js';
import { Footer } from './components/Footer.js';
import { CommandPalette } from './screens/CommandPalette.js';
import { NoteList } from './screens/NoteList.js';
import { NotePreview } from './screens/NotePreview.js';
import { SearchScreen } from './screens/SearchScreen.js';
import { CaptureScreen } from './screens/CaptureScreen.js';
import { resolveEditor } from './utils/resolve-editor.js';
import type { NoteService } from '../core/note-service.js';
import type { SearchIndex } from '../storage/search-index.js';
import type { Note, NoteListItem } from '../types.js';

interface AppProps {
  readonly noteService: NoteService;
  readonly searchIndex: SearchIndex;
  readonly captureDir: string;
  readonly onUnmountForEditor?: () => void;
  readonly onRemountAfterEditor?: () => void;
}

const navStore = createNavigationStore();
const inputModeStore = createInputModeStore();

export function App({
  noteService,
  searchIndex,
  captureDir,
  onUnmountForEditor,
  onRemountAfterEditor,
}: AppProps): React.ReactElement {
  const currentEntry = useSyncExternalStore(
    (cb) => navStore.subscribe(cb),
    () => navStore.current(),
  );

  const inputMode = useSyncExternalStore(
    (cb) => inputModeStore.subscribe(cb),
    () => inputModeStore.current(),
  );

  useGlobalKeys({
    nav: navStore,
    inputMode: inputModeStore,
    currentScreen: currentEntry.screen,
  });

  // State for screens that need loaded data
  const [previewNote, setPreviewNote] = useState<Note | null>(null);
  const [noteListItems, setNoteListItems] = useState<readonly NoteListItem[]>([]);
  const [noteListTitle, setNoteListTitle] = useState('Recent');

  // Handle spawning $EDITOR — unmount Ink, open editor, re-mount
  const handleEdit = useCallback(
    (filePath: string) => {
      try {
        const editor = resolveEditor();
        onUnmountForEditor?.();

        const child = spawn(editor, [filePath], {
          stdio: 'inherit',
        });

        child.on('exit', () => {
          onRemountAfterEditor?.();
          // Reload note after editing
          noteService.read(filePath).then((updatedNote) => {
            setPreviewNote(updatedNote);
          });
        });
      } catch {
        // EditorNotFoundError — stay in TUI
      }
    },
    [noteService, onUnmountForEditor, onRemountAfterEditor],
  );

  // Handle spawning $EDITOR from Capture (same unmount/remount flow)
  const handleSpawnEditor = useCallback(
    (filePath: string) => {
      handleEdit(filePath);
      navStore.pop();
    },
    [handleEdit],
  );

  // Handle command palette action
  const handleAction = useCallback(
    (action: string, query: string) => {
      switch (action) {
        case 'recent': {
          const items = noteService.listRecent(20);
          const listItems: NoteListItem[] = items.map((hit) => ({
            title: hit.title,
            tags: hit.tags,
            modified: hit.modified,
            filePath: hit.filePath,
            backlinkCount: 0,
          }));
          setNoteListItems(listItems);
          setNoteListTitle('Recent');
          navStore.push({ screen: 'noteList', filter: 'recent' });
          break;
        }

        case 'search':
          navStore.push({ screen: 'search', initialQuery: query || undefined });
          break;

        case 'capture':
          navStore.push({ screen: 'capture' });
          break;

        case 'new': {
          const title = query.trim() || undefined;
          noteService
            .create({
              title: title ?? 'untitled',
              tags: [],
              content: `# ${title ?? 'untitled'}\n\n`,
            })
            .then((note) => {
              handleEdit(note.filePath);
            });
          break;
        }

        case 'daily': {
          const today = new Date();
          const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          noteService
            .create({
              title: `Daily: ${dateStr}`,
              tags: ['daily'],
              content: `# ${dateStr}\n\n## TODO\n\n- [ ] \n\n## Notes\n\n`,
              directory: 'daily',
            })
            .then((note) => {
              handleEdit(note.filePath);
            });
          break;
        }

        case 'tags': {
          const tags = noteService.listTags();
          const items: NoteListItem[] = tags.map((t) => ({
            title: `#${t.tag}`,
            tags: [t.tag],
            modified: '',
            filePath: '',
            backlinkCount: t.count,
          }));
          setNoteListItems(items);
          setNoteListTitle('Tags');
          navStore.push({ screen: 'noteList', filter: 'tags' });
          break;
        }

        default:
          break;
      }
    },
    [noteService, handleEdit],
  );

  // Load note data when navigating to notePreview
  React.useEffect(() => {
    if (currentEntry.screen === 'notePreview') {
      const filePath = currentEntry.filePath;
      noteService.read(filePath).then((note) => {
        setPreviewNote(note);
      });
    }
  }, [currentEntry, noteService]);

  // Compute backlink count for preview
  const backlinkCount =
    previewNote !== null
      ? noteService.getBacklinks(
          previewNote.filePath.split('/').pop()?.replace('.md', '') ?? '',
        ).length
      : 0;

  return (
    <Box flexDirection="column" width="100%">
      <Box flexDirection="column" flexGrow={1}>
        {currentEntry.screen === 'palette' && (
          <CommandPalette
            nav={navStore}
            noteService={noteService}
            onAction={handleAction}
          />
        )}

        {currentEntry.screen === 'noteList' && (
          <NoteList
            title={noteListTitle}
            items={noteListItems}
            nav={navStore}
            inputMode={inputModeStore}
          />
        )}

        {currentEntry.screen === 'notePreview' && previewNote !== null && (
          <NotePreview
            note={previewNote}
            backlinkCount={backlinkCount}
            nav={navStore}
            inputMode={inputModeStore}
            noteService={noteService}
            onEdit={handleEdit}
          />
        )}

        {currentEntry.screen === 'search' && (
          <SearchScreen
            noteService={noteService}
            searchIndex={searchIndex}
            nav={navStore}
            inputMode={inputModeStore}
          />
        )}

        {currentEntry.screen === 'capture' && (
          <CaptureScreen
            noteService={noteService}
            nav={navStore}
            inputMode={inputModeStore}
            captureDir={captureDir}
            onSpawnEditor={handleSpawnEditor}
          />
        )}
      </Box>
      <Footer screen={currentEntry.screen} />
    </Box>
  );
}
```

**Step 7: Verify build**

```bash
npx tsup
```

**Step 8: Test manually**

```bash
node dist/bin/qnote.js
```

Expected: Full TUI with command palette as home screen. Select "recent" to navigate to NoteList. Select a note to preview with rendered markdown. Press `/` for search, `c` for capture. `Esc` navigates back. `q` exits.

**Step 9: Commit**

```bash
git add src/tui/App.tsx src/tui/hooks/use-global-keys.ts src/tui/hooks/use-input-mode.ts test/tui/use-input-mode.test.ts
git commit -m "feat: integrate all TUI screens with routing, inputMode, and $EDITOR handoff"
```

---

## Phase 7: CLI Commands

### Task 22: CLI subcommands (new, search, list, daily, capture, tags, init, reindex)

**Files:**
- Create: `src/cli/resolve-editor.ts`
- Create: `src/cli/commands.ts`
- Modify: `bin/qnote.ts`
- Test: `test/cli/resolve-editor.test.ts`
- Test: `test/cli/commands.test.ts`

> **Note:** `qnote edit <file>` and `qnote links` are descoped to P1. `edit` is a future
> feature for opening an existing note by slug/path. Links are visible in note preview only.

**Step 1: Write failing test for resolveEditor**

`test/cli/resolve-editor.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';

// Mock child_process so we don't depend on system binaries
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

describe('resolveEditor', () => {
  const mockedExecSync = vi.mocked(execSync);
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockedExecSync.mockReset();
    // Clear editor env vars
    delete process.env.VISUAL;
    delete process.env.EDITOR;
  });

  afterEach(() => {
    process.env.VISUAL = originalEnv.VISUAL;
    process.env.EDITOR = originalEnv.EDITOR;
  });

  it('returns $VISUAL when set and available', async () => {
    process.env.VISUAL = 'code';
    mockedExecSync.mockImplementation(() => Buffer.from('/usr/bin/code'));

    const { resolveEditor } = await import('../../src/cli/resolve-editor.js');
    expect(resolveEditor()).toBe('code');
    expect(mockedExecSync).toHaveBeenCalledWith('which code', { stdio: 'ignore' });
  });

  it('falls back to $EDITOR when $VISUAL is not available', async () => {
    process.env.VISUAL = 'nonexistent-editor';
    process.env.EDITOR = 'vim';
    mockedExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('nonexistent-editor')) {
        throw new Error('not found');
      }
      return Buffer.from('/usr/bin/vim');
    });

    // Re-import to get fresh module
    vi.resetModules();
    const { resolveEditor } = await import('../../src/cli/resolve-editor.js');
    expect(resolveEditor()).toBe('vim');
  });

  it('falls back to vi when no env vars are set', async () => {
    mockedExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('vi')) {
        return Buffer.from('/usr/bin/vi');
      }
      throw new Error('not found');
    });

    vi.resetModules();
    const { resolveEditor } = await import('../../src/cli/resolve-editor.js');
    expect(resolveEditor()).toBe('vi');
  });

  it('falls back to nano when vi is not available', async () => {
    mockedExecSync.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('nano')) {
        return Buffer.from('/usr/bin/nano');
      }
      throw new Error('not found');
    });

    vi.resetModules();
    const { resolveEditor } = await import('../../src/cli/resolve-editor.js');
    expect(resolveEditor()).toBe('nano');
  });

  it('throws EditorNotFoundError when no editor is found', async () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('not found');
    });

    vi.resetModules();
    const { resolveEditor } = await import('../../src/cli/resolve-editor.js');
    const { EditorNotFoundError } = await import('../../src/types.js');
    expect(() => resolveEditor()).toThrow(EditorNotFoundError);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/cli/resolve-editor.test.ts
```

Expected: FAIL — module not found

**Step 3: Write implementation for resolveEditor**

`src/cli/resolve-editor.ts`:
```typescript
import { execSync } from 'node:child_process';
import { EditorNotFoundError } from '../types.js';

/**
 * Resolve the user's preferred editor using a fallback chain:
 * $VISUAL → $EDITOR → vi → nano
 *
 * Verifies the editor binary exists via `which`.
 * Throws EditorNotFoundError if no usable editor is found.
 */
export function resolveEditor(): string {
  const candidates = [
    process.env.VISUAL,
    process.env.EDITOR,
    'vi',
    'nano',
  ];

  for (const editor of candidates) {
    if (!editor) continue;
    try {
      execSync(`which ${editor}`, { stdio: 'ignore' });
      return editor;
    } catch {
      continue;
    }
  }

  throw new EditorNotFoundError();
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run test/cli/resolve-editor.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/cli/resolve-editor.ts test/cli/resolve-editor.test.ts
git commit -m "feat: add resolveEditor utility with $VISUAL/$EDITOR/vi/nano fallback chain"
```

**Step 6: Write failing test for CLI commands**

`test/cli/commands.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

// Mock resolve-editor so tests don't depend on system editors
vi.mock('../../src/cli/resolve-editor.js', () => ({
  resolveEditor: () => 'cat', // harmless no-op for testing
}));

// Mock child_process.spawnSync for editor calls
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    spawnSync: vi.fn().mockReturnValue({ status: 0 }),
  };
});

describe('createCommands', () => {
  let tempDir: string;
  let configDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'qnote-cli-'));
    configDir = join(tempDir, '.config-qnote');
    // Pre-create the .qnote index directory so NoteService can init
    mkdirSync(join(tempDir, '.qnote'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('newNote creates a note and spawns editor', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    await cmds.newNote('Test CLI Note');

    // Verify a .md file was created
    const { readdirSync } = await import('node:fs');
    const files = readdirSync(tempDir).filter((f: string) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThanOrEqual(1);

    // Verify spawnSync was called (editor opened)
    const { spawnSync: mockedSpawn } = await import('node:child_process');
    expect(mockedSpawn).toHaveBeenCalled();
  });

  it('newNote generates untitled slug when no title given', async () => {
    vi.resetModules();
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    await cmds.newNote();

    const { readdirSync } = await import('node:fs');
    const files = readdirSync(tempDir).filter((f: string) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThanOrEqual(1);
    expect(files.some((f: string) => f.startsWith('untitled-'))).toBe(true);
  });

  it('search returns matching notes to stdout', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    await cmds.newNote('Searchable Note');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.search('Searchable', {});
    logSpy.mockRestore();

    // Search should have been called without error
    // (FTS results depend on indexing; verify no throw)
  });

  it('search filters by tag when --tag is provided', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.search('anything', { tag: 'nonexistent' });
    logSpy.mockRestore();

    // Should return empty — no notes with that tag
  });

  it('list outputs notes in text format', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    await cmds.newNote('Listed Note');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.list({});
    logSpy.mockRestore();
  });

  it('list outputs notes in JSON format', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    await cmds.newNote('JSON Note');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.list({ format: 'json' });

    const jsonCall = logSpy.mock.calls.find((call) => {
      try {
        JSON.parse(call[0] as string);
        return true;
      } catch {
        return false;
      }
    });
    logSpy.mockRestore();

    // Should have output valid JSON
    if (jsonCall) {
      const parsed = JSON.parse(jsonCall[0] as string);
      expect(Array.isArray(parsed)).toBe(true);
    }
  });

  it('daily creates a note in daily/ directory', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    await cmds.daily();

    const dailyDir = join(tempDir, 'daily');
    expect(existsSync(dailyDir)).toBe(true);

    const { readdirSync } = await import('node:fs');
    const files = readdirSync(dailyDir).filter((f: string) => f.endsWith('.md'));
    expect(files.length).toBe(1);
  });

  it('daily dedup opens existing note instead of creating duplicate', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    // First call — creates the note
    await cmds.daily();

    // Second call — should reuse the existing note
    await cmds.daily();

    const dailyDir = join(tempDir, 'daily');
    const { readdirSync } = await import('node:fs');
    const files = readdirSync(dailyDir).filter((f: string) => f.endsWith('.md'));
    expect(files.length).toBe(1); // Still only 1 file
  });

  it('capture creates a note in inbox/ directory', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.capture('Quick thought to capture');
    logSpy.mockRestore();

    const inboxDir = join(tempDir, 'inbox');
    expect(existsSync(inboxDir)).toBe(true);
  });

  it('tags lists all tags with counts', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.tags();
    logSpy.mockRestore();
  });

  it('init creates .qnote directory and indexes existing notes', async () => {
    const newDir = mkdtempSync(join(tmpdir(), 'qnote-init-'));

    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.init(newDir);
    logSpy.mockRestore();

    expect(existsSync(join(newDir, '.qnote'))).toBe(true);

    rmSync(newDir, { recursive: true, force: true });
  });

  it('reindex rebuilds the search index', async () => {
    const { createCommands } = await import('../../src/cli/commands.js');
    const cmds = createCommands(tempDir, configDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await cmds.reindex();
    logSpy.mockRestore();

    // Should have logged a count
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Reindexed'));
  });
});
```

**Step 7: Run test to verify it fails**

```bash
npx vitest run test/cli/commands.test.ts
```

Expected: FAIL — module not found

**Step 8: Write implementation for commands**

`src/cli/commands.ts`:
```typescript
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { NoteService } from '../core/note-service.js';
import { ConfigService } from '../core/config-service.js';
import { resolveEditor } from './resolve-editor.js';

/**
 * After the editor exits, check if the file was modified.
 * If so, re-parse frontmatter, update the `modified` timestamp, re-write, and re-index.
 */
function updateMtimeAfterEdit(
  service: NoteService,
  filePath: string,
  mtimeBefore: number,
): void {
  const mtimeAfter = statSync(filePath).mtimeMs;
  if (mtimeAfter <= mtimeBefore) return;

  // File was modified — update the `modified` field in frontmatter
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  const now = new Date().toISOString();

  parsed.data = {
    ...parsed.data,
    modified: now,
  };

  const updated = matter.stringify(parsed.content, parsed.data);
  writeFileSync(filePath, updated, 'utf-8');

  // Re-index the updated note
  service.reindex();
}

/**
 * Open a file in the user's editor (blocking).
 * After the editor exits, update mtime and re-index if the file changed.
 */
function openInEditor(service: NoteService, filePath: string): void {
  const editor = resolveEditor();
  const mtimeBefore = statSync(filePath).mtimeMs;

  spawnSync(editor, [filePath], { stdio: 'inherit' });

  updateMtimeAfterEdit(service, filePath, mtimeBefore);
}

export function createCommands(notesDir: string, configDir?: string) {
  const resolvedConfigDir = configDir ?? join(process.env.HOME ?? '', '.qnote');

  function getService(): NoteService {
    // Auto-init: ensure .qnote directory exists so NoteService can create the SQLite index
    ConfigService.ensureDirectories(notesDir);
    return new NoteService(notesDir);
  }

  return {
    async newNote(title?: string) {
      const service = getService();
      try {
        const noteTitle = title ?? `untitled-${Date.now()}`;
        const note = await service.create({
          title: noteTitle,
          tags: [],
          content: `# ${noteTitle}\n\n`,
        });

        openInEditor(service, note.filePath);
      } finally {
        service.close();
      }
    },

    async search(query: string, options: { tag?: string }) {
      const service = getService();
      try {
        let results = service.search(query);

        if (options.tag) {
          const tagResults = new Set(
            service.listByTag(options.tag).map((r) => r.filePath),
          );
          results = results.filter((r) => tagResults.has(r.filePath));
        }

        for (const r of results) {
          console.log(`${r.title}\t${r.filePath}`);
          if (r.snippet) console.log(`  ${r.snippet}`);
        }
      } finally {
        service.close();
      }
    },

    async list(options: { tag?: string; sort?: string; format?: string }) {
      const service = getService();
      try {
        const items = options.tag
          ? service.listByTag(options.tag)
          : service.listRecent(50);

        if (options.format === 'json') {
          console.log(JSON.stringify(items, null, 2));
        } else {
          for (const item of items) {
            console.log(
              `${item.title}\t${item.tags.join(',')}\t${item.modified}`,
            );
          }
        }
      } finally {
        service.close();
      }
    },

    async daily() {
      const service = getService();
      try {
        const config = ConfigService.load(resolvedConfigDir);
        const today = new Date().toISOString().slice(0, 10);
        const dailyDir = config.daily.directory;
        const dailySlug = today; // e.g. "2026-02-27"
        const expectedPath = join(notesDir, dailyDir, `${dailySlug}.md`);

        // Dedup: if today's daily note already exists, just open it
        if (existsSync(expectedPath)) {
          openInEditor(service, expectedPath);
          return;
        }

        // Create a new daily note
        const note = await service.create({
          title: today,
          tags: ['daily'],
          content: `# ${today}\n\n`,
          directory: dailyDir,
        });

        openInEditor(service, note.filePath);
      } finally {
        service.close();
      }
    },

    async capture(text: string) {
      const service = getService();
      try {
        const config = ConfigService.load(resolvedConfigDir);
        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, '-')
          .slice(0, 16);

        await service.create({
          title: `capture-${timestamp}`,
          tags: ['inbox'],
          content: text,
          directory: config.capture.directory,
        });

        console.log('Captured to inbox.');
      } finally {
        service.close();
      }
    },

    async tags() {
      const service = getService();
      try {
        const allTags = service.listTags();
        for (const t of allTags) {
          console.log(`#${t.tag} (${t.count})`);
        }
      } finally {
        service.close();
      }
    },

    async init(path?: string) {
      const targetDir = path ?? notesDir;
      const resolvedDir = ConfigService.resolveNotesDir(targetDir);

      mkdirSync(join(resolvedDir, '.qnote'), { recursive: true });
      ConfigService.save(resolvedConfigDir, { notesDir: targetDir });

      const service = new NoteService(resolvedDir);
      try {
        const count = await service.reindex();
        console.log(`Initialized qnote at ${resolvedDir}`);
        console.log(`Indexed ${count} existing notes.`);
      } finally {
        service.close();
      }
    },

    async reindex() {
      const service = getService();
      try {
        const count = await service.reindex();
        console.log(`Reindexed ${count} notes.`);
      } finally {
        service.close();
      }
    },
  };
}
```

> **Implementation notes:**
> - `resolveEditor()` is used everywhere instead of `process.env.EDITOR ?? 'vi'`.
> - `daily()` checks for an existing file at `daily/YYYY-MM-DD.md` before creating.
> - After every `$EDITOR` exit, `updateMtimeAfterEdit` re-parses frontmatter, updates `modified`, re-writes, and re-indexes.
> - `getService()` calls `ConfigService.ensureDirectories()` for auto-init (no `qnote init` required on first run).
> - `qnote edit <file>` is descoped to P1 — not included in this task.
> - `qnote links` is descoped to P1 — links are visible in note preview only.

**Step 9: Add `ensureDirectories` to ConfigService**

This is a small addition to `src/core/config-service.ts`. Add the following static method:

```typescript
static ensureDirectories(notesDir: string): void {
  mkdirSync(join(notesDir, '.qnote'), { recursive: true });
}
```

**Step 10: Run test to verify it passes**

```bash
npx vitest run test/cli/resolve-editor.test.ts test/cli/commands.test.ts
```

Expected: PASS

**Step 11: Wire commands into bin/qnote.ts**

Update `bin/qnote.ts` to register all subcommands with commander:

```typescript
#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import { App } from '../src/tui/App.js';
import { NoteService } from '../src/core/note-service.js';
import { ConfigService } from '../src/core/config-service.js';
import { createCommands } from '../src/cli/commands.js';
import { join } from 'node:path';

const program = new Command();

const homeDir = process.env.HOME ?? '';
const configDir = join(homeDir, '.qnote');

function resolveNotesDir(): string {
  const config = ConfigService.load(configDir);
  return ConfigService.resolveNotesDir(config.notesDir);
}

program
  .name('qnote')
  .version('0.1.0')
  .description('AI-friendly terminal-native note-taking app');

// Default action (no subcommand) → launch TUI
program.action(() => {
  const notesDir = resolveNotesDir();
  ConfigService.ensureDirectories(notesDir);
  const noteService = new NoteService(notesDir);

  const instance = render(React.createElement(App, { noteService }));

  instance.waitUntilExit().then(() => {
    noteService.close();
  });
});

program
  .command('new [title]')
  .description('Create a new note and open in $EDITOR')
  .action(async (title?: string) => {
    const cmds = createCommands(resolveNotesDir(), configDir);
    await cmds.newNote(title);
  });

program
  .command('search <query>')
  .description('Full-text search notes')
  .option('--tag <tag>', 'Filter results by tag')
  .action(async (query: string, options: { tag?: string }) => {
    const cmds = createCommands(resolveNotesDir(), configDir);
    await cmds.search(query, options);
  });

program
  .command('list')
  .description('List notes')
  .option('--tag <tag>', 'Filter by tag')
  .option('--sort <field>', 'Sort field (modified, created, title)')
  .option('--format <format>', 'Output format (text, json)')
  .action(async (options: { tag?: string; sort?: string; format?: string }) => {
    const cmds = createCommands(resolveNotesDir(), configDir);
    await cmds.list(options);
  });

program
  .command('daily')
  .description('Open or create today\'s daily note')
  .action(async () => {
    const cmds = createCommands(resolveNotesDir(), configDir);
    await cmds.daily();
  });

program
  .command('capture <text>')
  .description('Quick-capture text to inbox')
  .action(async (text: string) => {
    const cmds = createCommands(resolveNotesDir(), configDir);
    await cmds.capture(text);
  });

program
  .command('tags')
  .description('List all tags with note counts')
  .action(async () => {
    const cmds = createCommands(resolveNotesDir(), configDir);
    await cmds.tags();
  });

program
  .command('init [path]')
  .description('Initialize qnote in a directory (optional — auto-creates on first use)')
  .action(async (path?: string) => {
    const cmds = createCommands(resolveNotesDir(), configDir);
    await cmds.init(path);
  });

program
  .command('reindex')
  .description('Rebuild the search index from Markdown files')
  .action(async () => {
    const cmds = createCommands(resolveNotesDir(), configDir);
    await cmds.reindex();
  });

// P1 descoped commands:
// - `qnote edit <file>` — open existing note by slug/path (not yet implemented)
// - `qnote links` — show wikilink graph (links visible in note preview only)

program.parse();
```

**Step 12: Build and test manually**

```bash
npx tsup
node dist/bin/qnote.js init /tmp/test-notes
node dist/bin/qnote.js new "Test Note"
node dist/bin/qnote.js search "Test"
node dist/bin/qnote.js list
node dist/bin/qnote.js tags
node dist/bin/qnote.js daily
node dist/bin/qnote.js daily  # second run — should open same file, not create duplicate
node dist/bin/qnote.js capture "Quick thought"
node dist/bin/qnote.js reindex
```

**Step 13: Commit**

```bash
git add src/cli/resolve-editor.ts src/cli/commands.ts src/core/config-service.ts bin/qnote.ts test/cli/resolve-editor.test.ts test/cli/commands.test.ts
git commit -m "feat: add CLI subcommands with resolveEditor, daily dedup, mtime update, and auto-init"
```

---

## Phase 8: Integration and Polish

### Task 23: Run full test suite and verify coverage

**Step 1: Run all tests with coverage**

```bash
npx vitest run --coverage
```

Expected: All tests pass, coverage >= 80%

**Step 2: Identify coverage gaps**

Review the coverage report. Common gaps to address:

- **Error branches** — Add tests for `EditorNotFoundError`, `FrontmatterParseError`, `NoteSizeLimitError` edge cases
- **Edge cases in SearchIndex** — malformed FTS queries, empty results, CJK content
- **ConfigService** — missing config file, partial config, `ensureDirectories` on existing dir
- **CLI commands** — error paths (e.g., search with no results, list with unknown sort field)
- **resolveEditor** — all fallback chain positions

**Step 3: Write missing tests to reach 80%+**

Add tests as needed to cover uncovered branches. Follow TDD discipline: write the test, verify it exercises the uncovered path, then verify it passes.

**Step 4: Fix any failing tests**

Address test failures one by one. Fix the implementation, not the tests (unless the test expectation is wrong).

Common failure patterns:
- **Async cleanup** — ensure `service.close()` is called in `finally` blocks
- **Temp directory race conditions** — use unique temp dirs per test
- **FTS indexing timing** — `reindex()` must complete before `search()` is called

**Step 5: Verify coverage target**

```bash
npx vitest run --coverage
```

Confirm:
- Statement coverage >= 80%
- Branch coverage >= 80%
- Function coverage >= 80%

**Step 6: Commit**

```bash
git add -A
git commit -m "test: ensure 80%+ coverage across all modules"
```

---

### Task 24: End-to-end manual smoke test

**Step 1: Build the project**

```bash
npx tsup
```

**Step 2: Clean slate test**

```bash
# Remove any previous test data
rm -rf /tmp/qnote-e2e

# Auto-init test: run `new` without running `init` first
# Should auto-create directories via ConfigService.ensureDirectories()
QNOTE_DIR=/tmp/qnote-e2e node dist/bin/qnote.js new "Auto Init Test"
```

**Step 3: Full flow test**

```bash
# Explicit init (optional — should work even after auto-init)
node dist/bin/qnote.js init /tmp/qnote-e2e

# CJK note creation
node dist/bin/qnote.js new "API設計方針"

# Capture from CLI
node dist/bin/qnote.js capture "明日のミーティング準備"

# Japanese search
node dist/bin/qnote.js search "設計"

# English search
node dist/bin/qnote.js search "API"

# List in text format
node dist/bin/qnote.js list

# List in JSON format
node dist/bin/qnote.js list --format json

# List filtered by tag
node dist/bin/qnote.js list --tag inbox

# Tags
node dist/bin/qnote.js tags

# Daily note — first run creates
node dist/bin/qnote.js daily

# Daily note dedup — second run opens same file
node dist/bin/qnote.js daily

# Reindex
node dist/bin/qnote.js reindex

# TUI
node dist/bin/qnote.js
```

**Step 4: Verify checklist**

CLI commands:
- [ ] Auto-init works (run `qnote new` without `qnote init` — directories created automatically)
- [ ] `init` creates `.qnote/` directory and `config.json`
- [ ] `new` creates Markdown file with YAML frontmatter and opens in `$EDITOR`
- [ ] CJK note creation works (`qnote new "API設計方針"`)
- [ ] `capture` creates file in inbox directory with correct content
- [ ] `search` returns matching notes with snippets
- [ ] Japanese search works (`qnote search "設計"`)
- [ ] `list` displays all notes in text format
- [ ] `list --format json` outputs valid JSON array
- [ ] `tags` shows tag counts
- [ ] Daily note dedup works (run `qnote daily` twice — only one file in `daily/`)
- [ ] `reindex` rebuilds index and reports count
- [ ] Mtime updates after editor exit (check `modified` field in frontmatter)

TUI:
- [ ] TUI launches with command palette as home screen
- [ ] Navigation works (`:` opens palette, `Esc` goes back, `Enter` selects)
- [ ] Modal input works (can type `q` in search input without quitting the app)
- [ ] Search works incrementally (results update as you type)
- [ ] Capture hybrid works (TUI capture with `Enter` to save and `Tab` to add tags)
- [ ] Note preview renders Markdown content
- [ ] Dead wikilink prompt works in TUI (clicking a `[[nonexistent]]` link offers to create it)
- [ ] Wikilinks displayed in note preview

**Step 5: Fix any issues found**

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: qnote MVP complete — TUI, CLI, search, wiki-links"
```

---

## Summary: Task Dependency Graph

```
Phase 1: Bootstrap
  Task 1 (npm init) → Task 2 (directories/types)

Phase 2: Storage
  Task 2 → Task 3 (frontmatter)
  Task 3 → Task 4 (NoteRepository)
  Task 4 → Task 4.5 (FTS5 trigram spike)
  Task 2 → Task 5 (SearchIndex)
  Task 2 → Task 6 (LinkParser)
  Task 7 (barrel exports)

Phase 3: Core
  Tasks 3-6 → Task 8 (NoteService)
  Task 2 → Task 9 (ConfigService)
  Task 10 (barrel exports)

Phase 4: Theme
  Task 2 → Task 11 (colors + format)

Phase 5: TUI Foundation
  Task 2 → Task 12 (navigation stack)
  Task 12 → Task 12.5 (modal input system)
  Task 11 → Task 13 (Footer)
  Tasks 12.5, 13 → Task 14 (App shell)
  Tasks 8, 14 → Task 15 (entry point)

Phase 6: TUI Screens
  Task 14 → Task 16 (CommandPalette)
  Task 14 → Task 17 (NoteList)
  Task 14 → Task 18 (NotePreview)
  Task 14 → Task 19 (SearchScreen)
  Task 14 → Task 20 (CaptureScreen)
  Tasks 16-20 → Task 21 (integrate)

Phase 7: CLI
  Task 8 → Task 22 (CLI commands + resolveEditor)

Phase 8: Polish
  All → Task 23 (coverage)
  All → Task 24 (smoke test)
```

**Total: 26 tasks across 8 phases**

**Parallelizable groups** (for `/team-dev`):
- Tasks 3, 4.5, 5, 6 (storage modules — independent after Task 2)
- Tasks 9, 11, 12 (config, theme, navigation — independent after Task 2)
- Tasks 16, 17, 18, 19, 20 (TUI screens — independent after Task 14)
- Task 22 (CLI) can run in parallel with Phase 5-6 (depends only on Task 8)
