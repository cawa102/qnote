import React from 'react';
import { Box, Text } from 'ink';
import { TextInput } from '@inkjs/ui';
import type { EditorMode, FocusArea } from '../editor/types.js';
import { theme } from '../../theme/colors.js';
import { formatRuler } from '../../theme/format.js';

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

function TagChips({ tags }: { readonly tags: readonly string[] }): React.ReactElement {
  if (tags.length === 0) {
    return <Text> </Text>;
  }

  return (
    <Box gap={1}>
      {tags.map((tag) => (
        <Text key={tag}>{theme.tag(`#${tag}`)}</Text>
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

  const handleTagSubmit = React.useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed.length > 0 && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
    }
    setTagInput('');
  }, [tags, onTagsChange]);

  const handleTitleSubmit = React.useCallback(() => {
    onFocusEditor();
  }, [onFocusEditor]);

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
        <TagChips tags={tags} />
        {focused === 'headerTags' && (
          <Box marginLeft={1}>
            <TextInput
              defaultValue={tagInput}
              onChange={setTagInput}
              onSubmit={handleTagSubmit}
              placeholder="add tag..."
            />
          </Box>
        )}
      </Box>

      {/* Line 3: Separator */}
      <Text>{formatRuler(width)}</Text>
    </Box>
  );
}
