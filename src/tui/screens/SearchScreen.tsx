import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';
import { theme } from '../../theme/colors.js';
import { formatTag, formatDate } from '../../theme/format.js';
import { useDebounce } from '../hooks/use-debounce.js';
import { useLayoutContext } from '../hooks/layout-context.js';
import type { NoteService } from '../../core/note-service.js';
import type { SearchIndex } from '../../storage/search-index.js';
import type { NavigationStore } from '../hooks/use-navigation.js';
import type { InputModeStore } from '../hooks/use-input-mode.js';
import type { SearchHit } from '../../storage/search-index.js';

const DEBOUNCE_MS = 150;

/**
 * Build the hint text shown below the search input.
 */
export function buildSearchHint(
  query: string,
  didSearch: boolean,
  resultCount?: number,
): string {
  if (query.trim().length === 0) return '';
  if (!didSearch) return 'もう少し入力してください';
  return `${resultCount ?? 0} results`;
}

interface SearchScreenProps {
  readonly noteService: NoteService;
  readonly searchIndex: SearchIndex;
  readonly nav: NavigationStore;
  readonly inputMode: InputModeStore;
}

export function SearchScreen({
  noteService,
  searchIndex,
  nav,
  inputMode,
}: SearchScreenProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { contentWidth } = useLayoutContext();

  // 150ms debounce on query
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  // Determine if we should search based on minimum query length
  const shouldSearch = useMemo(
    () => searchIndex.shouldSearch(debouncedQuery),
    [debouncedQuery, searchIndex],
  );

  const results: SearchHit[] = useMemo(
    () => (shouldSearch ? noteService.search(debouncedQuery) : []),
    [shouldSearch, debouncedQuery, noteService],
  );

  const hint = buildSearchHint(debouncedQuery, shouldSearch, results.length);

  // Set input mode to text on mount
  React.useEffect(() => {
    inputMode.set('text');
    return () => inputMode.set('navigation');
  }, [inputMode]);

  useInput((_input, key) => {
    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    }
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
    if (key.return && results.length > 0) {
      const result = results[selectedIndex];
      if (result) {
        nav.push('notePreview', { filePath: result.filePath });
      }
    }
  });

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    setSelectedIndex(0);
  }, []);

  return (
    <Box flexDirection="column">
      <Box borderStyle="bold" borderColor="#56b6c2" width={contentWidth}>
        <Text> 検索 {'>'} </Text>
        <TextInput placeholder="search notes..." onChange={handleChange} />
      </Box>

      {hint.length > 0 && (
        <Text dimColor>  {hint}</Text>
      )}

      <Box flexDirection="column" marginTop={1}>
        {results.map((result, i) => {
          const isSelected = i === selectedIndex;
          return (
            <Box key={result.filePath} flexDirection="column" marginBottom={1}>
              <Text>
                {'  '}{isSelected ? theme.selected('\u25cf') : theme.dim('\u25cb')}{' '}
                {isSelected ? theme.accentBold(result.title) : result.title}
              </Text>
              <Text>
                {'    '}{result.snippet}
              </Text>
              <Text>
                {'    '}
                {result.tags.map((t: string) => formatTag(t)).join('  ')}
                {'  '}{formatDate(result.modified)}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
