import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from 'ink-testing-library';
import { Box } from 'ink';
import Fuse from 'fuse.js';
import { buildTagDisplayEntries, TagListScreen, handleTagRenameInput } from '../../../src/tui/screens/TagListScreen.js';
import type { TagRenameState } from '../../../src/tui/screens/TagListScreen.js';
import { createNavigationStore } from '../../../src/tui/hooks/use-navigation.js';
import { createInputModeStore } from '../../../src/tui/hooks/use-input-mode.js';
import { LayoutProvider } from '../../../src/tui/hooks/layout-context.js';
import { stripAnsi } from '../../helpers/strip-ansi.js';
import type { TagCount } from '../../../src/storage/search-index.js';
import type { NoteService } from '../../../src/core/note-service.js';

function makeTag(tag: string, count: number): TagCount {
  return { tag, count };
}

const mockTags: TagCount[] = [
  makeTag('typescript', 5),
  makeTag('react', 3),
  makeTag('日本語', 2),
  makeTag('daily', 10),
];

function createMockNoteService(tags: TagCount[] = mockTags): NoteService {
  return {
    listTags: vi.fn().mockReturnValue(tags),
  } as unknown as NoteService;
}

function renderTagList(noteService?: NoteService, width = 80) {
  const nav = createNavigationStore();
  const inputMode = createInputModeStore();
  const ns = noteService ?? createMockNoteService();

  const instance = render(
    React.createElement(
      LayoutProvider,
      null,
      React.createElement(
        Box,
        { flexDirection: 'column' as const, width, height: 24 },
        React.createElement(TagListScreen, { noteService: ns, nav, inputMode }),
      ),
    ),
  );

  return { ...instance, nav, inputMode, noteService: ns };
}

afterEach(() => {
  cleanup();
});

describe('buildTagDisplayEntries', () => {
  it('returns all tags when query is empty', () => {
    const result = buildTagDisplayEntries(mockTags, '');
    expect(result).toHaveLength(4);
    expect(result[0]!.tag).toBe('typescript');
  });

  it('returns empty array when tags is empty', () => {
    const result = buildTagDisplayEntries([], '');
    expect(result).toEqual([]);
  });

  it('filters tags by fuzzy matching', () => {
    const result = buildTagDisplayEntries(mockTags, 'type');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((t) => t.tag === 'typescript')).toBe(true);
  });

  it('returns empty array when no tags match query', () => {
    const result = buildTagDisplayEntries(mockTags, 'zzzzzzzzzzz');
    expect(result).toEqual([]);
  });

  it('handles CJK tag names in fuzzy search', () => {
    const result = buildTagDisplayEntries(mockTags, '日本語');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((t) => t.tag === '日本語')).toBe(true);
  });

  it('truncates results to 100 entries', () => {
    const manyTags = Array.from({ length: 150 }, (_, i) =>
      makeTag(`tag-${String(i).padStart(3, '0')}`, i),
    );
    const result = buildTagDisplayEntries(manyTags, '');
    expect(result).toHaveLength(100);
  });

  it('uses provided fuse instance for search', () => {
    const fuse = new Fuse([...mockTags], { keys: ['tag'], threshold: 0.4 });
    const result = buildTagDisplayEntries(mockTags, 'react', fuse);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((t) => t.tag === 'react')).toBe(true);
  });
});

describe('TagListScreen rendering', () => {
  it('renders search input with bold border box', () => {
    const { lastFrame } = renderTagList();
    const frame = stripAnsi(lastFrame() ?? '');
    expect(frame).toContain('┏');
    expect(frame).toContain('┗');
  });

  it('renders label text "タグ検索"', () => {
    const { lastFrame } = renderTagList();
    const frame = lastFrame() ?? '';
    expect(frame).toContain('タグ検索');
  });

  it('displays tag count as "N 件"', () => {
    const { lastFrame } = renderTagList();
    const frame = stripAnsi(lastFrame() ?? '');
    expect(frame).toContain('4 件');
  });

  it('shows "タグがありません" when no tags exist', () => {
    const emptyNs = createMockNoteService([]);
    const { lastFrame } = renderTagList(emptyNs);
    const frame = stripAnsi(lastFrame() ?? '');
    expect(frame).toContain('タグがありません');
  });

  it('displays tag names with # prefix and count', () => {
    const { lastFrame } = renderTagList();
    const frame = stripAnsi(lastFrame() ?? '');
    expect(frame).toContain('#typescript');
    expect(frame).toContain('(5)');
  });

  it('sets inputMode to text on mount', () => {
    const { inputMode } = renderTagList();
    expect(inputMode.current()).toBe('text');
  });

  it('restores inputMode to navigation on unmount', () => {
    const { inputMode, unmount } = renderTagList();
    expect(inputMode.current()).toBe('text');
    unmount();
    expect(inputMode.current()).toBe('navigation');
  });

  it('navigates to noteList with tag on Enter', () => {
    const { stdin, nav } = renderTagList();
    // Press Enter to select the first tag
    stdin.write('\r');
    const current = nav.current();
    expect(current.screen).toBe('noteList');
    expect((current as { tag?: string }).tag).toBe('typescript');
  });
});

describe('handleTagRenameInput', () => {
  const idle: TagRenameState = { phase: 'idle' };
  const editing: TagRenameState = { phase: 'editing', oldTag: 'react', newTag: 'react' };
  const confirming: TagRenameState = { phase: 'confirming', oldTag: 'react', newTag: 'vue', pendingCount: 3 };

  it('Ctrl+R enters editing mode with current tag', () => {
    const result = handleTagRenameInput(idle, 'r', { ctrl: true }, 'react');
    expect(result).toEqual({ phase: 'editing', oldTag: 'react', newTag: 'react' });
  });

  it('Ctrl+R does nothing when already editing', () => {
    const result = handleTagRenameInput(editing, 'r', { ctrl: true }, 'react');
    expect(result).toEqual(editing);
  });

  it('Ctrl+R does nothing when no tag is selected', () => {
    const result = handleTagRenameInput(idle, 'r', { ctrl: true }, undefined);
    expect(result).toEqual(idle);
  });

  it('Enter in editing moves to confirming', () => {
    const result = handleTagRenameInput(editing, '', { return: true }, 'react', 3);
    expect(result).toEqual({ phase: 'confirming', oldTag: 'react', newTag: 'react', pendingCount: 3 });
  });

  it('Esc in editing returns to idle', () => {
    const result = handleTagRenameInput(editing, '', { escape: true }, 'react');
    expect(result).toEqual(idle);
  });

  it('Enter in confirming returns done', () => {
    const result = handleTagRenameInput(confirming, '', { return: true }, 'react');
    expect(result).toEqual({ phase: 'done', oldTag: 'react', newTag: 'vue', pendingCount: 3 });
  });

  it('Esc in confirming returns to idle', () => {
    const result = handleTagRenameInput(confirming, '', { escape: true }, 'react');
    expect(result).toEqual(idle);
  });
});
