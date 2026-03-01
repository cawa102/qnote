import stringWidth from 'string-width';
import chalk from 'chalk';
import { theme } from '../../theme/colors.js';

/**
 * "QUEEN NOTE" rendered in ANSI Shadow block art,
 * surrounded by a star field with scattered ♛ crown accents.
 * Block art uses a Teal → Green gradient (variant D).
 */

// --- Star field configuration ---
// ♛ is scattered naturally among ✦ ✧ · as a subtle royal accent
type StarDef = readonly [number, string];

const STARS_TOP: readonly (readonly StarDef[])[] = [
  [[2, '✧'], [14, '·'], [27, '♛'], [41, '✦'], [55, '·'], [68, '✧'], [80, '✦']],
  [[7, '✦'], [20, '✧'], [34, '·'], [47, '✧'], [59, '♛'], [72, '✦']],
  [[4, '·'], [17, '✦'], [31, '✧'], [44, '♛'], [56, '✦'], [70, '·'], [83, '✧']],
];

const STARS_BOTTOM: readonly (readonly StarDef[])[] = [
  [[5, '✧'], [18, '♛'], [30, '✦'], [43, '·'], [57, '✧'], [69, '✦'], [81, '·']],
  [[10, '·'], [24, '✦'], [37, '✧'], [51, '♛'], [63, '·'], [76, '✧']],
];

// --- Block art (ANSI Shadow font) ---
const BLOCK_ART: readonly string[] = [
  ' ██████╗ ██╗   ██╗███████╗███████╗███╗   ██╗     ███╗   ██╗ ██████╗ ████████╗███████╗',
  '██╔═══██╗██║   ██║██╔════╝██╔════╝████╗  ██║     ████╗  ██║██╔═══██╗╚══██╔══╝██╔════╝',
  '██║   ██║██║   ██║█████╗  █████╗  ██╔██╗ ██║     ██╔██╗ ██║██║   ██║   ██║   █████╗  ',
  '██║▄▄ ██║██║   ██║██╔══╝  ██╔══╝  ██║╚██╗██║     ██║╚██╗██║██║   ██║   ██║   ██╔══╝  ',
  '╚██████╔╝╚██████╔╝███████╗███████╗██║ ╚████║     ██║ ╚████║╚██████╔╝   ██║   ███████╗',
  ' ╚══▀▀═╝  ╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═══╝     ╚═╝  ╚═══╝ ╚═════╝    ╚═╝   ╚══════╝',
] as const;

/** Number of star lines above / below the block art. */
export const STAR_TOP_COUNT = STARS_TOP.length;   // 3
export const STAR_BOTTOM_COUNT = STARS_BOTTOM.length; // 2

// --- Build combined art ---
function buildStarLine(stars: readonly StarDef[], width: number): string {
  const chars = Array.from<string>({ length: width }).fill(' ');
  for (const [pos, ch] of stars) {
    if (pos < width) chars[pos] = ch;
  }
  return chars.join('');
}

const maxBlockWidth = Math.max(...BLOCK_ART.map((l) => stringWidth(l)));

const RAW_ART: readonly string[] = [
  ...STARS_TOP.map((s) => buildStarLine(s, maxBlockWidth)),
  ...BLOCK_ART,
  ...STARS_BOTTOM.map((s) => buildStarLine(s, maxBlockWidth)),
];

// Pad all rows to the width of the widest row
const maxRawWidth = Math.max(...RAW_ART.map((l) => stringWidth(l)));

const padLine = (line: string): string => {
  const w = stringWidth(line);
  const diff = maxRawWidth - w;
  return diff > 0 ? line + ' '.repeat(diff) : line;
};

export const TITLE_ART: readonly string[] = RAW_ART.map(padLine);

export const TITLE_WIDTH: number = maxRawWidth;

// --- Colorization ---

const supportsHex = chalk.level >= 3;

function lerpHex(a: string, b: string, t: number): string {
  const p = (h: string, o: number) => parseInt(h.slice(o, o + 2), 16);
  const r = Math.round(p(a, 1) + (p(b, 1) - p(a, 1)) * t);
  const g = Math.round(p(a, 3) + (p(b, 3) - p(a, 3)) * t);
  const bl = Math.round(p(a, 5) + (p(b, 5) - p(a, 5)) * t);
  const h = (v: number) => v.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(bl)}`;
}

// Gradient D: Teal (#56b6c2) → Green (#98c379)
const GRADIENT_FROM = '#56b6c2';
const GRADIENT_TO = '#98c379';

const artGradient: readonly string[] = Array.from(
  { length: BLOCK_ART.length },
  (_, i) => lerpHex(GRADIENT_FROM, GRADIENT_TO, i / (BLOCK_ART.length - 1)),
);

// Star character colors
const STAR_STYLE: Readonly<Record<string, (s: string) => string>> = {
  '✦': supportsHex ? chalk.hex('#c678dd') : chalk.magenta,
  '✧': supportsHex ? chalk.hex('#56b6c2') : chalk.cyan,
  '♛': supportsHex ? chalk.hex('#e5c07b') : chalk.yellow,
  '·': chalk.dim,
};

function colorizeStarLine(line: string): string {
  return [...line]
    .map((ch) => {
      const fn = STAR_STYLE[ch];
      return fn ? fn(ch) : ch;
    })
    .join('');
}

export const colorizeTitle = (
  lines: readonly string[],
): string => {
  if (lines.length === 0) {
    return theme.accent('Queen Note');
  }

  const topCount = STARS_TOP.length;
  const artCount = BLOCK_ART.length;

  return lines
    .map((line, idx) => {
      // Top star field
      if (idx < topCount) {
        return colorizeStarLine(line);
      }
      // Block art with gradient
      if (idx < topCount + artCount) {
        const artIdx = idx - topCount;
        return supportsHex
          ? chalk.hex(artGradient[artIdx])(line)
          : chalk.cyan(line);
      }
      // Bottom star field
      return colorizeStarLine(line);
    })
    .join('\n');
};
