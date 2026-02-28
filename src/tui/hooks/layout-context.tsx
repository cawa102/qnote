import React, { createContext, useContext } from 'react';
import { useLayout, type LayoutInfo } from './use-layout.js';

const LayoutContext = createContext<LayoutInfo | null>(null);

interface LayoutProviderProps {
  readonly children: React.ReactNode;
  readonly maxWidth?: number;
}

export function LayoutProvider({ children, maxWidth }: LayoutProviderProps): React.ReactElement {
  const layout = useLayout(maxWidth);
  return <LayoutContext.Provider value={layout}>{children}</LayoutContext.Provider>;
}

export function useLayoutContext(): LayoutInfo {
  const ctx = useContext(LayoutContext);
  if (ctx === null) {
    throw new Error('useLayoutContext must be used within a LayoutProvider');
  }
  return ctx;
}

export type { LayoutInfo };
