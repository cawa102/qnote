import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';
import Fuse from 'fuse.js';
import { theme } from '../../theme/colors.js';
import { formatIndicator } from '../../theme/format.js';
import { useDebounce } from '../hooks/use-debounce.js';
import { useLayoutContext } from '../hooks/layout-context.js';
import { useViewport } from '../hooks/use-viewport.js';
import type { NoteService } from '../../core/note-service.js';
import type { TagCount } from '../../storage/search-index.js';
import type { NavigationStore } from '../hooks/use-navigation.js';
import type { InputModeStore } from '../hooks/use-input-mode.js';

const DEBOUNCE_MS = 150;
const MAX_DISPLAY = 100;
const FUSE_OPTIONS = {
  keys: ['tag'],
  threshold: 0.4,
};

/**
 * Build display entries from tag list, applying fuzzy filter and truncation.
 * Extracted as a pure function for testability.
 */
export function buildTagDisplayEntries(
  allTags: readonly TagCount[],
  query: string,
  fuse?: Fuse<TagCount> | null,
): TagCount[] {
  if (allTags.length === 0) return [];

  if (query.trim() === '') {
    return allTags.slice(0, MAX_DISPLAY) as TagCount[];
  }

  const searcher = fuse ?? new Fuse([...allTags], FUSE_OPTIONS);
  const results = searcher.search(query);
  return results.slice(0, MAX_DISPLAY).map((r) => r.item);
}

// ─── Rename state machine (pure function for testability) ─────

export type TagRenameState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'editing'; readonly oldTag: string; readonly newTag: string }
  | { readonly phase: 'confirming'; readonly oldTag: string; readonly newTag: string; readonly pendingCount: number }
  | { readonly phase: 'done'; readonly oldTag: string; readonly newTag: string; readonly pendingCount: number };

interface TagKeyInfo {
  readonly ctrl?: boolean;
  readonly return?: boolean;
  readonly escape?: boolean;
}

const TAG_RENAME_IDLE: TagRenameState = { phase: 'idle' };

export function handleTagRenameInput(
  state: TagRenameState,
  input: string,
  key: TagKeyInfo,
  selectedTag: string | undefined,
  pendingCount?: number,
): TagRenameState {
  // Ctrl+R: start rename flow
  if (key.ctrl && input === 'r') {
    if (state.phase !== 'idle' || selectedTag === undefined) return state;
    return { phase: 'editing', oldTag: selectedTag, newTag: selectedTag };
  }

  switch (state.phase) {
    case 'editing': {
      if (key.escape) return TAG_RENAME_IDLE;
      if (key.return) {
        return {
          phase: 'confirming',
          oldTag: state.oldTag,
          newTag: state.newTag,
          pendingCount: pendingCount ?? 0,
        };
      }
      return state;
    }
    case 'confirming': {
      if (key.escape) return TAG_RENAME_IDLE;
      if (key.return) {
        return {
          phase: 'done',
          oldTag: state.oldTag,
          newTag: state.newTag,
          pendingCount: state.pendingCount,
        };
      }
      return state;
    }
    default:
      return state;
  }
}

interface TagListScreenProps {
  readonly noteService: NoteService;
  readonly nav: NavigationStore;
  readonly inputMode: InputModeStore;
}

