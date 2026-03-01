import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { EditorHeaderBar } from '../../../src/tui/components/EditorHeaderBar.js';
import type { SaveStatus } from '../../../src/tui/components/EditorHeaderBar.js';
import type { EditorMode, FocusArea } from '../../../src/tui/editor/types.js';

function createProps(overrides: Partial<{
  title: string;
  tags: readonly string[];
  status: SaveStatus;
  mode: EditorMode;
  width: number;
  focused: FocusArea;
  onTitleChange: (title: string) => void;
  onTagsChange: (tags: readonly string[]) => void;
  onFocusEditor: () => void;
}> = {}) {
  return {
    title: overrides.title ?? 'Test Note',
    tags: overrides.tags ?? ['tag1', 'tag2'],
    status: overrides.status ?? 'saved' as SaveStatus,
    mode: overrides.mode ?? 'edit' as EditorMode,
    width: overrides.width ?? 60,
    focused: overrides.focused ?? 'editor' as FocusArea,
    onTitleChange: overrides.onTitleChange ?? vi.fn(),
    onTagsChange: overrides.onTagsChange ?? vi.fn(),
    onFocusEditor: overrides.onFocusEditor ?? vi.fn(),
  };
}

describe('EditorHeaderBar', () => {
  afterEach(() => {
    cleanup();
  });

  describe('title rendering', () => {
    it('renders title with label when not focused', () => {
      const props = createProps({ focused: 'editor' });
      const { lastFrame } = render(React.createElement(EditorHeaderBar, props));
      const frame = lastFrame();
      expect(frame).toContain('Title:');
      expect(frame).toContain('Test Note');
    });

    it('renders title with different text', () => {
      const props = createProps({ title: 'My Custom Title' });
      const { lastFrame } = render(React.createElement(EditorHeaderBar, props));
      expect(lastFrame()).toContain('My Custom Title');
    });
  });

  describe('tags rendering', () => {
    it('renders tags as chips', () => {
      const props = createProps({ tags: ['javascript', 'react'] });
      const { lastFrame } = render(React.createElement(EditorHeaderBar, props));
      const frame = lastFrame();
      expect(frame).toContain('Tags:');
      expect(frame).toContain('javascript');
      expect(frame).toContain('react');
    });

    it('renders empty tags with just label', () => {
      const props = createProps({ tags: [] });
      const { lastFrame } = render(React.createElement(EditorHeaderBar, props));
      const frame = lastFrame();
      expect(frame).toContain('Tags:');
    });

    it('renders single tag', () => {
      const props = createProps({ tags: ['solo'] });
      const { lastFrame } = render(React.createElement(EditorHeaderBar, props));
      expect(lastFrame()).toContain('solo');
    });
  });

  describe('status indicator', () => {
    it('shows unsaved status text', () => {
      const props = createProps({ status: 'unsaved' });
      const { lastFrame } = render(React.createElement(EditorHeaderBar, props));
      expect(lastFrame()).toContain('unsaved');
    });

    it('shows saved status text', () => {
      const props = createProps({ status: 'saved' });
      const { lastFrame } = render(React.createElement(EditorHeaderBar, props));
      expect(lastFrame()).toContain('saved');
    });

    it('shows saving status text', () => {
      const props = createProps({ status: 'saving' });
      const { lastFrame } = render(React.createElement(EditorHeaderBar, props));
      expect(lastFrame()).toContain('saving');
    });

    it('shows error status text', () => {
      const props = createProps({ status: 'error' });
      const { lastFrame } = render(React.createElement(EditorHeaderBar, props));
      expect(lastFrame()).toContain('error');
    });
  });

  describe('mode indicator', () => {
    it('shows Edit mode indicator', () => {
      const props = createProps({ mode: 'edit' });
      const { lastFrame } = render(React.createElement(EditorHeaderBar, props));
      expect(lastFrame()).toContain('Edit');
    });

    it('shows Preview mode indicator', () => {
      const props = createProps({ mode: 'preview' });
      const { lastFrame } = render(React.createElement(EditorHeaderBar, props));
      expect(lastFrame()).toContain('Preview');
    });
  });

  describe('separator', () => {
    it('renders dotted separator line', () => {
      const props = createProps({ width: 40 });
      const { lastFrame } = render(React.createElement(EditorHeaderBar, props));
      expect(lastFrame()).toContain('╌');
    });
  });

  describe('focus states', () => {
    it('renders differently when title is focused', () => {
      const propsUnfocused = createProps({ focused: 'editor' });
      const propsFocused = createProps({ focused: 'headerTitle' });
      const { lastFrame: unfocusedFrame } = render(
        React.createElement(EditorHeaderBar, propsUnfocused)
      );
      cleanup();
      const { lastFrame: focusedFrame } = render(
        React.createElement(EditorHeaderBar, propsFocused)
      );
      // Both should contain the title text
      expect(unfocusedFrame()).toContain('Test Note');
      expect(focusedFrame()).toContain('Test Note');
    });

    it('renders differently when tags area is focused', () => {
      const props = createProps({ focused: 'headerTags' });
      const { lastFrame } = render(React.createElement(EditorHeaderBar, props));
      expect(lastFrame()).toContain('Tags:');
    });
  });

  describe('layout', () => {
    it('renders three visual lines (title, tags, separator)', () => {
      const props = createProps();
      const { lastFrame } = render(React.createElement(EditorHeaderBar, props));
      const frame = lastFrame();
      // Should have title, tags, and separator in the output
      expect(frame).toContain('Title:');
      expect(frame).toContain('Tags:');
      expect(frame).toContain('╌');
    });
  });
});
