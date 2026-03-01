import React from 'react';
import { Box, Text } from 'ink';
import type { ScreenName, HintEntry } from '../../types.js';
import type { FocusArea } from '../editor/types.js';
import { theme } from '../../theme/colors.js';

const HINTS: Readonly<Record<ScreenName, readonly HintEntry[]>> = {
  palette: [
    { key: 'Enter', desc: 'select' },
    { key: 'q', desc: 'quit' },
  ],
  findFile: [
    { key: '↑↓', desc: 'select' },
    { key: 'Enter', desc: 'open' },
    { key: 'Esc', desc: 'cancel' },
  ],
  noteList: [
    { key: ':', desc: 'cmd' },
    { key: '/', desc: 'search' },
    { key: 'n', desc: 'new' },
    { key: 'Esc', desc: 'back' },
    { key: '^Q', desc: 'quit' },
  ],
  notePreview: [
    { key: ':', desc: 'cmd' },
    { key: 'e', desc: 'edit' },
    { key: 'p', desc: 'raw' },
    { key: 'Esc', desc: 'back' },
    { key: '^Q', desc: 'quit' },
  ],
  search: [
    { key: '↑↓', desc: 'select' },
    { key: 'Enter', desc: 'open' },
    { key: 'Esc', desc: 'cancel' },
  ],
  capture: [
    { key: 'Enter', desc: 'next' },
    { key: 'Tab', desc: '$EDITOR' },
    { key: 'Esc', desc: 'cancel' },
  ],
  editor: [
    { key: '^S', desc: 'save' },
    { key: '^P', desc: 'preview' },
    { key: '^E', desc: 'tree' },
    { key: '^ shift →/←', desc: 'tab' },
    { key: '^T', desc: 'title' },
    { key: '^G', desc: 'tags' },
    { key: '^/', desc: 'help' },
    { key: 'Esc', desc: 'back' },
  ],
  tagList: [
    { key: 'Enter', desc: 'notes' },
    { key: '^R', desc: 'rename' },
    { key: 'Esc', desc: 'back' },
  ],
};

const TAG_FILTERED_NOTE_LIST_HINTS: readonly HintEntry[] = [
  { key: 'Enter', desc: 'preview' },
  { key: '^R', desc: 'rename' },
  { key: 'Esc', desc: 'back' },
];

export function getHintsForScreen(screen: ScreenName, focus?: FocusArea, tag?: string): readonly HintEntry[] {
  if (screen === 'noteList' && tag !== undefined) return TAG_FILTERED_NOTE_LIST_HINTS;
  const base = HINTS[screen];
  if (screen !== 'editor' || !focus) return base;

  const inHeader = focus === 'headerTitle' || focus === 'headerTags';
  const inTree = focus === 'fileTree';
  if (!inHeader && !inTree) return base;

  // Swap "Esc: back" → "Esc: editor" when not in editor body
  const swapped = base.map((entry) =>
    entry.key === 'Esc' ? { key: 'Esc', desc: 'editor' } : entry,
  );

  if (focus === 'headerTitle') {
    return [{ key: 'Enter', desc: 'done' }, ...swapped];
  }

  return swapped;
}

export function formatHintEntry(entry: HintEntry): string {
  return theme.keyBadge(' ' + entry.key + ' ') + ' ' + theme.dim(entry.desc);
}

export function formatHints(entries: readonly HintEntry[]): string {
  return entries.map(formatHintEntry).join('  ');
}

interface FooterProps {
  readonly screen: ScreenName;
  readonly focus?: FocusArea;
  readonly tag?: string;
}

export function Footer({ screen, focus, tag }: FooterProps): React.ReactElement {
  const entries = getHintsForScreen(screen, focus, tag);
  return (
    <Box>
      <Text>{formatHints(entries)}</Text>
    </Box>
  );
}
