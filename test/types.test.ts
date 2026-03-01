import { describe, it, expect } from 'vitest';

describe('types', () => {
  it('ScreenEntry discriminated union has correct shape for palette', async () => {
    const palette: import('../src/types.js').ScreenEntry = { screen: 'palette' };
    expect(palette.screen).toBe('palette');
  });

  it('ScreenEntry discriminated union has correct shape for noteList', async () => {
    const entry: import('../src/types.js').ScreenEntry = {
      screen: 'noteList',
      filter: 'api',
      tag: 'design',
    };
    expect(entry.screen).toBe('noteList');
    if (entry.screen === 'noteList') {
      expect(entry.filter).toBe('api');
      expect(entry.tag).toBe('design');
    }
  });

  it('ScreenEntry discriminated union has correct shape for notePreview', async () => {
    const entry: import('../src/types.js').ScreenEntry = {
      screen: 'notePreview',
      filePath: '/notes/test.md',
    };
    expect(entry.screen).toBe('notePreview');
    if (entry.screen === 'notePreview') {
      expect(entry.filePath).toBe('/notes/test.md');
    }
  });

  it('ScreenEntry discriminated union has correct shape for search', async () => {
    const entry: import('../src/types.js').ScreenEntry = {
      screen: 'search',
      initialQuery: 'API',
    };
    expect(entry.screen).toBe('search');
    if (entry.screen === 'search') {
      expect(entry.initialQuery).toBe('API');
    }
  });

  it('ScreenEntry discriminated union has correct shape for capture', async () => {
    const entry: import('../src/types.js').ScreenEntry = { screen: 'capture' };
    expect(entry.screen).toBe('capture');
  });

  it('AppError base class and subclasses work correctly', async () => {
    const {
      AppError,
      NoteNotFoundError,
      SlugCollisionError,
      FileWriteError,
      FtsQueryError,
      FrontmatterParseError,
      NoteSizeLimitError,
    } = await import('../src/types.js');

    const base = new AppError('base error', 'APP_ERROR');
    expect(base).toBeInstanceOf(Error);
    expect(base).toBeInstanceOf(AppError);
    expect(base.message).toBe('base error');
    expect(base.code).toBe('APP_ERROR');
    expect(base.name).toBe('AppError');

    const noteNotFound = new NoteNotFoundError('/notes/missing.md');
    expect(noteNotFound).toBeInstanceOf(AppError);
    expect(noteNotFound.code).toBe('NOTE_NOT_FOUND');
    expect(noteNotFound.message).toContain('/notes/missing.md');
    expect(noteNotFound.filePath).toBe('/notes/missing.md');

    const slugCollision = new SlugCollisionError('my-note', '/notes/my-note.md');
    expect(slugCollision).toBeInstanceOf(AppError);
    expect(slugCollision.code).toBe('SLUG_COLLISION');
    expect(slugCollision.slug).toBe('my-note');
    expect(slugCollision.existingPath).toBe('/notes/my-note.md');

    const fileWrite = new FileWriteError('/notes/fail.md', 'EACCES');
    expect(fileWrite).toBeInstanceOf(AppError);
    expect(fileWrite.code).toBe('FILE_WRITE_ERROR');
    expect(fileWrite.filePath).toBe('/notes/fail.md');

    const ftsQuery = new FtsQueryError('bad query *[', 'fts5 syntax error');
    expect(ftsQuery).toBeInstanceOf(AppError);
    expect(ftsQuery.code).toBe('FTS_QUERY_ERROR');
    expect(ftsQuery.query).toBe('bad query *[');

    const frontmatterParse = new FrontmatterParseError('/notes/bad.md', 'invalid YAML');
    expect(frontmatterParse).toBeInstanceOf(AppError);
    expect(frontmatterParse.code).toBe('FRONTMATTER_PARSE_ERROR');
    expect(frontmatterParse.filePath).toBe('/notes/bad.md');

    const sizeLimit = new NoteSizeLimitError('/notes/huge.md', 2_000_000, 1_000_000);
    expect(sizeLimit).toBeInstanceOf(AppError);
    expect(sizeLimit.code).toBe('NOTE_SIZE_LIMIT');
    expect(sizeLimit.actualSize).toBe(2_000_000);
    expect(sizeLimit.maxSize).toBe(1_000_000);

    const { InvalidTitleError, TitleTooLongError } = await import('../src/types.js');

    const invalidTitle = new InvalidTitleError('A/B');
    expect(invalidTitle).toBeInstanceOf(AppError);
    expect(invalidTitle.code).toBe('INVALID_TITLE');
    expect(invalidTitle.title).toBe('A/B');
    expect(invalidTitle.message).toContain('forbidden characters');

    const titleTooLong = new TitleTooLongError('Very long title', 300, 252);
    expect(titleTooLong).toBeInstanceOf(AppError);
    expect(titleTooLong.code).toBe('TITLE_TOO_LONG');
    expect(titleTooLong.title).toBe('Very long title');
    expect(titleTooLong.byteLength).toBe(300);
    expect(titleTooLong.maxBytes).toBe(252);
  });

  it('NavigationState holds a stack of ScreenEntry', async () => {
    type ScreenEntry = import('../src/types.js').ScreenEntry;
    type NavigationState = import('../src/types.js').NavigationState;

    const stack: readonly ScreenEntry[] = [
      { screen: 'palette' },
      { screen: 'noteList', tag: 'api' },
      { screen: 'notePreview', filePath: '/notes/api.md' },
    ];
    const state: NavigationState = { stack };

    expect(state.stack).toHaveLength(3);
    expect(state.stack[0]!.screen).toBe('palette');
    expect(state.stack[2]!.screen).toBe('notePreview');
  });
});
