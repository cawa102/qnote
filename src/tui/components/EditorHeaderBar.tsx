import React from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';
import type { EditorMode, FocusArea } from '../editor/types.js';
import { theme } from '../../theme/colors.js';
import { formatDottedRuler } from '../../theme/format.js';
import { handleTagKey, deleteTag } from './tag-navigation.js';

export type SaveStatus = 'unsaved' | 'saved' | 'saving' | 'error';

interface EditorHeaderBarProps {
  readonly title: string;
  readonly tags: readonly string[];
  readonly status: SaveStatus;
  readonly mode: EditorMode;
  readonly width: number;
  readonly focused: FocusArea;
  readonly onTitleChange: (title: string) => void;
  readonly onTagsChange: (tags: readonly string[]) => void;
  readonly onFocusEditor: () => void;
}

function StatusIndicator({ status }: { readonly status: SaveStatus }): React.ReactElement {
  const labels: Record<SaveStatus, string> = {
    unsaved: 'unsaved',
    saved: 'saved',
    saving: 'saving',
    error: 'error',
  };

  const colorFn = status === 'unsaved' ? theme.warning
    : status === 'error' ? theme.error
    : theme.dim;

  return <Text>{colorFn(`[${labels[status]}]`)}</Text>;
}

function ModeIndicator({ mode }: { readonly mode: EditorMode }): React.ReactElement {
  const label = mode === 'edit' ? 'Edit' : 'Preview';
  return <Text>{theme.accent(`[${label}]`)}</Text>;
}

function TagChips({ tags, selectedIndex }: {
  readonly tags: readonly string[];
  readonly selectedIndex?: number;
}): React.ReactElement {
  // Always return <Box> root to keep DOM shape stable (prevents Ink diff corruption).
  if (tags.length === 0) {
    return <Box gap={1}><Text> </Text></Box>;
  }

  return (
    <Box gap={1}>
      {tags.map((tag, i) => (
        <Text key={`${i}-${tag}`}>
          {i === selectedIndex ? theme.selected(`#${tag}`) : theme.tag(`#${tag}`)}
        </Text>
      ))}
    </Box>
  );
}

/**
 * Tag input slot with stable DOM shape: always renders <Box><Text/><Text/></Box>
 * regardless of active/inactive state. This prevents Ink's diff algorithm from
 * corrupting the output when the focus transitions between editor and headerTags.
 */
function TagInputSlot({ active, text }: {
  readonly active: boolean;
  readonly text: string;
}): React.ReactElement {
  if (!active) {
    return (
      <Box>
        <Text> </Text>
        <Text> </Text>
      </Box>
    );
  }
  if (text.length > 0) {
    return (
      <Box>
        <Text>{text}</Text>
        <Text inverse> </Text>
      </Box>
    );
  }
  return (
    <Box>
      <Text inverse>a</Text>
      <Text dimColor>dd tag...</Text>
    </Box>
  );
}

