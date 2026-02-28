import matter from 'gray-matter';
import yaml from 'js-yaml';
import type { NoteMeta } from '../types.js';

// Use JSON_SCHEMA to prevent js-yaml from auto-parsing date strings into Date objects.
// This preserves the original string format (e.g. timezone offsets).
const GRAY_MATTER_OPTIONS = {
  engines: {
    yaml: {
      parse: (s: string) => yaml.load(s, { schema: yaml.JSON_SCHEMA }) as object,
      stringify: (obj: object) => yaml.dump(obj, { schema: yaml.JSON_SCHEMA }),
    },
  },
} as const;

export interface ParsedNote {
  readonly meta: NoteMeta;
  readonly content: string;
}

const FIRST_HEADING_REGEX = /^#\s+(.+)$/m;

function coerceToString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value !== null && value !== undefined) {
    return String(value);
  }
  return '';
}

function coerceToTags(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === 'string' && value.length > 0) {
    return [value];
  }
  return [];
}

function extractTitleFromContent(content: string): string {
  const match = FIRST_HEADING_REGEX.exec(content);
  return match ? match[1]!.trim() : '';
}

export function parseFrontmatter(raw: string): ParsedNote {
  let data: Record<string, unknown> = {};
  let content: string;

  try {
    const result = matter(raw, GRAY_MATTER_OPTIONS);
    data = result.data as Record<string, unknown>;
    content = result.content;
  } catch {
    // Malformed YAML — graceful degradation: treat entire input as content
    // Attempt to strip the frontmatter delimiters even if YAML is broken
    const stripped = raw.replace(/^---[\s\S]*?---\n?/, '');
    content = stripped || raw;
  }

  const hasFrontmatter = Object.keys(data).length > 0;
  const titleFromFrontmatter = coerceToString(data.title);
  const title = titleFromFrontmatter || (hasFrontmatter ? '' : extractTitleFromContent(content));

  const meta: NoteMeta = {
    title,
    tags: coerceToTags(data.tags),
    created: coerceToString(data.created),
    modified: coerceToString(data.modified),
  };

  return { meta, content: content.trim() };
}

export function serializeFrontmatter(
  meta: NoteMeta,
  content: string,
): string {
  const frontmatter = matter.stringify(content, {
    title: meta.title,
    tags: [...meta.tags],
    created: meta.created,
    modified: meta.modified,
  });

  return frontmatter;
}
