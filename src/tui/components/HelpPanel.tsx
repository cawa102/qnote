import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme/colors.js';

interface HelpPanelProps {
  readonly width: number;
}

/** Height consumed by the help panel (title + 10 content rows + separator). */
export const HELP_PANEL_HEIGHT = 12;

/**
 * Render a two-column item row.
 * Plain-text padding is applied BEFORE ANSI color wrapping so that
 * `.padEnd()` counts only visible characters.
 */
function itemRow(
  leftKey: string, leftDesc: string,
  rightKey: string, rightDesc: string,
  half: number,
): string {
  const left = `   ${leftKey.padEnd(12)}${leftDesc}`;
  const right = rightKey ? `   ${rightKey.padEnd(16)}${rightDesc}` : '';
  return theme.dim(left.padEnd(half) + right);
}

/** Render a two-column section header (accent-colored). */
function sectionHeader(left: string, right: string, half: number): string {
  const pad = ' '.repeat(Math.max(0, half - 2 - left.length));
  return '  ' + theme.accentBold(left) + pad + (right ? theme.accentBold(right) : '');
}

export function HelpPanel({ width }: HelpPanelProps): React.ReactElement {
  const half = Math.floor(width / 2);
  const separator = theme.dim('\u2500'.repeat(width));

  const title = ' Keybindings (^/ to close) ';
  const titleLine = theme.dim('\u2500\u2500') +
    theme.accent(title) +
    theme.dim('\u2500'.repeat(Math.max(0, width - title.length - 2)));

  const lines = [
    titleLine,
    sectionHeader('Navigation', 'Selection', half),
    itemRow('\u2190\u2191\u2193\u2192', 'move', 'Shift+Arrow', 'select', half),
    itemRow('Opt+\u2190/\u2192', 'word', 'Opt+Shift+\u2190/\u2192', 'word sel', half),
    itemRow('Home/End', 'line start/end', 'Opt+A', 'select all', half),
    itemRow('Opt+\u2191/\u2193', 'doc start/end', '', '', half),
    sectionHeader('Editing', 'Clipboard & Format', half),
    itemRow('\u232b', 'delete back', 'Opt+C/X/V', 'copy/cut/paste', half),
    itemRow('Ctrl+D', 'delete fwd', 'Ctrl+Z/Y', 'undo/redo', half),
    itemRow('Tab', 'indent', 'Opt+B/I', 'bold/italic', half),
    itemRow('Shift+Tab', 'unindent', 'Ctrl+K', 'link', half),
    separator,
  ];

  return (
    <Box flexDirection="column">
      <Text>{lines.join('\n')}</Text>
    </Box>
  );
}
