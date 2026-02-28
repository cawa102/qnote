import React, { useState, useCallback, useSyncExternalStore } from 'react';
import { Box } from 'ink';
import { createNavigationStore } from './hooks/use-navigation.js';
import { createInputModeStore } from './hooks/use-input-mode.js';
import { useGlobalKeys } from './hooks/use-global-keys.js';
import { Footer } from './components/Footer.js';
import { CenteredLayout } from './components/CenteredLayout.js';
import { LayoutProvider, useLayoutContext } from './hooks/layout-context.js';
import { CommandPalette } from './screens/CommandPalette.js';
import { NoteList } from './screens/NoteList.js';
import { NotePreview } from './screens/NotePreview.js';
import { SearchScreen } from './screens/SearchScreen.js';
import { CaptureScreen } from './screens/CaptureScreen.js';
import { EditorScreen } from './screens/EditorScreen.js';
import type { NoteService } from '../core/note-service.js';
import type { SearchIndex } from '../storage/search-index.js';
import type { Note, NoteListItem } from '../types.js';

interface AppProps {
  readonly noteService: NoteService;
  readonly searchIndex: SearchIndex;
  readonly captureDir: string;
  readonly notesDir: string;
}

const navStore = createNavigationStore();
const inputModeStore = createInputModeStore();

export function App(props: AppProps): React.ReactElement {
  return (
    <LayoutProvider>
      <AppContent {...props} />
    </LayoutProvider>
  );
}

function AppContent({
  noteService,
  searchIndex,
  captureDir,
  notesDir,
}: AppProps): React.ReactElement {
  const { rows } = useLayoutContext();

  const currentEntry = useSyncExternalStore(
    (cb) => navStore.subscribe(cb),
    () => navStore.current(),
  );

  useSyncExternalStore(
    (cb) => inputModeStore.subscribe(cb),
    () => inputModeStore.current(),
  );

  // State for screens that need loaded data
  const [previewNote, setPreviewNote] = useState<Note | null>(null);
  const [noteListItems, setNoteListItems] = useState<readonly NoteListItem[]>([]);
  const [noteListTitle, setNoteListTitle] = useState('Recent');

  // Current note filePath for editor integration
  const currentFilePath =
    currentEntry.screen === 'notePreview'
      ? currentEntry.filePath
      : undefined;

  useGlobalKeys({
    nav: navStore,
    inputMode: inputModeStore,
    currentScreen: currentEntry.screen,
    currentFilePath,
  });

  // Handle command palette action
  const handleAction = useCallback(
    (action: string, query: string) => {
      switch (action) {
        case 'recent': {
          const items = noteService.listRecent(20);
          const listItems: NoteListItem[] = items.map((hit) => ({
            title: hit.title,
            tags: hit.tags,
            modified: hit.modified,
            filePath: hit.filePath,
            backlinkCount: 0,
          }));
          setNoteListItems(listItems);
          setNoteListTitle('Recent');
          navStore.push('noteList');
          break;
        }

        case 'search':
          navStore.push('search');
          break;

        case 'capture':
          navStore.push('capture');
          break;

        case 'new': {
          const title = query.trim() || 'untitled';
          noteService
            .create({
              title,
              tags: [],
              content: `# ${title}\n\n`,
            })
            .then((note) => {
              navStore.push('editor', { filePath: note.filePath });
            });
          break;
        }

        case 'daily': {
          const today = new Date();
          const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          noteService
            .create({
              title: `Daily: ${dateStr}`,
              tags: ['daily'],
              content: `# ${dateStr}\n\n## TODO\n\n- [ ] \n\n## Notes\n\n`,
              directory: 'daily',
            })
            .then((note) => {
              navStore.push('editor', { filePath: note.filePath });
            });
          break;
        }

        case 'tags': {
          const tags = noteService.listTags();
          const items: NoteListItem[] = tags.map((t) => ({
            title: `#${t.tag}`,
            tags: [t.tag],
            modified: '',
            filePath: '',
            backlinkCount: t.count,
          }));
          setNoteListItems(items);
          setNoteListTitle('Tags');
          navStore.push('noteList');
          break;
        }

        default:
          break;
      }
    },
    [noteService],
  );

  // Load note data when navigating to notePreview
  React.useEffect(() => {
    if (currentEntry.screen === 'notePreview') {
      noteService.read(currentEntry.filePath).then((note) => {
        setPreviewNote(note);
      });
    }
  }, [currentEntry, noteService]);

  // Compute backlink count for preview
  const backlinkCount =
    previewNote !== null
      ? noteService.getBacklinks(
          previewNote.filePath.split('/').pop()?.replace('.md', '') ?? '',
        ).length
      : 0;

  return (
    <Box flexDirection="column" width="100%" height={rows}>
      <Box flexDirection="column" flexGrow={1} justifyContent="center">
        <CenteredLayout>
          <Box flexDirection="column">
            {currentEntry.screen === 'palette' && (
              <CommandPalette
                nav={navStore}
                onAction={handleAction}
              />
            )}

            {currentEntry.screen === 'noteList' && (
              <NoteList
                title={noteListTitle}
                items={noteListItems}
                nav={navStore}
              />
            )}

            {currentEntry.screen === 'notePreview' && previewNote !== null && (
              <NotePreview
                note={previewNote}
                backlinkCount={backlinkCount}
                nav={navStore}
                noteService={noteService}
              />
            )}

            {currentEntry.screen === 'search' && (
              <SearchScreen
                noteService={noteService}
                searchIndex={searchIndex}
                nav={navStore}
                inputMode={inputModeStore}
              />
            )}

            {currentEntry.screen === 'capture' && (
              <CaptureScreen
                noteService={noteService}
                nav={navStore}
                inputMode={inputModeStore}
                captureDir={captureDir}
              />
            )}

            {currentEntry.screen === 'editor' && (
              <EditorScreen
                noteService={noteService}
                notesDir={notesDir}
                nav={navStore}
                inputMode={inputModeStore}
                initialFilePath={currentEntry.filePath}
                showFileTree={currentEntry.showFileTree}
              />
            )}
          </Box>
        </CenteredLayout>
      </Box>
      <CenteredLayout>
        <Footer screen={currentEntry.screen} />
      </CenteredLayout>
    </Box>
  );
}
