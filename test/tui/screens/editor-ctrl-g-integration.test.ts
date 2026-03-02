/**
 * Integration test: simulate Ctrl+G keypress in a simplified EditorScreen context.
 * Tests the full flow: useInput handler → focus change → EditorHeaderBar render.
 * Uses React.createElement instead of JSX to work with .test.ts.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { Box, Text, useInput } from 'ink';
import { EditorHeaderBar } from '../../../src/tui/components/EditorHeaderBar.js';
import { getNextHeaderFocus } from '../../../src/tui/screens/EditorScreen.js';
import type { SaveStatus } from '../../../src/tui/components/EditorHeaderBar.js';
import type { FocusArea } from '../../../src/tui/editor/types.js';

/**
 * Simplified EditorScreen for testing Ctrl+G flow.
 * Includes the actual useInput handler, focus management, and EditorHeaderBar.
 */
function TestEditorScreen({ width }: { width?: number }) {
  const w = width ?? 60;
  const [focus, setFocus] = React.useState<FocusArea>('editor');
  const [title] = React.useState('Test Note');
  const [tags, setTags] = React.useState<readonly string[]>([]);
  const suppressHeaderChangeRef = React.useRef(false);

  useInput((input, key) => {
    if (key.ctrl) {
      if (input === 's') return;
      if (input === 'p') return;
      if (focus !== 'fileTree') {
        const nextFocus = getNextHeaderFocus(focus, input);
        if (nextFocus) {
          suppressHeaderChangeRef.current = true;
          setTimeout(() => { suppressHeaderChangeRef.current = false; }, 0);
          setFocus(nextFocus);
          return;
        }
      }
    }

    if (key.escape) {
      if (focus !== 'editor') {
        setFocus('editor');
        return;
      }
    }
  });

  return React.createElement(Box, { flexDirection: 'column', width: w },
    // Header bar
    React.createElement(EditorHeaderBar, {
      title,
      tags: [...tags],
      status: 'saved' as SaveStatus,
      mode: 'edit',
      width: w,
      focused: focus,
      onTitleChange: (value: string) => {
        if (!suppressHeaderChangeRef.current) {
          // Would update title state
        }
      },
      onTagsChange: (newTags: readonly string[]) => {
        if (!suppressHeaderChangeRef.current) setTags(newTags);
      },
      onFocusEditor: () => setFocus('editor'),
    }),
    // Simulated editor content
    React.createElement(Box, { flexGrow: 1 },
      React.createElement(Text, null, '# Test Note\n\nSome content here.'),
    ),
    // Focus indicator (like footer)
    React.createElement(Text, { dimColor: true }, 'focus: ' + focus),
  );
}

describe('Ctrl+G integration test', () => {
  afterEach(() => {
    cleanup();
  });

  it('initial state shows editor focus with content', () => {
    const { lastFrame } = render(React.createElement(TestEditorScreen, {}));
    const frame = lastFrame();

    console.error('=== INITIAL STATE ===');
    console.error(frame);

    expect(frame).toContain('Title:');
    expect(frame).toContain('Test Note');
    expect(frame).toContain('Tags:');
    expect(frame).toContain('# Test Note');
    expect(frame).toContain('Some content here.');
    expect(frame).toContain('focus: editor');
  });

  it('Ctrl+G (BEL \\x07) changes focus to headerTags', async () => {
    const { lastFrame, stdin } = render(React.createElement(TestEditorScreen, {}));

    console.error('=== BEFORE Ctrl+G ===');
    console.error(lastFrame());

    // Simulate Ctrl+G by writing BEL character
    stdin.write('\x07');
    await new Promise((r) => setTimeout(r, 100));

    const frame = lastFrame();
    console.error('=== AFTER Ctrl+G ===');
    console.error(frame);

    // Focus should have changed to headerTags
    expect(frame).toContain('focus: headerTags');
    // Editor content should still be visible
    expect(frame).toContain('# Test Note');
    expect(frame).toContain('Some content here.');
    // Tag input should appear
    expect(frame).toContain('add tag');
  });

  it('can type in tag input after Ctrl+G', async () => {
    const { lastFrame, stdin } = render(React.createElement(TestEditorScreen, {}));

    // Ctrl+G
    stdin.write('\x07');
    await new Promise((r) => setTimeout(r, 100));

    console.error('=== AFTER Ctrl+G ===');
    console.error(lastFrame());

    // Type 'hello'
    stdin.write('h');
    await new Promise((r) => setTimeout(r, 50));
    stdin.write('e');
    await new Promise((r) => setTimeout(r, 50));
    stdin.write('l');
    await new Promise((r) => setTimeout(r, 50));
    stdin.write('l');
    await new Promise((r) => setTimeout(r, 50));
    stdin.write('o');
    await new Promise((r) => setTimeout(r, 50));

    const frame = lastFrame();
    console.error('=== AFTER TYPING "hello" ===');
    console.error(frame);

    // The typed text should appear in the tag input area
    expect(frame).toContain('hello');
    // Editor content should still be visible
    expect(frame).toContain('# Test Note');
    expect(frame).toContain('Some content here.');
  });

  it('Escape returns focus to editor after Ctrl+G', async () => {
    const { lastFrame, stdin } = render(React.createElement(TestEditorScreen, {}));

    // Ctrl+G
    stdin.write('\x07');
    await new Promise((r) => setTimeout(r, 100));

    expect(lastFrame()).toContain('focus: headerTags');

    // Escape
    stdin.write('\x1b');
    await new Promise((r) => setTimeout(r, 100));

    const frame = lastFrame();
    console.error('=== AFTER Escape ===');
    console.error(frame);

    expect(frame).toContain('focus: editor');
    expect(frame).toContain('# Test Note');
    expect(frame).toContain('Some content here.');
  });

  it('submit tag with Enter after Ctrl+G', async () => {
    const { lastFrame, stdin } = render(React.createElement(TestEditorScreen, {}));

    // Ctrl+G
    stdin.write('\x07');
    await new Promise((r) => setTimeout(r, 100));

    // Type 'newtag'
    for (const ch of 'newtag') {
      stdin.write(ch);
      await new Promise((r) => setTimeout(r, 30));
    }

    console.error('=== AFTER TYPING "newtag" ===');
    console.error(lastFrame());

    // Submit with Enter
    stdin.write('\r');
    await new Promise((r) => setTimeout(r, 100));

    const frame = lastFrame();
    console.error('=== AFTER Enter (submit tag) ===');
    console.error(frame);

    // Tag should be added
    expect(frame).toContain('#newtag');
  });
});
