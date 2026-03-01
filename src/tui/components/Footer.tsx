import React from 'react';
import { Box, Text } from 'ink';
import type { ScreenName, HintEntry } from '../../types.js';
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
    { key: '^S', desc: 'save' },
    { key: 'Esc', desc: 'cancel' },
  ],
  editor: [
    { key: '^S', desc: 'save' },
    { key: '^P', desc: 'preview' },
    { key: '^E', desc: 'tree' },
    { key: '^→/←', desc: 'tab' },
    { key: '^T', desc: 'title' },
    { key: '^G', desc: 'tags' },
    { key: 'Esc', desc: 'back' },
  ],
};

export function getHintsForScreen(screen: ScreenName): readonly HintEntry[] {
  return HINTS[screen];
}

export function formatHintEntry(entry: HintEntry): string {
  return theme.keyBadge(' ' + entry.key + ' ') + ' ' + theme.dim(entry.desc);
}

export function formatHints(entries: readonly HintEntry[]): string {
  return entries.map(formatHintEntry).join('  ');
}

interface FooterProps {
  readonly screen: ScreenName;
}

export function Footer({ screen }: FooterProps): React.ReactElement {
  const entries = getHintsForScreen(screen);
  return (
    <Box>
      <Text>{formatHints(entries)}</Text>
    </Box>
  );
}
