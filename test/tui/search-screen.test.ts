import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from 'ink-testing-library';
import { Box } from 'ink';
import { buildSearchHint, SearchScreen } from '../../src/tui/screens/SearchScreen.js';
import { createNavigationStore } from '../../src/tui/hooks/use-navigation.js';
import { createInputModeStore } from '../../src/tui/hooks/use-input-mode.js';
import { LayoutProvider } from '../../src/tui/hooks/layout-context.js';
import { stripAnsi } from '../helpers/strip-ansi.js';
import type { NoteService } from '../../src/core/note-service.js';
import type { SearchIndex } from '../../src/storage/search-index.js';

function createMockNoteService(): NoteService {
  return {
    search: () => [],
  } as unknown as NoteService;
}

function createMockSearchIndex(): SearchIndex {
  return {
    shouldSearch: () => false,
  } as unknown as SearchIndex;
}

function renderSearchScreen(width = 80) {
  const nav = createNavigationStore();
  const inputMode = createInputModeStore();
  const noteService = createMockNoteService();
  const searchIndex = createMockSearchIndex();

  const instance = render(
    React.createElement(
      LayoutProvider,
      null,
      React.createElement(
        Box,
        { flexDirection: 'column' as const, width, height: 24 },
        React.createElement(SearchScreen, { noteService, searchIndex, nav, inputMode }),
      ),
    ),
  );

  return { ...instance, nav, inputMode };
}

afterEach(() => {
  cleanup();
});

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

  it('returns results count with undefined count defaulting to 0', () => {
    const hint = buildSearchHint('abc', true);
    expect(hint).toBe('0 results');
  });
});

describe('SearchScreen rendering', () => {
  it('renders search input with bold border box', () => {
    const { lastFrame } = renderSearchScreen();
    const frame = stripAnsi(lastFrame() ?? '');
    // Bold border box has corner characters ┏ and ┗ (not from ruler)
    expect(frame).toContain('┏');
    expect(frame).toContain('┗');
  });

  it('renders label text inside the bordered area', () => {
    const { lastFrame } = renderSearchScreen();
    const frame = lastFrame() ?? '';
    expect(frame).toContain('検索');
  });
});
