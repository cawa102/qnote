import React from 'react';
import { Box } from 'ink';
import { useLayoutContext } from '../hooks/layout-context.js';

interface CenteredLayoutProps {
  readonly children: React.ReactNode;
}

export function CenteredLayout({ children }: CenteredLayoutProps): React.ReactElement {
  const { columns, contentWidth, isTTY } = useLayoutContext();

  if (!isTTY) {
    return (
      <Box width={contentWidth}>
        {children}
      </Box>
    );
  }

  const paddingLeft = Math.floor((columns - contentWidth) / 2);

  return (
    <Box paddingLeft={paddingLeft}>
      <Box width={contentWidth}>
        {children}
      </Box>
    </Box>
  );
}
