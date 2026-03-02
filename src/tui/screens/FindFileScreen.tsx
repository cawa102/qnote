import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';
import Fuse from 'fuse.js';
import { theme } from '../../theme/colors.js';
import { formatIndicator } from '../../theme/format.js';
import { useDebounce } from '../hooks/use-debounce.js';
import { useLayoutContext } from '../hooks/layout-context.js';
import { useViewport } from '../hooks/use-viewport.js';
import { scanNoteFiles } from '../../storage/file-scanner.js';
import type { ScannedFile } from '../../storage/file-scanner.js';
import type { NavigationStore } from '../hooks/use-navigation.js';
import type { InputModeStore } from '../hooks/use-input-mode.js';

const DEBOUNCE_MS = 150;
const MAX_DISPLAY = 100;
const FUSE_OPTIONS = {
  keys: ['relativePath'],
  threshold: 0.4,
};

/**
 * Build display entries from scanned files, applying fuzzy filter and truncation.
 * Extracted as a pure function for testability.
 * When fuse is provided, uses it for search; otherwise creates a new instance.
 */
export function buildDisplayEntries(
  allFiles: readonly ScannedFile[],
  query: string,
  isLoading: boolean,
  fuse?: Fuse<ScannedFile> | null,
): ScannedFile[] {
  if (isLoading || allFiles.length === 0) return [];

  if (query.trim() === '') {
    return allFiles.slice(0, MAX_DISPLAY) as ScannedFile[];
  }

  const searcher = fuse ?? new Fuse([...allFiles], FUSE_OPTIONS);
  const results = searcher.search(query);
  return results.slice(0, MAX_DISPLAY).map((r) => r.item);
}

interface FindFileScreenProps {
  readonly notesDir: string;
  readonly nav: NavigationStore;
  readonly inputMode: InputModeStore;
}

export function FindFileScreen({
  notesDir,
  nav,
  inputMode,
}: FindFileScreenProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fileState, setFileState] = useState<{
    readonly files: readonly ScannedFile[];
    readonly isLoading: boolean;
  }>({ files: [], isLoading: true });
  const { contentWidth, rows } = useLayoutContext();
  const fuseRef = useRef<Fuse<ScannedFile> | null>(null);

  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  // Set input mode on mount/unmount
  useEffect(() => {
    inputMode.set('text');
    return () => inputMode.set('navigation');
  }, [inputMode]);

  // Scan files on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const files = await scanNoteFiles(notesDir);
        if (!cancelled) {
          fuseRef.current = new Fuse([...files], FUSE_OPTIONS);
          setFileState({ files, isLoading: false });
        }
      } catch {
        if (!cancelled) {
          setFileState({ files: [], isLoading: false });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [notesDir]);

  // Use the shared pure function for display entries
  const displayEntries = buildDisplayEntries(
    fileState.files,
    debouncedQuery,
    fileState.isLoading,
    fuseRef.current,
  );

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    setSelectedIndex(0);
  }, []);

  useInput((_input, key) => {
    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(i + 1, displayEntries.length - 1));
    }
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
    if (key.return && displayEntries.length > 0) {
      const entry = displayEntries[selectedIndex];
      if (entry) {
        nav.push('editor', { filePath: entry.absolutePath });
      }
    }
  });

  // Header: border box (3) + count line (1) = 4 rows; Footer: 1 row
  const maxVisible = rows - 4 - 1;
  const { scrollOffset, visibleCount } = useViewport(displayEntries.length, selectedIndex, maxVisible);
  const visibleEntries = displayEntries.slice(scrollOffset, scrollOffset + visibleCount);

  // Show loading state without border to avoid re-render border corruption.
  // Ink's log-update differential rendering breaks bordered boxes during
  // async state changes. By deferring the border until data is ready,
  // the border is only painted once (no diff update needed).
  if (fileState.isLoading) {
    return (
      <Box flexDirection="column">
        <Text dimColor>  Loading...</Text>
      </Box>
    );
  }

  const fileCount = fileState.files.length === 0
    ? 'No notes found'
    : `${displayEntries.length} files`;

  return (
    <Box flexDirection="column">
      <Box borderStyle="bold" borderColor="#56b6c2" width={contentWidth} flexShrink={0}>
        <Text> Find File {'>'} </Text>
        <TextInput placeholder="search files..." onChange={handleChange} />
      </Box>
      <Text dimColor>  {fileCount}</Text>

      <Box flexDirection="column">
        {visibleEntries.map((file, i) => {
          const isSelected = scrollOffset + i === selectedIndex;
          return (
            <Box key={file.relativePath}>
              <Text>
                {'  '}{formatIndicator(isSelected)}{' '}
                {isSelected
                  ? theme.accentBold(file.relativePath)
                  : file.relativePath}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
