import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';
import { theme } from '../../theme/colors.js';
import { formatRuler } from '../../theme/format.js';
import type { NoteService } from '../../core/note-service.js';
import type { NavigationStore } from '../hooks/use-navigation.js';
import type { InputModeStore } from '../hooks/use-input-mode.js';

const MAX_SLUG_LENGTH = 200;

/**
 * Build a CJK-aware slug from a title. Falls back to timestamp if empty.
 */
export function buildCaptureSlug(title: string): string {
  const slug = title
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/[\s]+/g, '-')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (slug.length === 0) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `capture-${year}-${month}-${day}-${hours}${minutes}${seconds}`;
  }

  return slug.slice(0, MAX_SLUG_LENGTH);
}

interface CaptureScreenProps {
  readonly noteService: NoteService;
  readonly nav: NavigationStore;
  readonly inputMode: InputModeStore;
  readonly captureDir: string;
  readonly onSpawnEditor: (filePath: string) => void;
}

export function CaptureScreen({
  noteService,
  nav,
  inputMode,
  captureDir,
  onSpawnEditor,
}: CaptureScreenProps): React.ReactElement {
  const [title, setTitle] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set input mode to text on mount
  React.useEffect(() => {
    inputMode.set('text');
    return () => inputMode.set('navigation');
  }, [inputMode]);

  useInput((_input, key) => {
    if (saved) return;

    // Enter: Create note with title-only frontmatter, empty body
    if (key.return) {
      const noteTitle = title.trim() || buildCaptureSlug('');
      noteService
        .create({
          title: noteTitle,
          tags: ['inbox'],
          content: '',
          directory: captureDir,
        })
        .then(() => {
          setSaved(true);
          setTimeout(() => nav.pop(), 600);
        })
        .catch((err: Error) => {
          setError(err.message);
        });
      return;
    }

    // Tab: Create note, then spawn $EDITOR
    if (key.tab) {
      const noteTitle = title.trim() || buildCaptureSlug('');
      noteService
        .create({
          title: noteTitle,
          tags: ['inbox'],
          content: `# ${noteTitle}\n\n`,
          directory: captureDir,
        })
        .then((note) => {
          onSpawnEditor(note.filePath);
        })
        .catch((err: Error) => {
          setError(err.message);
        });
    }
  });

  if (saved) {
    return (
      <Box padding={1}>
        <Text color="green">保存しました → {captureDir}/</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text>  {theme.bold('Quick Capture')} {formatRuler(20)}</Text>
      <Box marginTop={1}>
        <Text>  Title: </Text>
        <TextInput
          placeholder="タイトルを入力..."
          onChange={(value) => setTitle(value)}
        />
      </Box>

      {error !== null && (
        <Box marginTop={1} paddingLeft={2}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      <Box marginTop={2}>
        <Text dimColor>  Enter: 保存  Tab: $EDITORで編集  Esc: 戻る</Text>
      </Box>
    </Box>
  );
}
