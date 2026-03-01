import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from 'ink-testing-library';
import { Box } from 'ink';
import { buildDisplayEntries, FindFileScreen } from '../../src/tui/screens/FindFileScreen.js';
import { createNavigationStore } from '../../src/tui/hooks/use-navigation.js';
import { createInputModeStore } from '../../src/tui/hooks/use-input-mode.js';
import { LayoutProvider } from '../../src/tui/hooks/layout-context.js';
import { stripAnsi } from '../helpers/strip-ansi.js';
import type { ScannedFile } from '../../src/storage/file-scanner.js';

vi.mock('../../src/storage/file-scanner.js', () => ({
  scanNoteFiles: vi.fn().mockResolvedValue([]),
}));

function renderFindFile(width = 80) {
  const nav = createNavigationStore();
  const inputMode = createInputModeStore();

  const instance = render(
    React.createElement(
      LayoutProvider,
      null,
      React.createElement(
        Box,
        { flexDirection: 'column' as const, width, height: 24 },
        React.createElement(FindFileScreen, { notesDir: '/tmp/notes', nav, inputMode }),
      ),
    ),
  );

  return { ...instance, nav, inputMode };
}

afterEach(() => {
  cleanup();
});

function makeFile(relativePath: string): ScannedFile {
  return {
    relativePath,
    absolutePath: `/notes/${relativePath}`,
  };
}

describe('buildDisplayEntries', () => {
  it('returns empty array when isLoading is true', () => {
    const files: readonly ScannedFile[] = [makeFile('a.md')];
    const result = buildDisplayEntries(files, '', true);
    expect(result).toEqual([]);
  });

  it('returns all files when query is empty', () => {
    const files: readonly ScannedFile[] = [
      makeFile('alpha.md'),
      makeFile('beta.md'),
    ];
    const result = buildDisplayEntries(files, '', false);
    expect(result).toHaveLength(2);
    expect(result[0]!.relativePath).toBe('alpha.md');
    expect(result[1]!.relativePath).toBe('beta.md');
  });

  it('returns empty array when files is empty and not loading', () => {
    const result = buildDisplayEntries([], '', false);
    expect(result).toEqual([]);
  });

  it('truncates results to 100 entries', () => {
    const files: readonly ScannedFile[] = Array.from({ length: 150 }, (_, i) =>
      makeFile(`file-${String(i).padStart(3, '0')}.md`),
    );
    const result = buildDisplayEntries(files, '', false);
    expect(result).toHaveLength(100);
  });

  it('truncates search results to 100 entries', () => {
    const files: readonly ScannedFile[] = Array.from({ length: 150 }, (_, i) =>
      makeFile(`note-${String(i).padStart(3, '0')}.md`),
    );
    const result = buildDisplayEntries(files, 'note', false);
    expect(result).toHaveLength(100);
  });

  it('filters files by fuzzy matching on relativePath', () => {
    const files: readonly ScannedFile[] = [
      makeFile('projects/todo-app.md'),
      makeFile('daily/2026-02-20-todo.md'),
      makeFile('notes/meeting.md'),
    ];
    const result = buildDisplayEntries(files, 'todo', false);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((f) => f.relativePath.includes('todo'))).toBe(true);
  });

  it('returns empty array when no files match query', () => {
    const files: readonly ScannedFile[] = [
      makeFile('alpha.md'),
      makeFile('beta.md'),
    ];
    const result = buildDisplayEntries(files, 'zzzzzzzzzzz', false);
    expect(result).toEqual([]);
  });

  it('handles CJK filenames in fuzzy search', () => {
    const files: readonly ScannedFile[] = [
      makeFile('日本語ノート.md'),
      makeFile('english-note.md'),
    ];
    const result = buildDisplayEntries(files, '日本語', false);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((f) => f.relativePath === '日本語ノート.md')).toBe(true);
  });
});

describe('FindFileScreen rendering', () => {
  it('shows loading state initially', () => {
    const { lastFrame } = renderFindFile();
    const frame = stripAnsi(lastFrame() ?? '');
    expect(frame).toContain('読み込み中');
  });

  it('renders search input with bold border box after loading', async () => {
    const { lastFrame } = renderFindFile();
    // Wait for async scanNoteFiles mock to resolve and trigger re-render
    await new Promise((resolve) => setTimeout(resolve, 50));
    const frame = stripAnsi(lastFrame() ?? '');
    // Bold border box has corner characters ┏ and ┗ (not from ruler)
    expect(frame).toContain('┏');
    expect(frame).toContain('┗');
  });

  it('renders label text inside the bordered area after loading', async () => {
    const { lastFrame } = renderFindFile();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const frame = lastFrame() ?? '';
    expect(frame).toContain('ファイル検索');
  });
});
