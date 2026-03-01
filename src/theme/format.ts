import { theme } from './colors.js';

const MONTHS: readonly string[] = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatTag(tag: string): string {
  return theme.tag(`#${tag}`);
}

export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return theme.dim(`${MONTHS[date.getMonth()]} ${date.getDate()}`);
}

export function formatBacklinks(count: number): string {
  if (count === 0) return '';
  return theme.accent(`←${count}`);
}

export function formatIndicator(selected: boolean): string {
  return selected ? theme.selected('●') : theme.dim('○');
}

export function formatRuler(width: number): string {
  return theme.bold('━'.repeat(width));
}

export function formatDottedRuler(width: number): string {
  return theme.dim('╌'.repeat(width));
}

// --- Palette layout helpers ---

export interface PaletteGridLayout {
  readonly columns: number;
  readonly cellWidth: number;
  readonly columnGap: number;
  readonly leftPad: number;
  readonly rowGap: number;
  readonly separatorGap: number;
}

export function computePaletteGridLayout(contentWidth: number): PaletteGridLayout {
  const columns = contentWidth >= 60 ? 3 : contentWidth >= 40 ? 2 : 1;
  const columnGap = columns > 1 ? 2 : 0;
  const availableWidth = contentWidth - columnGap * (columns - 1);
  const cellWidth = columns === 1 ? contentWidth : Math.floor(availableWidth / columns);
  const totalGridWidth = columns * cellWidth + columnGap * (columns - 1);
  const leftPad = Math.floor((contentWidth - totalGridWidth) / 2);
  return { columns, cellWidth, columnGap, leftPad, rowGap: 1, separatorGap: 2 };
}

