// --- Error hierarchy ---

export class AppError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'AppError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NoteNotFoundError extends AppError {
  readonly filePath: string;

  constructor(filePath: string) {
    super(`Note not found: ${filePath}`, 'NOTE_NOT_FOUND');
    this.filePath = filePath;
    this.name = 'NoteNotFoundError';
  }
}

export class SlugCollisionError extends AppError {
  readonly slug: string;
  readonly existingPath: string;

  constructor(slug: string, existingPath: string) {
    super(
      `Slug "${slug}" is already in use: ${existingPath}`,
      'SLUG_COLLISION',
    );
    this.slug = slug;
    this.existingPath = existingPath;
    this.name = 'SlugCollisionError';
  }
}

export class FileWriteError extends AppError {
  readonly filePath: string;

  constructor(filePath: string, reason: string) {
    super(`Failed to write file: ${filePath} (${reason})`, 'FILE_WRITE_ERROR');
    this.filePath = filePath;
    this.name = 'FileWriteError';
  }
}

export class FtsQueryError extends AppError {
  readonly query: string;

  constructor(query: string, reason: string) {
    super(`Invalid search query: "${query}" (${reason})`, 'FTS_QUERY_ERROR');
    this.query = query;
    this.name = 'FtsQueryError';
  }
}

export class FrontmatterParseError extends AppError {
  readonly filePath: string;

  constructor(filePath: string, reason: string) {
    super(
      `Failed to parse frontmatter: ${filePath} (${reason})`,
      'FRONTMATTER_PARSE_ERROR',
    );
    this.filePath = filePath;
    this.name = 'FrontmatterParseError';
  }
}

export class NoteSizeLimitError extends AppError {
  readonly filePath: string;
  readonly actualSize: number;
  readonly maxSize: number;

  constructor(filePath: string, actualSize: number, maxSize: number) {
    super(
      `Note size exceeds limit: ${filePath} (${actualSize} bytes > ${maxSize} bytes)`,
      'NOTE_SIZE_LIMIT',
    );
    this.filePath = filePath;
    this.actualSize = actualSize;
    this.maxSize = maxSize;
    this.name = 'NoteSizeLimitError';
  }
}

// --- Data types ---

export interface NoteMeta {
  readonly title: string;
  readonly tags: readonly string[];
  readonly created: string;
  readonly modified: string;
}

export interface Note {
  readonly meta: NoteMeta;
  readonly content: string;
  readonly filePath: string;
}

export interface NoteListItem {
  readonly title: string;
  readonly tags: readonly string[];
  readonly modified: string;
  readonly filePath: string;
  readonly backlinkCount: number;
}

export interface SearchResult {
  readonly note: NoteListItem;
  readonly snippet: string;
  readonly matchRanges: readonly MatchRange[];
}

export interface MatchRange {
  readonly start: number;
  readonly end: number;
}

export interface WikiLink {
  readonly target: string;
  readonly displayText: string;
  readonly position: number;
}

export interface BackLink {
  readonly sourceTitle: string;
  readonly sourceFilePath: string;
  readonly context: string;
}

// --- Navigation (discriminated union) ---

export type ScreenName = 'palette' | 'noteList' | 'notePreview' | 'findFile' | 'search' | 'capture' | 'editor';

export type ScreenEntry =
  | { readonly screen: 'palette' }
  | { readonly screen: 'noteList'; readonly filter?: string; readonly tag?: string }
  | { readonly screen: 'notePreview'; readonly filePath: string }
  | { readonly screen: 'findFile' }
  | { readonly screen: 'search'; readonly initialQuery?: string }
  | { readonly screen: 'capture' }
  | { readonly screen: 'editor'; readonly filePath?: string; readonly showFileTree?: boolean };

export interface NavigationState {
  readonly stack: readonly ScreenEntry[];
}

// --- Config ---

export interface QnoteConfig {
  readonly notesDir: string;
  readonly daily: {
    readonly directory: string;
    readonly template: string;
  };
  readonly capture: {
    readonly directory: string;
  };
  readonly search: {
    readonly excludeDirs: readonly string[];
  };
}
