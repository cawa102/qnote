import type { Theme } from '../../theme/colors.js';

// --- Regex patterns for Markdown syntax ---

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const HORIZONTAL_RULE_RE = /^([-*_]{3,})\s*$/;
const BLOCKQUOTE_RE = /^(>{1,})\s?/;
const LIST_ITEM_RE = /^(\s*)([-*])\s(.*)/;

// Inline patterns — order matters (code > bold > italic > wikilink)
const INLINE_CODE_RE = /`([^`]+)`/g;
const BOLD_RE = /\*\*([^*]+)\*\*/g;
const ITALIC_RE = /\*([^*]+)\*/g;
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

/**
 * Apply inline formatting (bold, italic, code, wikilinks) to text content.
 * Processes in priority order: code > bold > italic > wikilink.
 * Uses placeholder-based approach to avoid re-processing already-styled segments.
 */
function applyInlineFormatting(text: string, theme: Theme): string {
  // Use placeholders to prevent re-processing styled segments
  const placeholders: string[] = [];
  const placeholder = (value: string): string => {
    const index = placeholders.length;
    placeholders.push(value);
    return `\x00${index}\x00`;
  };

  // 1. Inline code (highest priority — content inside backticks is not parsed further)
  let result = text.replace(INLINE_CODE_RE, (_match, code: string) =>
    placeholder(`${theme.dim('`')}${theme.accentBold(code)}${theme.dim('`')}`),
  );

  // 2. Bold
  result = result.replace(BOLD_RE, (_match, content: string) =>
    placeholder(`${theme.dim('**')}${theme.bold(content)}${theme.dim('**')}`),
  );

  // 3. Italic
  result = result.replace(ITALIC_RE, (_match, content: string) =>
    placeholder(`${theme.dim('*')}${theme.accent(content)}${theme.dim('*')}`),
  );

  // 4. Wikilinks
  result = result.replace(WIKILINK_RE, (_match, target: string) =>
    placeholder(`${theme.dim('[[')}${theme.link(target)}${theme.dim(']]')}`),
  );

  // Restore placeholders
  return result.replace(/\x00(\d+)\x00/g, (_match, index: string) => placeholders[Number(index)]);
}

/**
 * Apply chalk styles to a single Markdown line.
 * Each line is processed independently — no cross-line state.
 */
export function highlightLine(line: string, theme: Theme): string {
  if (line === '') {
    return '';
  }

  // Horizontal rule (must check before list items since --- could match)
  const hrMatch = HORIZONTAL_RULE_RE.exec(line);
  if (hrMatch) {
    return theme.dim(line);
  }

  // Headings
  const headingMatch = HEADING_RE.exec(line);
  if (headingMatch) {
    const [, hashes, content] = headingMatch;
    return theme.heading(`${theme.dim(`${hashes} `)}${content}`);
  }

  // Blockquotes — dim the entire line
  const blockquoteMatch = BLOCKQUOTE_RE.exec(line);
  if (blockquoteMatch) {
    return theme.dim(line);
  }

  // List items — accent the bullet, apply inline formatting to content
  const listMatch = LIST_ITEM_RE.exec(line);
  if (listMatch) {
    const [, indent, bullet, content] = listMatch;
    return `${indent}${theme.accent(`${bullet} `)}${applyInlineFormatting(content, theme)}`;
  }

  // Default: apply inline formatting only
  return applyInlineFormatting(line, theme);
}

/**
 * Apply chalk styles to multiple lines. Batch operation.
 */
export function highlightLines(lines: readonly string[], theme: Theme): string[] {
  return lines.map((line) => highlightLine(line, theme));
}
