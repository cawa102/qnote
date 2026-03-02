import { describe, it, expect } from 'vitest';
import { getNextHeaderFocus, computeEditorLayout, SEPARATOR_WIDTH, nextCtrlEState, handleTreeKey } from '../../../src/tui/screens/EditorScreen.js';
import type { FocusArea } from '../../../src/tui/editor/types.js';
import type { FileTreeNode } from '../../../src/tui/editor/types.js';

describe('EditorScreen', () => {
  it('exports EditorScreen component', async () => {
    const mod = await import('../../../src/tui/screens/EditorScreen.js');
    expect(typeof mod.EditorScreen).toBe('function');
  });
});

describe('EditorScreen module structure', () => {
  it('EditorScreen is a React function component', async () => {
    const mod = await import('../../../src/tui/screens/EditorScreen.js');
    expect(mod.EditorScreen.name).toBe('EditorScreen');
  });
});

describe('getNextHeaderFocus', () => {
  it('returns headerTitle when Ctrl+T is pressed from editor', () => {
    expect(getNextHeaderFocus('editor', 't')).toBe('headerTitle');
  });

  it('returns headerTitle when Ctrl+T is pressed from headerTags', () => {
    expect(getNextHeaderFocus('headerTags', 't')).toBe('headerTitle');
  });

  it('returns headerTags when Ctrl+G is pressed from editor', () => {
    expect(getNextHeaderFocus('editor', 'g')).toBe('headerTags');
  });

  it('returns headerTags when Ctrl+G is pressed from headerTitle', () => {
    expect(getNextHeaderFocus('headerTitle', 'g')).toBe('headerTags');
  });

  it('returns headerTitle when Ctrl+T pressed while already on headerTitle (idempotent)', () => {
    expect(getNextHeaderFocus('headerTitle', 't')).toBe('headerTitle');
  });

  it('returns headerTags when Ctrl+G pressed while already on headerTags (idempotent)', () => {
    expect(getNextHeaderFocus('headerTags', 'g')).toBe('headerTags');
  });

  it('returns null for unrecognized key', () => {
    expect(getNextHeaderFocus('editor', 'x')).toBeNull();
  });

  it('returns null from fileTree focus', () => {
    expect(getNextHeaderFocus('fileTree', 't')).toBeNull();
  });
});

describe('SEPARATOR_WIDTH', () => {
  it('is 3 characters wide (space + line + space)', () => {
    expect(SEPARATOR_WIDTH).toBe(3);
  });
});

describe('computeEditorLayout', () => {
  it('returns zero treeWidth and separatorWidth when file tree is hidden', () => {
    const layout = computeEditorLayout(80, false);
    expect(layout.treeWidth).toBe(0);
    expect(layout.separatorWidth).toBe(0);
    expect(layout.editorWidth).toBe(80);
  });

  it('includes separator width when file tree is visible', () => {
    const layout = computeEditorLayout(80, true);
    expect(layout.separatorWidth).toBe(SEPARATOR_WIDTH);
    expect(layout.editorWidth).toBe(80 - layout.treeWidth - SEPARATOR_WIDTH);
  });

  it('clamps tree width to minimum 15', () => {
    // 40 * 0.25 = 10, clamped to 15
    const layout = computeEditorLayout(40, true);
    expect(layout.treeWidth).toBe(15);
    expect(layout.editorWidth).toBe(40 - 15 - SEPARATOR_WIDTH);
  });

  it('clamps tree width to maximum 30', () => {
    // 200 * 0.25 = 50, clamped to 30
    const layout = computeEditorLayout(200, true);
    expect(layout.treeWidth).toBe(30);
    expect(layout.editorWidth).toBe(200 - 30 - SEPARATOR_WIDTH);
  });

  it('calculates 25% tree width within bounds', () => {
    // 100 * 0.25 = 25, within [15, 30]
    const layout = computeEditorLayout(100, true);
    expect(layout.treeWidth).toBe(25);
    expect(layout.editorWidth).toBe(100 - 25 - SEPARATOR_WIDTH);
  });
});

describe('nextCtrlEState', () => {
  it('shows tree and focuses it when tree is hidden', () => {
    const result = nextCtrlEState(false, 'editor');
    expect(result).toEqual({ fileTreeVisible: true, focus: 'fileTree' });
  });

  it('focuses tree when tree is visible but editor has focus', () => {
    const result = nextCtrlEState(true, 'editor');
    expect(result).toEqual({ fileTreeVisible: true, focus: 'fileTree' });
  });

  it('hides tree and returns focus to editor when tree has focus', () => {
    const result = nextCtrlEState(true, 'fileTree');
    expect(result).toEqual({ fileTreeVisible: false, focus: 'editor' });
  });

  it('focuses tree when tree is visible but headerTitle has focus', () => {
    const result = nextCtrlEState(true, 'headerTitle');
    expect(result).toEqual({ fileTreeVisible: true, focus: 'fileTree' });
  });

  it('focuses tree when tree is visible but headerTags has focus', () => {
    const result = nextCtrlEState(true, 'headerTags');
    expect(result).toEqual({ fileTreeVisible: true, focus: 'fileTree' });
  });
});

