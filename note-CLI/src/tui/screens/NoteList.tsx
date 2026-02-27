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
import type { NoteListItem } from '../../types.js';

export function clampIndex(current: number, delta: number, length: number): number {
  if (length === 0) return 0;
  return Math.max(0, Math.min(current + delta, length - 1));
}

interface NoteListProps {
  readonly title: string;
  readonly items: readonly NoteListItem[];
  readonly nav: NavigationStore;
}

export function NoteList({ title, items, nav }: NoteListProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
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
