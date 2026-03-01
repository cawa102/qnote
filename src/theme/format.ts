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
  return theme.dim('─'.repeat(width));
}

// --- Palette layout helpers ---

export interface PaletteLayout {
  readonly menuWidth: number;
  readonly leftPad: number;
  readonly showKeys: boolean;
  readonly rowGap: number;
}

export function computePaletteLayout(contentWidth: number): PaletteLayout {
  const menuWidth = Math.max(30, Math.min(contentWidth - 8, 48));
  const leftPad = Math.max(0, Math.floor((contentWidth - menuWidth) / 2));
  const showKeys = contentWidth >= 50;
  return { menuWidth, leftPad, showKeys, rowGap: 1 };
}