describe('handleTreeKey', () => {
  const tree: FileTreeNode = {
    name: 'notes',
    path: '/notes',
    type: 'directory',
    expanded: true,
    children: [
      { name: 'a.md', path: '/notes/a.md', type: 'file' },
      {
        name: 'sub',
        path: '/notes/sub',
        type: 'directory',
        expanded: true,
        children: [
          { name: 'b.md', path: '/notes/sub/b.md', type: 'file' },
        ],
      },
      { name: 'c.md', path: '/notes/c.md', type: 'file' },
    ],
  };

  // Flat visible order: notes(0), a.md(1), sub(2), b.md(3), c.md(4)

  it('j moves cursor down', () => {
    const result = handleTreeKey('j', tree, 0);
    expect(result).toEqual({ type: 'move', index: 1 });
  });

  it('k moves cursor up', () => {
    const result = handleTreeKey('k', tree, 2);
    expect(result).toEqual({ type: 'move', index: 1 });
  });

  it('j does not move past last item', () => {
    const result = handleTreeKey('j', tree, 4);
    expect(result).toEqual({ type: 'move', index: 4 });
  });

  it('k does not move before first item', () => {
    const result = handleTreeKey('k', tree, 0);
    expect(result).toEqual({ type: 'move', index: 0 });
  });

  it('Enter on a file returns open action', () => {
    const result = handleTreeKey('return', tree, 1);
    expect(result).toEqual({ type: 'open', path: '/notes/a.md' });
  });

  it('Enter on a directory returns toggle action', () => {
    const result = handleTreeKey('return', tree, 2);
    expect(result).toEqual({ type: 'toggle', path: '/notes/sub' });
  });

  it('l on a collapsed directory returns toggle (expand)', () => {
    const collapsedTree: FileTreeNode = {
      ...tree,
      children: [
        { name: 'sub', path: '/notes/sub', type: 'directory', expanded: false, children: [] },
      ],
    };
    // Flat: notes(0), sub(1)
    const result = handleTreeKey('l', collapsedTree, 1);
    expect(result).toEqual({ type: 'toggle', path: '/notes/sub' });
  });

  it('l on an expanded directory is noop', () => {
    const result = handleTreeKey('l', tree, 2);
    expect(result).toEqual({ type: 'noop' });
  });

  it('h on an expanded directory returns toggle (collapse)', () => {
    const result = handleTreeKey('h', tree, 2);
    expect(result).toEqual({ type: 'toggle', path: '/notes/sub' });
  });

  it('h on a collapsed directory is noop', () => {
    const collapsedTree: FileTreeNode = {
      ...tree,
      children: [
        { name: 'sub', path: '/notes/sub', type: 'directory', expanded: false, children: [] },
      ],
    };
    const result = handleTreeKey('h', collapsedTree, 1);
    expect(result).toEqual({ type: 'noop' });
  });

  it('h on a file is noop', () => {
    const result = handleTreeKey('h', tree, 1);
    expect(result).toEqual({ type: 'noop' });
  });

  it('l on a file is noop', () => {
    const result = handleTreeKey('l', tree, 1);
    expect(result).toEqual({ type: 'noop' });
  });

  // Arrow key aliases
  it('down arrow moves cursor down (alias for j)', () => {
    const result = handleTreeKey('down', tree, 0);
    expect(result).toEqual({ type: 'move', index: 1 });
  });

  it('up arrow moves cursor up (alias for k)', () => {
    const result = handleTreeKey('up', tree, 2);
    expect(result).toEqual({ type: 'move', index: 1 });
  });

  it('down arrow does not move past last item', () => {
    const result = handleTreeKey('down', tree, 4);
    expect(result).toEqual({ type: 'move', index: 4 });
  });

  it('up arrow does not move before first item', () => {
    const result = handleTreeKey('up', tree, 0);
    expect(result).toEqual({ type: 'move', index: 0 });
  });

  it('right arrow on collapsed directory expands (alias for l)', () => {
    const collapsedTree: FileTreeNode = {
      ...tree,
      children: [
        { name: 'sub', path: '/notes/sub', type: 'directory', expanded: false, children: [] },
      ],
    };
    const result = handleTreeKey('right', collapsedTree, 1);
    expect(result).toEqual({ type: 'toggle', path: '/notes/sub' });
  });

  it('right arrow on expanded directory is noop', () => {
    const result = handleTreeKey('right', tree, 2);
    expect(result).toEqual({ type: 'noop' });
  });

  it('left arrow on expanded directory collapses (alias for h)', () => {
    const result = handleTreeKey('left', tree, 2);
    expect(result).toEqual({ type: 'toggle', path: '/notes/sub' });
  });

  it('left arrow on collapsed directory is noop', () => {
    const collapsedTree: FileTreeNode = {
      ...tree,
      children: [
        { name: 'sub', path: '/notes/sub', type: 'directory', expanded: false, children: [] },
      ],
    };
    const result = handleTreeKey('left', collapsedTree, 1);
    expect(result).toEqual({ type: 'noop' });
  });

  it('unrecognized key is noop', () => {
    const result = handleTreeKey('x', tree, 0);
    expect(result).toEqual({ type: 'noop' });
  });
});

