import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';
import { theme } from '../../theme/colors.js';
import { formatRuler } from '../../theme/format.js';
import { useLayoutContext } from '../hooks/layout-context.js';
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

type CapturePhase = 'title' | 'body';

interface CaptureScreenProps {
  readonly noteService: NoteService;
  readonly nav: NavigationStore;
  readonly inputMode: InputModeStore;
  readonly captureDir: string;
}

export function CaptureScreen({
  noteService,
  nav,
  inputMode,
  captureDir,
}: CaptureScreenProps): React.ReactElement {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [phase, setPhase] = useState<CapturePhase>('title');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { contentWidth } = useLayoutContext();

  // Set input mode to text on mount
  React.useEffect(() => {
    inputMode.set('text');
    return () => inputMode.set('navigation');
  }, [inputMode]);

  const saveNote = (content: string, openEditor: boolean): void => {
    const noteTitle = title.trim() || buildCaptureSlug('');
    const finalContent = openEditor ? `# ${noteTitle}\n\n${content}` : content;
    noteService
      .create({
        title: noteTitle,
        tags: ['quick'],
        content: finalContent,
        directory: captureDir,
      })
      .then((note) => {
        if (openEditor) {
          nav.pop();
          nav.push('editor', { filePath: note.filePath });
        } else {
          setSaved(true);
          setTimeout(() => nav.pop(), 600);
        }
      })
      .catch((err: Error) => {
        setError(err.message);
      });
  };

  useInput((_input, key) => {
    if (saved) return;

    if (key.return) {
      if (phase === 'title') {
        setPhase('body');
      } else {
        saveNote(body, false);
      }
      return;
    }

    if (key.tab) {
      const content = phase === 'body' ? body : '';
      saveNote(content, true);
    }
  });

  if (saved) {
    return (
      <Box>
        <Text color="green">Saved → {captureDir}/</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>  {theme.bold('Quick Capture')} {formatRuler(Math.max(0, contentWidth - 16))}</Text>
      <Box marginTop={1}>
        <Text>  Title: </Text>
        {phase === 'title' ? (
          <TextInput
            placeholder="Enter title..."
            onChange={(value) => setTitle(value)}
          />
        ) : (
          <Text>{title || theme.dim('(untitled)')}</Text>
        )}
      </Box>

      {phase === 'body' && (
        <Box marginTop={1}>
          <Text>  Memo:  </Text>
          <TextInput
            placeholder="Enter note... (optional)"
            onChange={(value) => setBody(value)}
          />
        </Box>
      )}

      {error !== null && (
        <Box marginTop={1} paddingLeft={2}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      <Box marginTop={2}>
        <Text dimColor>
          {phase === 'title'
            ? '  Enter: Next  Tab: Open editor  Esc: Back'
            : '  Enter: Save  Tab: Open editor  Esc: Back'}
        </Text>
      </Box>
    </Box>
  );
}
