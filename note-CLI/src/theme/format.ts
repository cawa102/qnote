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
