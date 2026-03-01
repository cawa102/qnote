import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { formatRuler, computePaletteGridLayout } from '../../theme/format.js';
import { theme } from '../../theme/colors.js';
import { useLayoutContext } from '../hooks/layout-context.js';
import { TitleBanner } from '../components/TitleBanner.js';
import type { InputModeStore } from '../hooks/use-input-mode.js';

export interface PaletteCommand {
  readonly label: string;
  readonly key: string;
  readonly action: string;
  readonly icon: string;
}

export const PALETTE_COMMANDS: readonly PaletteCommand[] = [
  { label: 'New Note',   key: 'n', action: 'new',      icon: '\uF15B' },  // nf-fa-file
  { label: 'Quick Note', key: 'c', action: 'capture',  icon: '\uF0E7' },  // nf-fa-bolt
  { label: 'Daily Note', key: 'd', action: 'daily',    icon: '\uF073' },  // nf-fa-calendar
  { label: 'Find File',  key: 'f', action: 'findFile', icon: '\uF002' },  // nf-fa-search
  { label: 'Search',     key: 's', action: 'search',   icon: '\uF15C' },  // nf-fa-file_text
  { label: 'Tags',       key: 't', action: 'tags',     icon: '\uF02C' },  // nf-fa-tags
];

interface CommandPaletteProps {
  readonly inputMode: InputModeStore;
  readonly onAction: (action: string) => void;
}

export function CommandPalette({ onAction, inputMode }: CommandPaletteProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { contentWidth, showTitleArt } = useLayoutContext();
  const layout = useMemo(
    () => computePaletteGridLayout(contentWidth),
    [contentWidth],
  );

  const { columns } = layout;
  const maxRow = useMemo(
    () => Math.ceil(PALETTE_COMMANDS.length / columns) - 1,
    [columns],
  );

  // Palette stays in navigation mode so q-to-quit works globally.
  React.useEffect(() => {
    inputMode.set('navigation');
    return () => inputMode.set('navigation');
  }, [inputMode]);

  useInput((input, key) => {
    if (key.rightArrow) {
      setSelectedIndex((i) => {
        const col = i % columns;
        if (col < columns - 1) {
          const next = i + 1;
          return Math.min(next, PALETTE_COMMANDS.length - 1);
        }
        return i;
      });
      return;
    }
    if (key.leftArrow) {
      setSelectedIndex((i) => {
        const col = i % columns;
        return col > 0 ? i - 1 : i;
      });
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((i) => {
        const row = Math.floor(i / columns);
        if (row < maxRow) {
          const next = i + columns;
          return Math.min(next, PALETTE_COMMANDS.length - 1);
        }
        return i;
      });
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((i) => {
        const row = Math.floor(i / columns);
        return row > 0 ? i - columns : i;
      });
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

  // Chunk commands into rows
  const rows = useMemo(() => {
    const result: PaletteCommand[][] = [];
    for (let i = 0; i < PALETTE_COMMANDS.length; i += columns) {
      result.push(PALETTE_COMMANDS.slice(i, i + columns));
    }
    return result;
  }, [columns]);

  return (
    <Box flexDirection="column">
      <TitleBanner contentWidth={contentWidth} showTitleArt={showTitleArt} />
      <Text>{'      ' + formatRuler(contentWidth - 12)}</Text>
      <Box flexDirection="column" marginTop={layout.separatorGap} paddingLeft={layout.leftPad} gap={layout.rowGap}>
        {rows.map((row, rowIdx) => (
          <Box key={rowIdx} flexDirection="row" gap={layout.columnGap}>
            {row.map((cmd, colIdx) => {
              const flatIndex = rowIdx * columns + colIdx;
              const isSelected = flatIndex === selectedIndex;
              const labelText = `${cmd.label} (${cmd.key})`;
              return (
                <Box
                  key={cmd.action}
                  width={layout.cellWidth}
                  flexDirection="column"
                  alignItems="center"
                  borderStyle="bold"
                  borderColor={isSelected ? '#56b6c2' : undefined}
                  paddingX={1}
                >
                  <Text>{cmd.icon}</Text>
                  <Text bold>{isSelected ? theme.accent(labelText) : labelText}</Text>
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
