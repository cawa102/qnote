import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { TitleBanner, TitleBannerErrorBoundary } from '../../src/tui/components/TitleBanner.js';
import { TITLE_WIDTH } from '../../src/tui/assets/title-art.js';

afterEach(() => {
  cleanup();
});

describe('TitleBanner', () => {
  it('renders block art when showTitleArt=true and contentWidth is sufficient', () => {
    const { lastFrame } = render(
      React.createElement(TitleBanner, {
        contentWidth: TITLE_WIDTH + 10,
        showTitleArt: true,
      }),
    );
    const output = lastFrame();
    // Block art should contain block characters
    expect(output).toMatch(/[█▀▄▌▐]/);
    // Should also contain the subtitle
    expect(output).toContain('N O T E');
  });

  it('renders plain text "Queen Note" when showTitleArt=false', () => {
    const { lastFrame } = render(
      React.createElement(TitleBanner, {
        contentWidth: TITLE_WIDTH + 10,
        showTitleArt: false,
      }),
    );
    const output = lastFrame();
    expect(output).toContain('Queen Note');
    // Should NOT contain block art characters
    expect(output).not.toMatch(/[█▀▄▌▐]/);
  });

  it('renders plain text when contentWidth < TITLE_WIDTH', () => {
    const { lastFrame } = render(
      React.createElement(TitleBanner, {
        contentWidth: TITLE_WIDTH - 1,
        showTitleArt: true,
      }),
    );
    const output = lastFrame();
    expect(output).toContain('Queen Note');
    expect(output).not.toMatch(/[█▀▄▌▐]/);
  });

  it('title text is present in output when showing art', () => {
    const { lastFrame } = render(
      React.createElement(TitleBanner, {
        contentWidth: TITLE_WIDTH + 10,
        showTitleArt: true,
      }),
    );
    const output = lastFrame();
    // At minimum, the subtitle "N O T E" should be present
    expect(output).toContain('N O T E');
  });

  it('title text is present in output when showing plain', () => {
    const { lastFrame } = render(
      React.createElement(TitleBanner, {
        contentWidth: 20,
        showTitleArt: false,
      }),
    );
    const output = lastFrame();
    expect(output).toContain('Queen Note');
  });

  it('error boundary catches rendering errors and falls back to plain text', () => {
    // Suppress console.error from React error boundary
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Create a component that throws during render
    const ThrowingBanner = (): React.ReactElement => {
      throw new Error('render failed');
    };

    const { lastFrame } = render(
      React.createElement(TitleBannerErrorBoundary, null,
        React.createElement(ThrowingBanner),
      ),
    );

    const output = lastFrame();
    expect(output).toContain('Queen Note');

    consoleSpy.mockRestore();
  });
});
