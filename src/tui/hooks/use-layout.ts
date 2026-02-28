import { useState, useEffect, useCallback } from 'react';

const DEFAULT_COLUMNS = 80;
const DEFAULT_ROWS = 24;
const PADDING = 8;
const MIN_CONTENT_WIDTH = 20;
const DEFAULT_MAX_WIDTH = 100;
const MIN_COLUMNS_FOR_ART = 60;
const MIN_ROWS_FOR_ART = 20;
const RESIZE_DEBOUNCE_MS = 100;

export interface LayoutInfo {
  readonly columns: number;
  readonly rows: number;
  readonly contentWidth: number;
  readonly isTTY: boolean;
  readonly showTitleArt: boolean;
}

function getTerminalDimensions(): { columns: number; rows: number } {
  return {
    columns: process.stdout.columns ?? DEFAULT_COLUMNS,
    rows: process.stdout.rows ?? DEFAULT_ROWS,
  };
}

function computeLayout(columns: number, rows: number, maxWidth: number): LayoutInfo {
  const isTTY = process.stdout.isTTY ?? false;
  const contentWidth = Math.max(MIN_CONTENT_WIDTH, Math.min(columns - PADDING, maxWidth));
  const showTitleArt = isTTY && columns >= MIN_COLUMNS_FOR_ART && rows >= MIN_ROWS_FOR_ART;

  return {
    columns,
    rows,
    contentWidth,
    isTTY,
    showTitleArt,
  };
}

export function useLayout(maxWidth: number = DEFAULT_MAX_WIDTH): LayoutInfo {
  const [dimensions, setDimensions] = useState(getTerminalDimensions);

  const handleResize = useCallback(() => {
    setDimensions(getTerminalDimensions());
  }, []);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const onResize = (): void => {
      if (timerId !== null) {
        clearTimeout(timerId);
      }
      timerId = setTimeout(() => {
        handleResize();
        timerId = null;
      }, RESIZE_DEBOUNCE_MS);
    };

    process.stdout.on('resize', onResize);

    return () => {
      if (timerId !== null) {
        clearTimeout(timerId);
      }
      process.stdout.removeListener('resize', onResize);
    };
  }, [handleResize]);

  return computeLayout(dimensions.columns, dimensions.rows, maxWidth);
}
