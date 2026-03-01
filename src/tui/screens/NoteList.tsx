import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';
import { theme } from '../../theme/colors.js';
import {
  formatTag,
  formatDate,
  formatBacklinks,
  formatIndicator,
  formatRuler,
} from '../../theme/format.js';
import { useLayoutContext } from '../hooks/layout-context.js';
import type { NavigationStore } from '../hooks/use-navigation.js';
import type { NoteListItem } from '../../types.js';

export function clampIndex(current: number, delta: number, length: number): number {
  if (length === 0) return 0;
  return Math.max(0, Math.min(current + delta, length - 1));
}

// ─── Rename state machine (pure function for testability) ─────

export type RenameState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'scopeSelect'; readonly scopeIndex: number }
  | { readonly phase: 'editing'; readonly scope: 'all' | 'single'; readonly newTag: string }
  | { readonly phase: 'confirming'; readonly scope: 'all' | 'single'; readonly newTag: string }
  | { readonly phase: 'done'; readonly scope: 'all' | 'single'; readonly newTag: string };

interface KeyInfo {
  readonly ctrl?: boolean;
  readonly return?: boolean;
  readonly escape?: boolean;
  readonly upArrow?: boolean;
  readonly downArrow?: boolean;
}

const IDLE: RenameState = { phase: 'idle' };

export function handleRenameInput(
  state: RenameState,
  input: string,
  key: KeyInfo,
  tag: string | undefined,
): RenameState {
  // Ctrl+R: start rename flow
  if (key.ctrl && input === 'r') {
    if (state.phase !== 'idle' || tag === undefined) return state;
    return { phase: 'scopeSelect', scopeIndex: 0 };
  }

  switch (state.phase) {
    case 'scopeSelect': {
      if (key.escape) return IDLE;
      if (key.downArrow) return { phase: 'scopeSelect', scopeIndex: Math.min(state.scopeIndex + 1, 1) };
      if (key.upArrow) return { phase: 'scopeSelect', scopeIndex: Math.max(state.scopeIndex - 1, 0) };
      if (key.return) {
        const scope = state.scopeIndex === 0 ? 'all' : 'single';
        return { phase: 'editing', scope, newTag: tag ?? '' };
      }
      return state;
    }
    case 'editing': {
      if (key.escape) return IDLE;
      if (key.return) return { phase: 'confirming', scope: state.scope, newTag: state.newTag };
      return state;
    }
    case 'confirming': {
      if (key.escape) return IDLE;
      if (key.return) return { phase: 'done', scope: state.scope, newTag: state.newTag };
      return state;
    }
    default:
      return state;
  }
}

// ─── Scope selection options ──────────────────────────────────

const SCOPE_OPTIONS = ['全ノートに適用', 'このノートのみ'] as const;

// ─── Component ────────────────────────────────────────────────

interface NoteListProps {
  readonly title: string;
  readonly items: readonly NoteListItem[];
  readonly nav: NavigationStore;
  readonly tag?: string;
  readonly onRenameTag?: (scope: 'all' | 'single', filePath: string, newTag: string) => void;
}

export function NoteList({ title, items, nav, tag, onRenameTag }: NoteListProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [renameState, setRenameState] = useState<RenameState>(IDLE);
  const { contentWidth } = useLayoutContext();

  const handleTagChange = useCallback((value: string) => {
    setRenameState((prev) => {
      if (prev.phase !== 'editing') return prev;
      return { ...prev, newTag: value };
    });
  }, []);

  useInput((input, key) => {
    // When in rename flow, handle rename inputs
    if (renameState.phase !== 'idle') {
      const next = handleRenameInput(renameState, input, key, tag);
      if (next.phase === 'done' && onRenameTag) {
        const item = items[selectedIndex];
        if (item) {
          onRenameTag(next.scope, item.filePath, next.newTag);
        }
        setRenameState(IDLE);
        return;
      }
      setRenameState(next);
      return;
    }

    // Ctrl+R to start rename
    if (key.ctrl && input === 'r') {
      const next = handleRenameInput(renameState, input, key, tag);
      setRenameState(next);
      return;
    }

    // Normal navigation
    if (input === 'j' || key.downArrow) {
      setSelectedIndex((i) => clampIndex(i, 1, items.length));
      return;
    }
    if (input === 'k' || key.upArrow) {
      setSelectedIndex((i) => clampIndex(i, -1, items.length));
      return;
    }
    if (key.return && items.length > 0) {
      const item = items[selectedIndex];
      if (item) {
        nav.push('notePreview', { filePath: item.filePath });
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Text>{theme.bold(title)} {formatRuler(Math.max(0, contentWidth - title.length - 1))}</Text>
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

      {/* Rename UI overlays */}
      {renameState.phase === 'scopeSelect' && (
        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
          <Text>{theme.bold('タグ名変更の範囲:')}</Text>
          {SCOPE_OPTIONS.map((label, i) => {
            const isSelected = i === (renameState as { scopeIndex: number }).scopeIndex;
            return (
              <Text key={label}>
                {'  '}{formatIndicator(isSelected)} {isSelected ? theme.accentBold(label) : label}
              </Text>
            );
          })}
        </Box>
      )}

      {renameState.phase === 'editing' && (
        <Box marginTop={1} paddingLeft={2}>
          <Text>新しいタグ名: </Text>
          <TextInput
            defaultValue={renameState.newTag}
            onChange={handleTagChange}
          />
        </Box>
      )}

      {renameState.phase === 'confirming' && (
        <Box marginTop={1} paddingLeft={2}>
          <Text>
            タグを「{renameState.newTag}」に変更します。続行？ (Enter/Esc)
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>  {items.length} notes</Text>
      </Box>
    </Box>
  );
}
