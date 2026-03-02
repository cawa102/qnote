import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildFileTree, flattenTree } from '../../../src/tui/editor/file-tree-builder.js';
import type { FileTreeNode } from '../../../src/tui/editor/types.js';

describe('buildFileTree', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'qnote-tree-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns root node for empty directory', async () => {
    const tree = await buildFileTree(tempDir);
    expect(tree.type).toBe('directory');
    expect(tree.path).toBe(tempDir);
    expect(tree.children).toEqual([]);
    expect(tree.expanded).toBe(true);
  });

  it('lists markdown files', async () => {
    await writeFile(join(tempDir, 'note1.md'), '# Note 1');
    await writeFile(join(tempDir, 'note2.md'), '# Note 2');

    const tree = await buildFileTree(tempDir);
    const children = tree.children ?? [];
    expect(children).toHaveLength(2);
    expect(children.map((c) => c.name)).toContain('note1.md');
    expect(children.map((c) => c.name)).toContain('note2.md');
  });

  it('excludes non-markdown files', async () => {
    await writeFile(join(tempDir, 'note.md'), '# Note');
    await writeFile(join(tempDir, 'readme.txt'), 'text');
    await writeFile(join(tempDir, 'data.json'), '{}');

    const tree = await buildFileTree(tempDir);
    const children = tree.children ?? [];
    expect(children).toHaveLength(1);
    expect(children[0].name).toBe('note.md');
  });

  it('excludes dotfiles', async () => {
    await writeFile(join(tempDir, '.hidden.md'), '# Hidden');
    await writeFile(join(tempDir, 'visible.md'), '# Visible');

    const tree = await buildFileTree(tempDir);
    const children = tree.children ?? [];
    expect(children).toHaveLength(1);
    expect(children[0].name).toBe('visible.md');
  });

  it('includes subdirectories', async () => {
    await mkdir(join(tempDir, 'subdir'));
    await writeFile(join(tempDir, 'subdir', 'nested.md'), '# Nested');

    const tree = await buildFileTree(tempDir);
    const children = tree.children ?? [];
    const dir = children.find((c) => c.name === 'subdir');
    expect(dir).toBeDefined();
    expect(dir!.type).toBe('directory');
    expect(dir!.children).toHaveLength(1);
    expect(dir!.children![0].name).toBe('nested.md');
  });

  it('excludes hidden directories', async () => {
    await mkdir(join(tempDir, '.hidden'));
    await writeFile(join(tempDir, '.hidden', 'secret.md'), '# Secret');
    await mkdir(join(tempDir, 'visible'));
    await writeFile(join(tempDir, 'visible', 'note.md'), '# Note');

    const tree = await buildFileTree(tempDir);
    const children = tree.children ?? [];
    expect(children).toHaveLength(1);
    expect(children[0].name).toBe('visible');
  });

  it('sorts directories before files', async () => {
    await writeFile(join(tempDir, 'aaa.md'), '# AAA');
    await mkdir(join(tempDir, 'zzz'));

    const tree = await buildFileTree(tempDir);
    const children = tree.children ?? [];
    expect(children[0].name).toBe('zzz');
    expect(children[0].type).toBe('directory');
    expect(children[1].name).toBe('aaa.md');
    expect(children[1].type).toBe('file');
  });

  it('sorts alphabetically within directories and files', async () => {
    await writeFile(join(tempDir, 'charlie.md'), '');
    await writeFile(join(tempDir, 'alpha.md'), '');
    await writeFile(join(tempDir, 'bravo.md'), '');

    const tree = await buildFileTree(tempDir);
    const children = tree.children ?? [];
    const names = children.map((c) => c.name);
    expect(names).toEqual(['alpha.md', 'bravo.md', 'charlie.md']);
  });

  it('handles nested directory structure', async () => {
    await mkdir(join(tempDir, 'journal'));
    await mkdir(join(tempDir, 'journal', '2026'));
    await writeFile(join(tempDir, 'journal', '2026', 'feb.md'), '');

    const tree = await buildFileTree(tempDir);
    const journal = (tree.children ?? []).find((c) => c.name === 'journal');
    expect(journal).toBeDefined();
    const year = (journal!.children ?? []).find((c) => c.name === '2026');
    expect(year).toBeDefined();
    expect(year!.children).toHaveLength(1);
    expect(year!.children![0].name).toBe('feb.md');
  });

  it('sets file type correctly', async () => {
    await writeFile(join(tempDir, 'note.md'), '');
    const tree = await buildFileTree(tempDir);
    const children = tree.children ?? [];
    expect(children[0].type).toBe('file');
  });

  it('sets correct path for files', async () => {
    await writeFile(join(tempDir, 'note.md'), '');
    const tree = await buildFileTree(tempDir);
    const children = tree.children ?? [];
    expect(children[0].path).toBe(join(tempDir, 'note.md'));
  });

  it('excludes symlinks pointing outside root directory', async () => {
    // Create a directory outside the notes root
    const outsideDir = await mkdtemp(join(tmpdir(), 'qnote-outside-'));
    await writeFile(join(outsideDir, 'secret.md'), '# Secret');

    // Create a symlink inside tempDir pointing outside
    await symlink(outsideDir, join(tempDir, 'escape-link'));
    await writeFile(join(tempDir, 'safe.md'), '# Safe');

    const tree = await buildFileTree(tempDir);
    const children = tree.children ?? [];
    const names = children.map((c) => c.name);
    expect(names).toContain('safe.md');
    expect(names).not.toContain('escape-link');

    await rm(outsideDir, { recursive: true, force: true });
  });

  it('allows symlinks pointing within root directory', async () => {
    await mkdir(join(tempDir, 'real'));
    await writeFile(join(tempDir, 'real', 'note.md'), '# Note');
    await symlink(join(tempDir, 'real'), join(tempDir, 'link-to-real'));

    const tree = await buildFileTree(tempDir);
    const children = tree.children ?? [];
    const names = children.map((c) => c.name);
    expect(names).toContain('link-to-real');
    expect(names).toContain('real');
  });

  it('excludes symlinks to prefix-match sibling directory', async () => {
    // Create a sibling dir whose name starts with tempDir's name (e.g. /notes-evil vs /notes)
    const siblingDir = `${tempDir}-evil`;
    await mkdir(siblingDir);
    await writeFile(join(siblingDir, 'secret.md'), '# Secret');

    // Create a symlink inside tempDir pointing to the sibling
    await symlink(siblingDir, join(tempDir, 'evil-link'));
    await writeFile(join(tempDir, 'safe.md'), '# Safe');

    const tree = await buildFileTree(tempDir);
    const children = tree.children ?? [];
    const names = children.map((c) => c.name);
    expect(names).toContain('safe.md');
    expect(names).not.toContain('evil-link');

    await rm(siblingDir, { recursive: true, force: true });
  });

  it('excludes empty subdirectories with no markdown files', async () => {
    await mkdir(join(tempDir, 'emptydir'));

    const tree = await buildFileTree(tempDir);
    const children = tree.children ?? [];
    // Empty directories should still appear (they exist in the filesystem)
    expect(children).toHaveLength(1);
    expect(children[0].name).toBe('emptydir');
    expect(children[0].children).toEqual([]);
  });
});