export function EditorHeaderBar({
  title,
  tags,
  status,
  mode,
  width,
  focused,
  onTitleChange,
  onTagsChange,
  onFocusEditor,
}: EditorHeaderBarProps): React.ReactElement {
  const [tagInput, setTagInput] = React.useState('');
  const [titleInputKey, setTitleInputKey] = React.useState(0);
  const [tagCursor, setTagCursor] = React.useState(tags.length);
  const localTagChangeRef = React.useRef(false);

  // Track Ctrl+key presses to suppress character leakage from @inkjs/ui TextInput.
  // Only needed for the title input (tags use a custom handler that filters Ctrl).
  const ctrlKeyRef = React.useRef(false);

  useInput((_input, key) => {
    if (key.ctrl) {
      ctrlKeyRef.current = true;
    }
  }, { isActive: focused === 'headerTitle' });

  // Reset cursor to input position when focus changes or tags change externally.
  // Skip reset when tags changed due to local deletion (localTagChangeRef).
  React.useEffect(() => {
    if (localTagChangeRef.current) {
      localTagChangeRef.current = false;
      return;
    }
    setTagCursor(tags.length);
  }, [focused, tags.length]);

  // Clear tag input when focus enters headerTags
  React.useEffect(() => {
    if (focused === 'headerTags') {
      setTagInput('');
    }
  }, [focused]);

  const tagSelected = focused === 'headerTags' && tagCursor < tags.length;

  const handleTitleSubmit = React.useCallback(() => {
    onFocusEditor();
  }, [onFocusEditor]);

  // Discard Ctrl+key character leakage from title TextInput.
  const handleTitleInputChange = React.useCallback((value: string) => {
    if (ctrlKeyRef.current) {
      ctrlKeyRef.current = false;
      setTitleInputKey((k) => k + 1);
      return;
    }
    onTitleChange(value);
  }, [onTitleChange]);

  // Handle keys when a tag chip is selected (arrow/backspace navigation)
  useInput((_input, key) => {
    const keyName = key.leftArrow ? 'left'
      : key.rightArrow ? 'right'
      : (key.backspace || key.delete) ? 'backspace'
      : undefined;
    if (!keyName) return;

    const action = handleTagKey(keyName, tags.length, tagCursor, true);
    switch (action.type) {
      case 'select':
        setTagCursor(action.index);
        break;
      case 'delete': {
        const result = deleteTag(tags, action.index);
        localTagChangeRef.current = true;
        onTagsChange(result.tags);
        setTagCursor(result.cursor);
        break;
      }
      case 'noop':
        break;
    }
  }, { isActive: tagSelected });

  // Custom tag input handler — replaces @inkjs/ui TextInput for tags.
  // This avoids character leakage from Ctrl+key combos (we filter them explicitly)
  // and eliminates the mount/unmount cycle that caused rendering issues.
  useInput((input, key) => {
    if (key.return) {
      const trimmed = tagInput.trim();
      if (trimmed.length > 0 && !tags.includes(trimmed)) {
        onTagsChange([...tags, trimmed]);
      }
      setTagInput('');
      return;
    }

    if (key.backspace || key.delete) {
      if (tagInput.length === 0) {
        // Transition to tag selection when empty
        const action = handleTagKey('backspace', tags.length, tagCursor, true);
        if (action.type === 'select') {
          setTagCursor(action.index);
        }
      } else {
        setTagInput((prev) => prev.slice(0, -1));
      }
      return;
    }

    if (key.leftArrow) {
      if (tagInput.length === 0) {
        const action = handleTagKey('left', tags.length, tagCursor, true);
        if (action.type === 'select') {
          setTagCursor(action.index);
        }
      }
      return;
    }

    // Ignore all control/modifier keys and non-printable input
    if (key.ctrl || key.meta || key.escape || key.tab ||
        key.upArrow || key.downArrow || key.rightArrow) {
      return;
    }

    // Insert printable character
    if (input.length >= 1) {
      setTagInput((prev) => prev + input);
    }
  }, { isActive: focused === 'headerTags' && tagCursor === tags.length });

  const showTagInput = focused === 'headerTags' && !tagSelected;

  return (
    <Box flexDirection="column" width={width}>
      {/* Line 1: Title */}
      <Box justifyContent="space-between">
        <Box>
          <Text dimColor>Title: </Text>
          {focused === 'headerTitle' ? (
            <TextInput
              key={titleInputKey}
              defaultValue={title}
              onChange={handleTitleInputChange}
              onSubmit={handleTitleSubmit}
            />
          ) : (
            <Text bold>{title}</Text>
          )}
        </Box>
        <Box gap={1}>
          <StatusIndicator status={status} />
          <ModeIndicator mode={mode} />
        </Box>
      </Box>

      {/* Line 2: Tags — fixed layout slot for tag input (prevents Ink diff issues on focus change) */}
      <Box>
        <Text dimColor>Tags:  </Text>
        <TagChips
          tags={tags}
          selectedIndex={tagSelected ? tagCursor : undefined}
        />
        <Box marginLeft={1}>
          <TagInputSlot active={showTagInput} text={tagInput} />
        </Box>
      </Box>

      {/* Line 3: Separator */}
      <Text>{formatDottedRuler(width)}</Text>
    </Box>
  );
}
