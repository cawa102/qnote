import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { formatRuler, computePaletteLayout, formatIndicator } from '../../theme/format.js';
import { theme } from '../../theme/colors.js';
import { useLayoutContext } from '../hooks/layout-context.js';
import { TitleBanner } from '../components/TitleBanner.js';
import type { InputModeStore } from '../hooks/use-input-mode.js';

export interface PaletteCommand {
  readonly label: string;
  readonly key: string;
  readonly action: string;
}

export const PALETTE_COMMANDS: readonly PaletteCommand[] = [
  { label: 'New Note',  key: 'n', action: 'new' },
  { label: 'Quick Note',   key: 'c', action: 'capture' },
  { label: 'Daily Note',     key: 'd', action: 'daily' },
  { label: 'Find File', key: 'f', action: 'findFile' },
  { label: 'Search',    key: 's', action: 'search' },
  { label: 'Recent',    key: 'r', action: 'recent' },
  { label: 'Tags',      key: 't', action: 'tags' },
];

interface CommandPaletteProps {
  readonly inputMode: InputModeStore;
  readonly onAction: (action: string) => void;
}

export function CommandPalette({ onAction, inputMode }: CommandPaletteProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { contentWidth, showTitleArt } = useLayoutContext();
  const layout = useMemo(
    () => computePaletteLayout(contentWidth),
    [contentWidth],
  );

  // Palette stays in navigation mode so q-to-quit works globally.
  React.useEffect(() => {
    inputMode.set('navigation');
    return () => inputMode.set('navigation');
  }, [inputMode]);

  useInput((input, key) => {
    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(i + 1, PALETTE_COMMANDS.length - 1));
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (key.return) {
      const cmd = PALETTE_COMMANDS[selectedIndex];
      if (cmd) {
        onAction(cmd.action);
      }
      return;
    }

    // Shortcut key handling
    const matched = PALETTE_COMMANDS.find((cmd) => cmd.key === input);
    if (matched && !key.ctrl && !key.meta) {
      onAction(matched.action);
    }
  });

  return (
    <Box flexDirection="column">
      <TitleBanner contentWidth={contentWidth} showTitleArt={showTitleArt} />
      <Text>{'      ' + formatRuler(contentWidth - 12)}</Text>
      <Box flexDirection="column" marginTop={layout.separatorGap} paddingLeft={layout.leftPad} gap={layout.rowGap}>
        {PALETTE_COMMANDS.map((cmd, i) => {
          const isSelected = i === selectedIndex;
          return (
            <Box key={cmd.action} width={layout.menuWidth}>
              <Text>{formatIndicator(isSelected) + '  '}</Text>
              <Text bold>{isSelected ? theme.selected(cmd.label) : cmd.label}</Text>
              <Box flexGrow={1} />
              {layout.showKeys && (
                <Text bold>{theme.accent(cmd.key)}</Text>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
