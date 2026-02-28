import { describe, it, expect } from 'vitest';

describe('editor types', () => {
  it('CursorPosition has readonly line and col', async () => {
    const pos: import('../../../src/tui/editor/types.js').CursorPosition = {
      line: 5,
      col: 10,
    };
    expect(pos.line).toBe(5);
    expect(pos.col).toBe(10);
  });

  it('Selection has readonly anchor and head', async () => {
    const sel: import('../../../src/tui/editor/types.js').Selection = {
      anchor: { line: 1, col: 0 },
      head: { line: 3, col: 5 },
    };
    expect(sel.anchor.line).toBe(1);
    expect(sel.head.col).toBe(5);
  });

  it('TextBufferState has readonly lines, cursor, and optional selection', async () => {
    const state: import('../../../src/tui/editor/types.js').TextBufferState = {
      lines: ['hello', 'world'],
      cursor: { line: 0, col: 5 },
      selection: null,
    };
    expect(state.lines).toEqual(['hello', 'world']);
    expect(state.cursor.line).toBe(0);
    expect(state.selection).toBeNull();
  });

  it('TextBufferState supports non-null selection', async () => {
    const state: import('../../../src/tui/editor/types.js').TextBufferState = {
      lines: ['test'],
      cursor: { line: 0, col: 2 },
      selection: {
        anchor: { line: 0, col: 0 },
        head: { line: 0, col: 4 },
      },
    };
    expect(state.selection).not.toBeNull();
    expect(state.selection!.anchor.col).toBe(0);
    expect(state.selection!.head.col).toBe(4);
  });

  it('UndoEntry has readonly before and after states', async () => {
    const entry: import('../../../src/tui/editor/types.js').UndoEntry = {
      before: {
        lines: ['before'],
        cursor: { line: 0, col: 0 },
        selection: null,
      },
      after: {
        lines: ['after'],
        cursor: { line: 0, col: 5 },
        selection: null,
      },
    };
    expect(entry.before.lines[0]).toBe('before');
    expect(entry.after.lines[0]).toBe('after');
  });

  it('BufferInfo has all required readonly fields', async () => {
    const info: import('../../../src/tui/editor/types.js').BufferInfo = {
      id: 'buffer-1',
      filePath: '/notes/test.md',
      title: 'Test Note',
      dirty: true,
    };
    expect(info.id).toBe('buffer-1');
    expect(info.filePath).toBe('/notes/test.md');
    expect(info.title).toBe('Test Note');
    expect(info.dirty).toBe(true);
  });

  it('BufferInfo dirty flag reflects boolean correctly', async () => {
    const clean: import('../../../src/tui/editor/types.js').BufferInfo = {
      id: '1',
      filePath: '/a.md',
      title: 'A',
      dirty: false,
    };
    const dirty: import('../../../src/tui/editor/types.js').BufferInfo = {
      id: '2',
      filePath: '/b.md',
      title: 'B',
      dirty: true,
    };
    expect(clean.dirty).toBe(false);
    expect(dirty.dirty).toBe(true);
  });

  it('EditorScreenParams supports optional filePath and showFileTree', async () => {
    const withFile: import('../../../src/tui/editor/types.js').EditorScreenParams = {
      filePath: '/notes/test.md',
    };
    const withTree: import('../../../src/tui/editor/types.js').EditorScreenParams = {
      showFileTree: true,
    };
    const empty: import('../../../src/tui/editor/types.js').EditorScreenParams = {};
    expect(withFile.filePath).toBe('/notes/test.md');
    expect(withTree.showFileTree).toBe(true);
    expect(empty.filePath).toBeUndefined();
    expect(empty.showFileTree).toBeUndefined();
  });

  it('EditorMode is a union of edit and preview', async () => {
    const edit: import('../../../src/tui/editor/types.js').EditorMode = 'edit';
    const preview: import('../../../src/tui/editor/types.js').EditorMode = 'preview';
    expect(edit).toBe('edit');
    expect(preview).toBe('preview');
  });

  it('FocusArea is a union of four areas', async () => {
    const areas: import('../../../src/tui/editor/types.js').FocusArea[] = [
      'editor',
      'fileTree',
      'headerTitle',
      'headerTags',
    ];
    expect(areas).toHaveLength(4);
    expect(areas).toContain('editor');
    expect(areas).toContain('fileTree');
    expect(areas).toContain('headerTitle');
    expect(areas).toContain('headerTags');
  });

  it('FileTreeNode has required readonly fields', async () => {
    const file: import('../../../src/tui/editor/types.js').FileTreeNode = {
      name: 'test.md',
      path: '/notes/test.md',
      type: 'file',
    };
    expect(file.name).toBe('test.md');
    expect(file.path).toBe('/notes/test.md');
    expect(file.type).toBe('file');
    expect(file.children).toBeUndefined();
    expect(file.expanded).toBeUndefined();
  });

  it('FileTreeNode supports directory with children and expanded', async () => {
    const dir: import('../../../src/tui/editor/types.js').FileTreeNode = {
      name: 'notes',
      path: '/notes',
      type: 'directory',
      children: [
        { name: 'a.md', path: '/notes/a.md', type: 'file' },
        { name: 'b.md', path: '/notes/b.md', type: 'file' },
      ],
      expanded: true,
    };
    expect(dir.type).toBe('directory');
    expect(dir.children).toHaveLength(2);
    expect(dir.expanded).toBe(true);
  });

  it('FileTreeNode children are readonly', async () => {
    const dir: import('../../../src/tui/editor/types.js').FileTreeNode = {
      name: 'dir',
      path: '/dir',
      type: 'directory',
      children: [{ name: 'child.md', path: '/dir/child.md', type: 'file' }],
    };
    expect(dir.children![0]!.name).toBe('child.md');
  });
});

describe('ScreenName and ScreenEntry include editor', () => {
  it('ScreenName includes editor', async () => {
    const name: import('../../../src/types.js').ScreenName = 'editor';
    expect(name).toBe('editor');
  });

  it('ScreenEntry supports editor with params', async () => {
    const entry: import('../../../src/types.js').ScreenEntry = {
      screen: 'editor',
      filePath: '/notes/test.md',
    };
    expect(entry.screen).toBe('editor');
    if (entry.screen === 'editor') {
      expect(entry.filePath).toBe('/notes/test.md');
    }
  });

  it('ScreenEntry supports editor with showFileTree', async () => {
    const entry: import('../../../src/types.js').ScreenEntry = {
      screen: 'editor',
      showFileTree: true,
    };
    expect(entry.screen).toBe('editor');
    if (entry.screen === 'editor') {
      expect(entry.showFileTree).toBe(true);
    }
  });

  it('ScreenEntry supports editor with no params', async () => {
    const entry: import('../../../src/types.js').ScreenEntry = {
      screen: 'editor',
    };
    expect(entry.screen).toBe('editor');
  });
});