export function TagListScreen({
  noteService,
  nav,
  inputMode,
}: TagListScreenProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [renameState, setRenameState] = useState<TagRenameState>(TAG_RENAME_IDLE);
  const [tagVersion, setTagVersion] = useState(0);
  const { contentWidth, rows } = useLayoutContext();
  const fuseRef = useRef<Fuse<TagCount> | null>(null);

  const allTags = noteService.listTags();

  // Rebuild Fuse index when tags change (after rename)
  useEffect(() => {
    if (allTags.length > 0) {
      fuseRef.current = new Fuse([...allTags], FUSE_OPTIONS);
    } else {
      fuseRef.current = null;
    }
  }, [tagVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build Fuse index once on first render
  if (fuseRef.current === null && allTags.length > 0) {
    fuseRef.current = new Fuse([...allTags], FUSE_OPTIONS);
  }

  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  // Set input mode on mount/unmount
  useEffect(() => {
    inputMode.set('text');
    return () => inputMode.set('navigation');
  }, [inputMode]);

  const displayEntries = buildTagDisplayEntries(
    allTags,
    debouncedQuery,
    fuseRef.current,
  );

  // Header: border box (3) + count line (1) = 4 rows; Footer: 1 row
  const maxVisible = rows - 4 - 1;
  const { scrollOffset, visibleCount } = useViewport(displayEntries.length, selectedIndex, maxVisible);
  const visibleEntries = displayEntries.slice(scrollOffset, scrollOffset + visibleCount);

  const selectedTag = displayEntries[selectedIndex]?.tag;

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    setSelectedIndex(0);
  }, []);

  const handleRenameTagChange = useCallback((value: string) => {
    setRenameState((prev) => {
      if (prev.phase !== 'editing') return prev;
      return { ...prev, newTag: value };
    });
  }, []);

  useInput((input, key) => {
    // When in rename flow, handle rename inputs
    if (renameState.phase !== 'idle') {
      const pendingCount = renameState.phase === 'editing'
        ? noteService.listByTag(renameState.oldTag).length
        : undefined;
      const next = handleTagRenameInput(renameState, input, key, selectedTag, pendingCount);

      if (next.phase === 'done') {
        noteService.renameTag(next.oldTag, next.newTag).then(() => {
          setTagVersion((v) => v + 1);
          setRenameState(TAG_RENAME_IDLE);
        });
        return;
      }

      setRenameState(next);
      return;
    }

    // Ctrl+R to start rename
    if (key.ctrl && input === 'r') {
      const next = handleTagRenameInput(renameState, input, key, selectedTag);
      setRenameState(next);
      return;
    }

    // Normal navigation
    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(i + 1, displayEntries.length - 1));
    }
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
    if (key.return && displayEntries.length > 0) {
      const entry = displayEntries[selectedIndex];
      if (entry) {
        nav.push('noteList', { tag: entry.tag });
      }
    }
  });

  const tagCount = allTags.length === 0
    ? 'No tags found'
    : `${displayEntries.length} tags`;

  return (
    <Box flexDirection="column">
      <Box borderStyle="bold" borderColor="#56b6c2" width={contentWidth} flexShrink={0}>
        <Text> Tags {'>'} </Text>
        <TextInput placeholder="search tags..." onChange={handleChange} />
      </Box>
      <Text dimColor>  {tagCount}</Text>

      <Box flexDirection="column">
        {visibleEntries.map((tagEntry, i) => {
          const isSelected = scrollOffset + i === selectedIndex;
          const isEditing = renameState.phase === 'editing' && isSelected;
          return (
            <Box key={tagEntry.tag}>
              {isEditing ? (
                <Box>
                  <Text>{'  '}{formatIndicator(true)}{' '}</Text>
                  <TextInput
                    defaultValue={renameState.newTag}
                    onChange={handleRenameTagChange}
                  />
                </Box>
              ) : (
                <Text>
                  {'  '}{formatIndicator(isSelected)}{' '}
                  {isSelected
                    ? theme.accentBold(`#${tagEntry.tag}`) + ` (${tagEntry.count})`
                    : `#${tagEntry.tag} (${tagEntry.count})`}
                </Text>
              )}
            </Box>
          );
        })}
      </Box>

      {renameState.phase === 'confirming' && (
        <Box marginTop={1} paddingLeft={2}>
          <Text>
            {renameState.pendingCount} notes will be updated. Continue? (Enter/Esc)
          </Text>
        </Box>
      )}
    </Box>
  );
}
