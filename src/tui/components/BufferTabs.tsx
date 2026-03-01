import React from 'react';
import { Box, Text } from 'ink';
import type { BufferInfo } from '../editor/types.js';
import { theme } from '../../theme/colors.js';

interface BufferTabsProps {
  readonly buffers: readonly BufferInfo[];
  readonly activeId: string;
  readonly width: number;
}

function renderTabLabel(buffer: BufferInfo): string {
  return buffer.dirty ? `${buffer.title} *` : buffer.title;
}

interface TabInfo {
  readonly buffer: BufferInfo;
  readonly label: string;
  readonly isActive: boolean;
  readonly displayWidth: number;
}

/**
 * Compute a visible window of tabs centered around the active tab.
 * Returns the indices of tabs to display and whether ellipses are needed.
 */
export function computeVisibleTabs(
  tabs: readonly TabInfo[],
  availableWidth: number,
): { readonly start: number; readonly end: number; readonly showLeftEllipsis: boolean; readonly showRightEllipsis: boolean } {
  if (tabs.length === 0) {
    return { start: 0, end: 0, showLeftEllipsis: false, showRightEllipsis: false };
  }

  const activeIndex = tabs.findIndex((t) => t.isActive);
  const ellipsisWidth = 5; // " ... "

  // Try showing all tabs first
  const totalWidth = tabs.reduce((sum, tab) => sum + tab.displayWidth + 1, 0);
  if (totalWidth <= availableWidth) {
    return { start: 0, end: tabs.length, showLeftEllipsis: false, showRightEllipsis: false };
  }

  // Active tab must always be visible — start with it
  let start = activeIndex;
  let end = activeIndex + 1;
  let usedWidth = tabs[activeIndex]!.displayWidth + 1;

  // Expand window outward, alternating right and left
  let expandRight = true;
  while (true) {
    const nextRight = expandRight ? end : end;
    const nextLeft = expandRight ? start : start - 1;

    if (expandRight && end < tabs.length) {
      const rightEllipsis = start > 0 ? ellipsisWidth : 0;
      const newRightEllipsis = end + 1 < tabs.length ? ellipsisWidth : 0;
      const candidateWidth = usedWidth + tabs[end]!.displayWidth + 1 + rightEllipsis + newRightEllipsis;
      if (candidateWidth <= availableWidth) {
        usedWidth += tabs[end]!.displayWidth + 1;
        end++;
        expandRight = false;
        continue;
      }
    }

    if (!expandRight && start > 0) {
      const leftEllipsis = start - 1 > 0 ? ellipsisWidth : 0;
      const rightEllipsis = end < tabs.length ? ellipsisWidth : 0;
      const candidateWidth = usedWidth + tabs[start - 1]!.displayWidth + 1 + leftEllipsis + rightEllipsis;
      if (candidateWidth <= availableWidth) {
        usedWidth += tabs[start - 1]!.displayWidth + 1;
        start--;
        expandRight = true;
        continue;
      }
    }

    // Try the other direction if current failed
    if (expandRight && start > 0) {
      const leftEllipsis = start - 1 > 0 ? ellipsisWidth : 0;
      const rightEllipsis = end < tabs.length ? ellipsisWidth : 0;
      const candidateWidth = usedWidth + tabs[start - 1]!.displayWidth + 1 + leftEllipsis + rightEllipsis;
      if (candidateWidth <= availableWidth) {
        usedWidth += tabs[start - 1]!.displayWidth + 1;
        start--;
        expandRight = true;
        continue;
      }
    }

    if (!expandRight && end < tabs.length) {
      const rightEllipsis = end + 1 < tabs.length ? ellipsisWidth : 0;
      const leftEllipsis = start > 0 ? ellipsisWidth : 0;
      const candidateWidth = usedWidth + tabs[end]!.displayWidth + 1 + leftEllipsis + rightEllipsis;
      if (candidateWidth <= availableWidth) {
        usedWidth += tabs[end]!.displayWidth + 1;
        end++;
        expandRight = false;
        continue;
      }
    }

    break;
  }

  return {
    start,
    end,
    showLeftEllipsis: start > 0,
    showRightEllipsis: end < tabs.length,
  };
}

export function BufferTabs({
  buffers,
  activeId,
  width,
}: BufferTabsProps): React.ReactElement {
  if (buffers.length === 0) {
    return (
      <Box width={width}>
        <Text dimColor>[+]</Text>
      </Box>
    );
  }

  // Calculate available width for tabs (reserve space for [+] button)
  const plusButtonWidth = 4; // " [+]"
  const availableWidth = width - plusButtonWidth;

  // Build tab labels
  const tabs: readonly TabInfo[] = buffers.map((buffer) => {
    const label = renderTabLabel(buffer);
    const isActive = buffer.id === activeId;
    return { buffer, label, isActive, displayWidth: label.length + 2 };
  });

  const { start, end, showLeftEllipsis, showRightEllipsis } = computeVisibleTabs(tabs, availableWidth);
  const visibleTabs = tabs.slice(start, end);

  return (
    <Box width={width}>
      {showLeftEllipsis && <Text dimColor>{' ... '}</Text>}
      {visibleTabs.map((tab, index) => {
        const style = tab.isActive ? theme.tabActive : theme.tabInactive;
        const isLast = index === visibleTabs.length - 1;
        return (
          <Text key={tab.buffer.id}>
            {style(` ${tab.label} `)}
            {!isLast ? theme.dim('│') : ''}
          </Text>
        );
      })}
      {showRightEllipsis && <Text dimColor>{' ... '}</Text>}
      <Text dimColor> [+]</Text>
    </Box>
  );
}
