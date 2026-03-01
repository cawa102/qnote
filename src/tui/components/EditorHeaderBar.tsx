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
  if (tags.length === 0) {
    return <Text> </Text>;
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
  const [tagInputKey, setTagInputKey] = React.useState(0);
  const [tagCursor, setTagCursor] = React.useState(tags.length);
  const localTagChangeRef = React.useRef(false);

  // Reset cursor to input position when focus changes or tags change externally.
  // Skip reset when tags changed due to local deletion (localTagChangeRef).
  React.useEffect(() => {
    if (localTagChangeRef.current) {
      localTagChangeRef.current = false;
      return;
    }
    setTagCursor(tags.length);
  }, [focused, tags.length]);

  const tagSelected = focused === 'headerTags' && tagCursor < tags.length;

  const handleTagSubmit = React.useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed.length > 0 && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
    }
    // Force TextInput remount to clear its internal uncontrolled state
    setTagInput('');
    setTagInputKey((k) => k + 1);
  }, [tags, onTagsChange]);

  const handleTitleSubmit = React.useCallback(() => {
    onFocusEditor();
  }, [onFocusEditor]);

  // Handle keys when a tag is selected (TextInput is disabled)
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

  // Handle backspace/left on empty input to transition into tag selection
  useInput((_input, key) => {
    const keyName = key.leftArrow ? 'left'
      : (key.backspace || key.delete) ? 'backspace'
      : undefined;
    if (!keyName) return;

    const action = handleTagKey(keyName, tags.length, tagCursor, tagInput.length === 0);
    if (action.type === 'select') {
      setTagCursor(action.index);
    }
  }, { isActive: focused === 'headerTags' && tagCursor === tags.length });

  return (
    <Box flexDirection="column" width={width}>
      {/* Line 1: Title */}
      <Box justifyContent="space-between">
        <Box>
          <Text dimColor>Title: </Text>
          {focused === 'headerTitle' ? (
            <TextInput
              defaultValue={title}
              onChange={onTitleChange}
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

      {/* Line 2: Tags */}
      <Box>
        <Text dimColor>Tags:  </Text>
        <TagChips
          tags={tags}
          selectedIndex={tagSelected ? tagCursor : undefined}
        />
        {focused === 'headerTags' && (
          <Box marginLeft={1}>
            <TextInput
              key={tagInputKey}
              defaultValue={tagInput}
              onChange={setTagInput}
              onSubmit={handleTagSubmit}
              placeholder="add tag..."
              isDisabled={tagSelected}
            />
          </Box>
        )}
      </Box>

      {/* Line 3: Separator */}
      <Text>{formatDottedRuler(width)}</Text>
    </Box>
  );
}
