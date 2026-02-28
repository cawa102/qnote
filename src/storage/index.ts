export { parseFrontmatter, serializeFrontmatter } from './frontmatter.js';
export type { ParsedNote } from './frontmatter.js';

export { NoteRepository } from './note-repository.js';
export type { CreateNoteInput, UpdateNoteInput } from './note-repository.js';

export { SearchIndex } from './search-index.js';
export type {
  IndexEntry,
  SearchHit,
  TagCount,
  LinkEntry,
  BacklinkHit,
} from './search-index.js';

export { extractWikiLinks } from './link-parser.js';
