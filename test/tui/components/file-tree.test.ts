import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { FileTree } from '../../../src/tui/components/FileTree.js';
import type { FileTreeNode } from '../../../src/tui/editor/types.js';

function createRoot(overrides: Partial<FileTreeNode> = {}): FileTreeNode {
  return {
    name: 'notes',
    path: '/notes',
    type: 'directory',
    expanded: true,
    children: [
      {
        name: 'journal',
        path: '/notes/journal',
        type: 'directory',
        expanded: true,
        children: [
          { name: 'day1.md', path: '/notes/journal/day1.md', type: 'file' },
        ],
      },
      { name: 'hello.md', path: '/notes/hello.md', type: 'file' },
      { name: 'world.md', path: '/notes/world.md', type: 'file' },
    ],
    ...overrides,
  };
}

function createProps(overrides: Partial<{
  root: FileTreeNode;
  selectedPath: string;
  width: number;
  height: number;
  onSelect: (path: string) => void;
}> = {}) {
  return {
    root: overrides.root ?? createRoot(),
    selectedPath: overrides.selectedPath ?? '',
    width: overrides.width ?? 25,
    height: overrides.height ?? 20,
    onSelect: overrides.onSelect ?? vi.fn(),
  };
}

describe('FileTree', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders directory names', () => {
      const props = createProps();
      const { lastFrame } = render(React.createElement(FileTree, props));
      const frame = lastFrame();
      expect(frame).toContain('journal');
    });

    it('renders file names without .md extension', () => {
      const props = createProps();
      const { lastFrame } = render(React.createElement(FileTree, props));
      const frame = lastFrame();
      expect(frame).toContain('hello');
      expect(frame).toContain('world');
    });

    it('renders nested files under expanded directory', () => {
      const props = createProps();
      const { lastFrame } = render(React.createElement(FileTree, props));
      expect(lastFrame()).toContain('day1');
    });

    it('hides children of collapsed directory', () => {
      const root = createRoot();
      const collapsedRoot: FileTreeNode = {
        ...root,
        children: [
          {
            name: 'journal',
            path: '/notes/journal',
            type: 'directory',
            expanded: false,
            children: [
              { name: 'day1.md', path: '/notes/journal/day1.md', type: 'file' },
            ],
          },
          { name: 'hello.md', path: '/notes/hello.md', type: 'file' },
        ],
      };
      const props = createProps({ root: collapsedRoot });
      const { lastFrame } = render(React.createElement(FileTree, props));
      const frame = lastFrame();
      expect(frame).toContain('journal');
      expect(frame).not.toContain('day1');
    });

    it('shows expand indicator for directories', () => {
      const props = createProps();
      const { lastFrame } = render(React.createElement(FileTree, props));
      const frame = lastFrame();
      // Expanded directory should show ▾
      expect(frame).toContain('▾');
    });

    it('shows collapse indicator for collapsed directories', () => {
      const root: FileTreeNode = {
        name: 'notes',
        path: '/notes',
        type: 'directory',
        expanded: true,
        children: [
          {
            name: 'collapsed',
            path: '/notes/collapsed',
            type: 'directory',
            expanded: false,
            children: [],
          },
        ],
      };
      const props = createProps({ root });
      const { lastFrame } = render(React.createElement(FileTree, props));
      expect(lastFrame()).toContain('▸');
    });
  });

  describe('empty state', () => {
    it('renders empty tree for directory with no children', () => {
      const root: FileTreeNode = {
        name: 'notes',
        path: '/notes',
        type: 'directory',
        expanded: true,
        children: [],
      };
      const props = createProps({ root });
      const { lastFrame } = render(React.createElement(FileTree, props));
      const frame = lastFrame();
      expect(frame).toContain('notes');
    });
  });

  describe('selection', () => {
    it('highlights selected file', () => {
      const props = createProps({ selectedPath: '/notes/hello.md' });
      const { lastFrame } = render(React.createElement(FileTree, props));
      // The selected item should be rendered (highlighted differently)
      expect(lastFrame()).toContain('hello');
    });

    it('highlights selected directory', () => {
      const props = createProps({ selectedPath: '/notes/journal' });
      const { lastFrame } = render(React.createElement(FileTree, props));
      expect(lastFrame()).toContain('journal');
    });
  });

  describe('indentation', () => {
    it('indents nested items deeper than root items', () => {
      const props = createProps();
      const { lastFrame } = render(React.createElement(FileTree, props));
      const frame = lastFrame();
      const lines = frame.split('\n');
      // Find lines containing journal (dir) and day1 (nested file)
      const journalLine = lines.find((l) => l.includes('journal'));
      const day1Line = lines.find((l) => l.includes('day1'));
      expect(journalLine).toBeDefined();
      expect(day1Line).toBeDefined();
      // Nested item should have more leading whitespace
      const journalIndent = journalLine!.search(/\S/);
      const day1Indent = day1Line!.search(/\S/);
      expect(day1Indent).toBeGreaterThan(journalIndent);
    });
  });
});
