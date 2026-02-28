import React from 'react';
import { Box, Text } from 'ink';
import { TITLE_ART, TITLE_SUBTITLE, TITLE_WIDTH, colorizeTitle } from '../assets/title-art.js';
import { theme } from '../../theme/colors.js';

interface TitleBannerProps {
  readonly contentWidth: number;
  readonly showTitleArt: boolean;
}

function PlainTitle(): React.ReactElement {
  return (
    <Box>
      <Text>{theme.bold('Queen Note')}</Text>
    </Box>
  );
}

function ArtTitle(): React.ReactElement {
  const colored = colorizeTitle(TITLE_ART, TITLE_SUBTITLE);
  return (
    <Box flexDirection="column">
      <Text>{colored}</Text>
    </Box>
  );
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
}

export class TitleBannerErrorBoundary extends React.Component<
  { readonly children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { readonly children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return <PlainTitle />;
    }
    return this.props.children;
  }
}

export function TitleBanner({ contentWidth, showTitleArt }: TitleBannerProps): React.ReactElement {
  const canShowArt = showTitleArt && contentWidth >= TITLE_WIDTH;

  return (
    <TitleBannerErrorBoundary>
      {canShowArt ? <ArtTitle /> : <PlainTitle />}
    </TitleBannerErrorBoundary>
  );
}
