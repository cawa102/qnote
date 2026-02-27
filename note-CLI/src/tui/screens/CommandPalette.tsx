import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';
import Fuse from 'fuse.js';
import { theme } from '../../theme/colors.js';
import { formatRuler } from '../../theme/format.js';
import type { NavigationStore } from '../hooks/use-navigation.js';

export interface PaletteCommand {
  readonly label: string;
  readonly description: string;
  readonly action: string;
}

export const PALETTE_COMMANDS: readonly PaletteCommand[] = [
  { label: 'new note', description: 'ノート作成', action: 'new' },
  { label: 'search', description: '全文検索', action: 'search' },
  { label: 'daily', description: 'デイリーノート', action: 'daily' },
  { label: 'recent', description: '最近のノート', action: 'recent' },
  { label: 'capture', description: 'クイックメモ', action: 'capture' },
  { label: 'tags', description: 'タグ一覧', action: 'tags' },
];

const fuse = new Fuse([...PALETTE_COMMANDS], {
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

interface CommandPaletteProps {
  readonly nav: NavigationStore;
  readonly onAction: (action: string, query: string) => void;
}

export function CommandPalette({ onAction }: CommandPaletteProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const filtered = filterCommands(PALETTE_COMMANDS, query);

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
                ? theme.selected(`● ${cmd.label}`)
                : theme.dim(`○ ${cmd.label}`)}
              {'  '}
            </Text>
            <Text dimColor>{cmd.description}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
