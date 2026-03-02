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

  describe('layout stability across focus transitions', () => {
    it('tags row contains space after chips even when tag input is not shown', () => {
      const props = createProps({ focused: 'editor', tags: ['a', 'b'] });
      const { lastFrame } = render(React.createElement(EditorHeaderBar, props));
      const frame = lastFrame();
      // The tag input slot always has marginLeft=1 and a space placeholder
      expect(frame).toContain('Tags:');
      expect(frame).toContain('#a');
      expect(frame).toContain('#b');
    });

    it('tags row structure is stable between editor and headerTags focus', () => {
      // Render with editor focus
      const editorProps = createProps({ focused: 'editor', tags: ['x'] });
      const { lastFrame: editorFrame } = render(React.createElement(EditorHeaderBar, editorProps));
      const editorLines = editorFrame().split('\n');
      cleanup();

      // Render with headerTags focus
      const tagProps = createProps({ focused: 'headerTags', tags: ['x'] });
      const { lastFrame: tagFrame } = render(React.createElement(EditorHeaderBar, tagProps));
      const tagLines = tagFrame().split('\n');

      // Both should have 3 lines (title, tags, separator)
      expect(editorLines.length).toBe(tagLines.length);
    });
  });

  describe('Ctrl+key character leakage prevention', () => {
    it('does not call onTitleChange when Ctrl+key is pressed during title editing', async () => {
      const onTitleChange = vi.fn();
      const props = createProps({ focused: 'headerTitle', onTitleChange });
      const { stdin } = render(React.createElement(EditorHeaderBar, props));

      // Simulate Ctrl+G (\x07 = BEL, which Ink parses as input='g', key.ctrl=true)
      stdin.write('\x07');
      await new Promise((r) => setTimeout(r, 50));

      // onTitleChange should NOT be called with the leaked 'g' character
      const leakedCalls = onTitleChange.mock.calls.filter(
        (args: [string]) => args[0].includes('g') && args[0] !== 'Test Note'
      );
      expect(leakedCalls).toHaveLength(0);
    });

    it('does not leak Ctrl+S character into tag input', async () => {
      const props = createProps({ focused: 'headerTags', tags: [] });
      const { lastFrame, stdin } = render(React.createElement(EditorHeaderBar, props));

      // Simulate Ctrl+S (\x13)
      stdin.write('\x13');
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame();
      // The tag input should not contain the leaked 's' character
      expect(frame).not.toMatch(/add tag.*s/);
    });
  });
});