describe('flattenTree', () => {
  it('returns only root for empty tree with depth 0', () => {
    const root: FileTreeNode = {
      name: 'notes',
      path: '/notes',
      type: 'directory',
      children: [],
      expanded: true,
    };
    const flat = flattenTree(root);
    expect(flat).toHaveLength(1);
    expect(flat[0].node.name).toBe('notes');
    expect(flat[0].depth).toBe(0);
  });

  it('shows children of expanded directory with correct depths', () => {
    const root: FileTreeNode = {
      name: 'notes',
      path: '/notes',
      type: 'directory',
      expanded: true,
      children: [
        { name: 'note1.md', path: '/notes/note1.md', type: 'file' },
        { name: 'note2.md', path: '/notes/note2.md', type: 'file' },
      ],
    };
    const flat = flattenTree(root);
    expect(flat).toHaveLength(3);
    expect(flat[0].node.name).toBe('notes');
    expect(flat[0].depth).toBe(0);
    expect(flat[1].node.name).toBe('note1.md');
    expect(flat[1].depth).toBe(1);
    expect(flat[2].node.name).toBe('note2.md');
    expect(flat[2].depth).toBe(1);
  });

  it('hides children of collapsed directory', () => {
    const root: FileTreeNode = {
      name: 'notes',
      path: '/notes',
      type: 'directory',
      expanded: false,
      children: [
        { name: 'note1.md', path: '/notes/note1.md', type: 'file' },
      ],
    };
    const flat = flattenTree(root);
    expect(flat).toHaveLength(1);
    expect(flat[0].node.name).toBe('notes');
  });

  it('flattens nested expanded directories with increasing depths', () => {
    const root: FileTreeNode = {
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
        { name: 'readme.md', path: '/notes/readme.md', type: 'file' },
      ],
    };
    const flat = flattenTree(root);
    expect(flat).toHaveLength(4);
    expect(flat.map((e) => e.node.name)).toEqual(['notes', 'journal', 'day1.md', 'readme.md']);
    expect(flat.map((e) => e.depth)).toEqual([0, 1, 2, 1]);
  });

  it('stops at collapsed nested directory', () => {
    const root: FileTreeNode = {
      name: 'notes',
      path: '/notes',
      type: 'directory',
      expanded: true,
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
      ],
    };
    const flat = flattenTree(root);
    expect(flat).toHaveLength(2);
    expect(flat.map((e) => e.node.name)).toEqual(['notes', 'journal']);
    expect(flat.map((e) => e.depth)).toEqual([0, 1]);
  });

  it('handles file nodes (no children)', () => {
    const file: FileTreeNode = {
      name: 'solo.md',
      path: '/notes/solo.md',
      type: 'file',
    };
    const flat = flattenTree(file);
    expect(flat).toHaveLength(1);
    expect(flat[0].node.name).toBe('solo.md');
    expect(flat[0].depth).toBe(0);
  });
});
