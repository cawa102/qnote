import React from 'react';
import { Box, Text } from 'ink';
import type { FileTreeNode } from '../editor/types.js';
import { flattenTree } from '../editor/file-tree-builder.js';
import type { FlatTreeEntry } from '../editor/file-tree-builder.js';
import { theme } from '../../theme/colors.js';

interface FileTreeProps {
  readonly root: FileTreeNode;
  readonly selectedPath: string;
  readonly cursorIndex?: number;
  readonly width: number;
  readonly height: number;
  readonly onSelect: (path: string) => void;
}

function displayName(node: FileTreeNode): string {
  if (node.type === 'file') {
    return node.name.replace(/\.md$/, '');
  }
  return node.name;
}

function directoryIndicator(node: FileTreeNode): string {
  if (node.type !== 'directory') {
    return '  ';
  }
  return node.expanded ? '▾ ' : '▸ ';
}

interface TreeLineProps {
  readonly node: FileTreeNode;
  readonly depth: number;
  readonly isSelected: boolean;
  readonly width: number;
}

function TreeLine({ node, depth, isSelected, width }: TreeLineProps): React.ReactElement {
  const indent = '  '.repeat(depth);
  const indicator = directoryIndicator(node);
  const name = displayName(node);
  const prefix = `${indent}${indicator}`;

  const maxNameWidth = Math.max(1, width - prefix.length);
  const truncatedName = name.length > maxNameWidth
    ? name.slice(0, maxNameWidth - 1) + '…'
    : name;

  const text = `${prefix}${truncatedName}`;

  if (isSelected) {
    return <Text>{theme.selected(text)}</Text>;
  }

  if (node.type === 'directory') {
    return <Text>{theme.accent(text)}</Text>;
  }

  return <Text>{text}</Text>;
}

export function FileTree({
  root,
  selectedPath,
  cursorIndex,
  width,
  height,
}: FileTreeProps): React.ReactElement {
  const flatEntries: readonly FlatTreeEntry[] = flattenTree(root);

  // Use cursorIndex if provided, otherwise fall back to path-based selection
  const selectedIndex = cursorIndex !== undefined
    ? cursorIndex
    : flatEntries.findIndex((e) => e.node.path === selectedPath);
  const scrollOffset = React.useMemo(() => {
    if (selectedIndex < 0) return 0;
    if (selectedIndex < height) return 0;
    return Math.max(0, selectedIndex - height + 1);
  }, [selectedIndex, height]);

  const visibleEntries = flatEntries.slice(scrollOffset, scrollOffset + height);

  return (
    <Box flexDirection="column" width={width}>
      {visibleEntries.map((entry, i) => (
        <TreeLine
          key={entry.node.path}
          node={entry.node}
          depth={entry.depth}
          isSelected={scrollOffset + i === selectedIndex}
          width={width}
        />
      ))}
    </Box>
  );
}
