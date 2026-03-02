import { useMemo } from 'react';

export interface ViewportResult {
  readonly scrollOffset: number;
  readonly visibleCount: number;
}

/**
 * Calculates viewport scroll offset and visible item count for list screens.
 * Reusable hook extracting the scroll logic from FileTree.tsx.
 *
 * @param totalItems  - Total number of items in the list
 * @param selectedIndex - Currently selected item index
 * @param maxVisible  - Maximum number of items that fit in the viewport
 */
export function useViewport(
  totalItems: number,
  selectedIndex: number,
  maxVisible: number,
): ViewportResult {
  const clamped = Math.max(0, maxVisible);

  const scrollOffset = useMemo(() => {
    if (clamped <= 0 || selectedIndex < 0) return 0;
    if (selectedIndex < clamped) return 0;
    return selectedIndex - clamped + 1;
  }, [selectedIndex, clamped]);

  const visibleCount = Math.min(clamped, totalItems);

  return { scrollOffset, visibleCount };
}
