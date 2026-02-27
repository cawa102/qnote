import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

export interface NumberedWikiLink {
  readonly target: string;
  readonly displayText: string;
  readonly position: number;
  readonly number: number | null;
}

interface NumberedContent {
  readonly rendered: string;
  readonly links: readonly NumberedWikiLink[];
}

const MAX_NUMBERED_LINKS = 9;

export function numberWikiLinks(content: string): NumberedContent {
  const links: NumberedWikiLink[] = [];
  let counter = 0;

  const rendered = content.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (match, target: string, display: string | undefined, offset: number) => {
      counter++;
      const linkNumber = counter <= MAX_NUMBERED_LINKS ? counter : null;

      links.push({
        target,
        displayText: display ?? target,
        position: offset,
        number: linkNumber,
      });

      const suffix = linkNumber !== null ? `[${linkNumber}]` : '';
      if (display) {
        return `[[${target}|${display}]]${suffix}`;
      }
      return `[[${target}]]${suffix}`;
    },
  );

  return { rendered, links };
}

export function renderMarkdown(raw: string): string {
  try {
    if (raw === null || raw === undefined) {
      throw new Error('null content');
    }

    const { rendered: numbered } = numberWikiLinks(raw);

    // Use TerminalRenderer constructor (marked-terminal exports a class)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    marked.setOptions({ renderer: new TerminalRenderer() as any });
    const result = marked.parse(numbered);
    return typeof result === 'string' ? result : String(result);
  } catch {
    const fallbackContent = typeof raw === 'string' ? raw : '';
    return `[rendering failed]\n\n${fallbackContent}`;
  }
}
