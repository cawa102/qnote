import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../../theme/colors.js';
import { formatRuler } from '../../theme/format.js';
import { useLayoutContext } from '../hooks/layout-context.js';
import { TitleBanner } from '../components/TitleBanner.js';
import type { InputModeStore } from '../hooks/use-input-mode.js';

export interface PaletteCommand {
  readonly label: string;
  readonly description: string;
  readonly action: string;
}

export const PALETTE_COMMANDS: readonly PaletteCommand[] = [
  { label: 'new note', description: 'ノート作成', action: 'new' },
  { label: 'find file', description: 'ファイル名で検索', action: 'findFile' },
  { label: 'search', description: '本文の全文検索', action: 'search' },
  { label: 'daily', description: 'デイリーノート', action: 'daily' },
  { label: 'recent', description: '最近のノート', action: 'recent' },
  { label: 'capture', description: 'クイックメモ', action: 'capture' },
  { label: 'tags', description: 'タグ一覧', action: 'tags' },
];

interface CommandPaletteProps {
  readonly inputMode: InputModeStore;
  readonly onAction: (action: string) => void;
}

export function CommandPalette({ onAction, inputMode }: CommandPaletteProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { contentWidth, showTitleArt } = useLayoutContext();

  // Palette stays in navigation mode so q-to-quit works globally.
  React.useEffect(() => {
    inputMode.set('navigation');
    return () => inputMode.set('navigation');
  }, [inputMode]);

  useInput((_input, key) => {
    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(i + 1, PALETTE_COMMANDS.length - 1));
    }
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
    if (key.return) {
      const cmd = PALETTE_COMMANDS[selectedIndex];
      if (cmd) {
        onAction(cmd.action);
      }
    }
  });

  return (
    <Box flexDirection="column">
      <TitleBanner contentWidth={contentWidth} showTitleArt={showTitleArt} />
      <Text>{formatRuler(contentWidth)}</Text>
      <Box flexDirection="column" marginTop={1}>
        {PALETTE_COMMANDS.map((cmd, i) => (
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
