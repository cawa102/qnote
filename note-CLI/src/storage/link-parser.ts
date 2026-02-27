import type { WikiLink } from '../types.js';

const WIKILINK_REGEX = /\[\[([^\[\]]+)\]\]/g;
const FENCED_CODE_BLOCK_REGEX = /^```[\s\S]*?^```/gm;
const INLINE_CODE_REGEX = /`[^`]+`/g;

/**
 * Strip code blocks and inline code from content, replacing them with
 * spaces of equal length to preserve character positions.
 */
function maskCodeRegions(content: string): string {
  let masked = content;

  // Mask fenced code blocks (``` ... ```)
  masked = masked.replace(FENCED_CODE_BLOCK_REGEX, (match) => ' '.repeat(match.length));

  // Mask indented code blocks (lines starting with 4+ spaces or a tab,
  // preceded by a blank line)
  const lines = masked.split('\n');
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const prevLine = i > 0 ? lines[i - 1]! : '';
    const isIndentedCode =
      (line.startsWith('    ') || line.startsWith('\t')) && prevLine.trim() === '';
    result.push(isIndentedCode ? ' '.repeat(line.length) : line);
  }
  masked = result.join('\n');

  // Mask inline code (`...`)
  masked = masked.replace(INLINE_CODE_REGEX, (match) => ' '.repeat(match.length));

  return masked;
}

export function extractWikiLinks(content: string): WikiLink[] {
  const masked = maskCodeRegions(content);
  const links: WikiLink[] = [];
  const regex = new RegExp(WIKILINK_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(masked)) !== null) {
    const rawTarget = match[1]!.trim();
    if (rawTarget.length === 0) {
      continue;
    }

    const pipeIndex = rawTarget.indexOf('|');
    const target = pipeIndex >= 0 ? rawTarget.slice(0, pipeIndex).trim() : rawTarget;
    const displayText = pipeIndex >= 0 ? rawTarget.slice(pipeIndex + 1).trim() : rawTarget;

    links.push({
      target,
      displayText,
      position: match.index,
    });
  }

  return links;
}
