import React from 'react';
import { Box, Text } from 'ink';
import type { ScreenName } from '../../types.js';

const HINTS: Readonly<Record<ScreenName, string>> = {
  palette: 'Enter select   q quit',
  findFile: '↑↓ select   Enter open   Esc cancel',
  noteList: ': cmd   / search   n new   q quit',
  notePreview: 'e edit   p raw   : cmd   Esc back',
  search: '↑↓ select   Enter open   Esc cancel',
  capture: 'Ctrl+S save   Esc cancel',
  editor: '^S save  ^P preview  ^E tree  ^T title  ^G tags  Esc back',
};

export function getHintsForScreen(screen: ScreenName): string {
  return HINTS[screen];
}

interface FooterProps {
  readonly screen: ScreenName;
}

export function Footer({ screen }: FooterProps): React.ReactElement {
  const hints = getHintsForScreen(screen);
  return (
    <Box>
      <Text dimColor>{hints}</Text>
    </Box>
  );
}
