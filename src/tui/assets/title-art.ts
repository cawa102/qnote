import stringWidth from 'string-width';
import { theme } from '../../theme/colors.js';

/**
 * "QUEEN" rendered in filled half-block characters.
 * Each row is padded to consistent display width.
 * Uses only block characters: █ ▀ ▄ ▌ ▐ and spaces.
 */
const RAW_ART: readonly string[] = [
  '▄▄▄▄  █  █ █▀▀▀ █▀▀▀ █▄  █',
  '█  █  █  █ █    █    █ █ █',
  '█  █  █  █ █▀▀  █▀▀  █  ██',
  '█ ▄█  █  █ █    █    █  ▀█',
  '▀▄▄█  ▀▄▄▀ ▀▀▀▀ ▀▀▀▀ ▀   ▀',
] as const;

// Pad all rows to the width of the widest row
const maxRawWidth = Math.max(...RAW_ART.map((line) => stringWidth(line)));

const padLine = (line: string): string => {
  const w = stringWidth(line);
  const diff = maxRawWidth - w;
  return diff > 0 ? line + ' '.repeat(diff) : line;
};

export const TITLE_ART: readonly string[] = RAW_ART.map(padLine);

export const TITLE_SUBTITLE = 'N O T E';

export const TITLE_WIDTH: number = maxRawWidth;

export const colorizeTitle = (
  lines: readonly string[],
  subtitle: string,
): string => {
  if (lines.length === 0) {
    return theme.accent(subtitle);
  }
  const coloredLines = lines.map((line) => theme.accent(line));
  const coloredSubtitle = theme.accent(subtitle);
  return [...coloredLines, '', coloredSubtitle].join('\n');
};
