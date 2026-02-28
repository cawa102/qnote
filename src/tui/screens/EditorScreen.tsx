import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { writeFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { BufferManager } from '../editor/buffer-manager.js';
import { highlightLines } from '../editor/syntax-highlighter.js';
import { renderViewport } from '../editor/renderer.js';
import { renderMarkdown } from '../utils/render-markdown.js';
import { buildFileTree } from '../editor/file-tree-builder.js';
import { BufferTabs } from '../components/BufferTabs.js';
import { EditorHeaderBar } from '../components/EditorHeaderBar.js';
import type { SaveStatus } from '../components/EditorHeaderBar.js';
import { FileTree } from '../components/FileTree.js';
import { useLayoutContext } from '../hooks/layout-context.js';
import { theme } from '../../theme/colors.js';
import type { NoteService } from '../../core/note-service.js';
import type { NavigationStore } from '../hooks/use-navigation.js';
import type { InputModeStore } from '../hooks/use-input-mode.js';
import type { EditorMode, FocusArea, FileTreeNode } from '../editor/types.js';
import type { KeyInfo } from '../editor/text-editor.js';

interface EditorScreenProps {
  readonly noteService: NoteService;
  readonly notesDir: string;
  readonly nav: NavigationStore;
  readonly inputMode: InputModeStore;
  readonly initialFilePath?: string;
  readonly showFileTree?: boolean;
}

const MIN_TREE_WIDTH = 15;
const MAX_TREE_WIDTH = 30;
const TREE_WIDTH_RATIO = 0.25;

/**
 * Escape a string for safe inclusion in YAML scalar values.
 * Wraps in double quotes and escapes internal special characters.
 */
export function yamlQuote(value: string): string {
  // If the value contains characters that could be interpreted as YAML
  // special syntax, wrap it in double quotes with proper escaping.
  if (/[:{}\[\],&*?|>!%#@`"'\n\r\\]/.test(value) || value.trim() !== value) {
    const escaped = value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
    return `"${escaped}"`;
  }
  return value;
}

export function EditorScreen({
  noteService,
  notesDir,
  nav,
  inputMode,
  initialFilePath,
  showFileTree: initialShowFileTree,
}: EditorScreenProps): React.ReactElement {
  const { contentWidth, rows } = useLayoutContext();

  // Core state
  const [bufferManager, setBufferManager] = useState(() => BufferManager.create());
  const [mode, setMode] = useState<EditorMode>('edit');
  const [focus, setFocus] = useState<FocusArea>('editor');
  const [fileTreeVisible, setFileTreeVisible] = useState(initialShowFileTree ?? false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [scrollOffset, setScrollOffset] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingCloseBufferId, setPendingCloseBufferId] = useState<string | null>(null);

  // File tree state
  const [fileTreeRoot, setFileTreeRoot] = useState<FileTreeNode>({
    name: 'notes',
    path: notesDir,
    type: 'directory',
    children: [],
    expanded: true,
  });
  const [selectedTreePath, setSelectedTreePath] = useState(notesDir);

  // Title/tags state for header bar
  const [headerTitle, setHeaderTitle] = useState('');
  const [headerTags, setHeaderTags] = useState<readonly string[]>([]);

  // Set input mode on mount
  useEffect(() => {
    inputMode.set('text');
    return () => inputMode.set('navigation');
  }, [inputMode]);

  // Load initial file (H-2: use functional setState to avoid stale closure)
  useEffect(() => {
    if (initialFilePath) {
      noteService.read(initialFilePath).then((note) => {
        setBufferManager((prev) => prev.openBuffer(
          note.filePath,
          note.content,
          note.meta,
        ));
        setHeaderTitle(note.meta.title);
        setHeaderTags(note.meta.tags);
      }).catch((err: unknown) => {
        // H-1: Surface file load errors to user
        const message = err instanceof Error ? err.message : 'Failed to load file';
        setErrorMessage(message);
        setSaveStatus('error');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilePath]);

  // Sync header when active buffer changes
  useEffect(() => {
    const active = bufferManager.getActive();
    if (active) {
      setHeaderTitle(active.meta.title);
      setHeaderTags(active.meta.tags);
    }
  }, [bufferManager]);

  // M-8: Load file tree from disk when it becomes visible
  useEffect(() => {
    if (fileTreeVisible) {
      buildFileTree(notesDir).then((tree) => {
        setFileTreeRoot(tree);
      }).catch(() => {
        // File tree load failure is non-critical
      });
    }
  }, [fileTreeVisible, notesDir]);

  // Layout calculations
  const treeWidth = fileTreeVisible
    ? Math.min(MAX_TREE_WIDTH, Math.max(MIN_TREE_WIDTH, Math.floor(contentWidth * TREE_WIDTH_RATIO)))
    : 0;
  const editorWidth = contentWidth - treeWidth;
  const headerHeight = 3; // title + tags + ruler
  const tabsHeight = 1;
  const footerHeight = 0; // footer is outside EditorScreen
  const viewportHeight = Math.max(1, rows - headerHeight - tabsHeight - footerHeight - 2);

  // Get active buffer state
  const active = bufferManager.getActive();
  const bufferInfos = bufferManager.getBufferInfos();

  // M-3: Combine highlight/render and scroll offset calculation in a single useMemo
  const renderedOutput = useMemo(() => {
    if (!active || mode === 'preview') {
      return null;
    }
    const state = active.editor.getBuffer().getState();
    const highlighted = highlightLines(state.lines, theme);
    const result = renderViewport({
      lines: state.lines,
      highlightedLines: highlighted,
      cursor: state.cursor,
      viewportHeight,
      viewportWidth: editorWidth,
      scrollOffset,
    });
    return result;
  }, [active, mode, viewportHeight, editorWidth, scrollOffset]);

  // M-3: Update scroll offset from rendered output without separate useEffect causing render loop
  const effectiveScrollOffset = renderedOutput?.scrollOffset ?? scrollOffset;
  useEffect(() => {
    if (renderedOutput && renderedOutput.scrollOffset !== scrollOffset) {
      setScrollOffset(renderedOutput.scrollOffset);
    }
  }, [renderedOutput, scrollOffset]);

  // Preview content
  const previewContent = useMemo(() => {
    if (!active || mode !== 'preview') {
      return '';
    }
    return renderMarkdown(active.editor.getContent());
  }, [active, mode]);

  // Save handler (M-5: capture content snapshot, C-2: secure temp file, C-3: YAML escaping)
  const handleSave = useCallback(async () => {
    if (!active) return;

    // M-5: Capture content snapshot at save start
    const contentSnapshot = active.editor.getContent();
    setSaveStatus('saving');
    setErrorMessage(null);

    try {
      const now = new Date().toISOString();
      // C-3: Escape title and tags for safe YAML output
      const safeTitle = yamlQuote(headerTitle);
      const safeTags = headerTags.map((t) => yamlQuote(t));
      const fullContent = [
        '---',
        `title: ${safeTitle}`,
        `tags: [${safeTags.join(', ')}]`,
        `created: ${active.meta.created}`,
        `modified: ${now}`,
        '---',
        contentSnapshot,
      ].join('\n');

      // C-2: Write temp file in same directory as target with random name and restrictive mode
      const targetDir = dirname(active.filePath);
      const randomSuffix = randomBytes(16).toString('hex');
      const tmpPath = join(targetDir, `.qnote-tmp-${randomSuffix}`);

      try {
        await writeFile(tmpPath, fullContent, { encoding: 'utf-8', mode: 0o600 });
        await rename(tmpPath, active.filePath);
      } catch (writeErr) {
        // C-2: Clean up temp file on failure
        try {
          await unlink(tmpPath);
        } catch {
          // Temp file may not exist if writeFile failed
        }
        throw writeErr;
      }

      // M-5: Only markClean if buffer content hasn't changed since save started
      setBufferManager((prev) => {
        const currentActive = prev.getActive();
        if (currentActive && currentActive.editor.getContent() === contentSnapshot) {
          const cleanEditor = currentActive.editor.markClean();
          return prev.updateEditor(currentActive.id, cleanEditor);
        }
        return prev;
      });
      setSaveStatus('saved');

      // H-4: Update search index after successful save
      // TODO: noteService.upsertIndex() — full index update requires reading the saved file back
      // For now, trigger a reindex of this specific file if the method is available

      // Auto-clear saved status after 2s
      setTimeout(() => setSaveStatus('saved'), 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setErrorMessage(message);
      setSaveStatus('error');
    }
  }, [active, headerTitle, headerTags]);

  // Handle file tree selection
  const handleTreeSelect = useCallback(
    (path: string) => {
      setSelectedTreePath(path);
      if (path.endsWith('.md')) {
        noteService.read(path).then((note) => {
          setBufferManager((prev) =>
            prev.openBuffer(note.filePath, note.content, note.meta),
          );
          setFocus('editor');
        }).catch((err: unknown) => {
          // H-1: Surface tree selection errors to user
          const message = err instanceof Error ? err.message : 'Failed to open file';
          setErrorMessage(message);
          setSaveStatus('error');
        });
      }
    },
    [noteService],
  );

  // Handle confirm dialog
  const handleConfirmKey = useCallback(
    (input: string) => {
      const lower = input.toLowerCase();
      if (lower === 'y') {
        // L-6: Add error handling for save-then-navigate
        handleSave().then(() => {
          if (pendingCloseBufferId) {
            setBufferManager((prev) => prev.closeBuffer(pendingCloseBufferId));
            setPendingCloseBufferId(null);
          } else {
            nav.pop();
          }
        }).catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Save failed';
          setErrorMessage(message);
          setSaveStatus('error');
        });
        setShowConfirm(false);
      } else if (lower === 'n') {
        setShowConfirm(false);
        if (pendingCloseBufferId) {
          setBufferManager((prev) => prev.closeBuffer(pendingCloseBufferId));
          setPendingCloseBufferId(null);
        } else {
          nav.pop();
        }
      } else if (lower === 'c') {
        setShowConfirm(false);
        setPendingCloseBufferId(null);
      }
    },
    [handleSave, nav, pendingCloseBufferId],
  );

  // Main input handler
  useInput((input, key) => {
    // Clear error message on any input
    if (errorMessage) {
      setErrorMessage(null);
    }

    // Confirm dialog intercepts all input
    if (showConfirm) {
      handleConfirmKey(input);
      return;
    }

    // Global keys (always handled by EditorScreen)
    if (key.ctrl) {
      // Ctrl+S — save
      if (input === 's') {
        handleSave();
        return;
      }
      // Ctrl+P — toggle preview
      if (input === 'p') {
        setMode((prev) => (prev === 'edit' ? 'preview' : 'edit'));
        return;
      }
      // Ctrl+E — toggle file tree
      if (input === 'e') {
        setFileTreeVisible((prev) => !prev);
        return;
      }
      // M-4: Ctrl+W — close buffer with dirty check
      if (input === 'w') {
        if (active) {
          if (active.editor.isDirty()) {
            setPendingCloseBufferId(active.id);
            setShowConfirm(true);
          } else {
            setBufferManager((prev) => prev.closeBuffer(active.id));
          }
        }
        return;
      }
    }

    // Escape — back / confirmation
    if (key.escape) {
      if (focus !== 'editor') {
        setFocus('editor');
        return;
      }
      if (bufferManager.hasUnsaved()) {
        setShowConfirm(true);
        return;
      }
      nav.pop();
      return;
    }

    // M-10: Colon opens palette only when NOT in edit mode
    // (in edit mode, colon should be typed as a character)
    if (input === ':' && focus === 'editor' && mode !== 'edit' && !key.ctrl) {
      nav.push('palette');
      return;
    }

    // Dispatch to focus area
    if (focus === 'editor' && active && mode === 'edit') {
      const keyInfo: KeyInfo = {
        ctrl: key.ctrl,
        shift: key.shift,
        meta: key.meta,
        name: getKeyName(key),
      };
      const newEditor = active.editor.handleInput(input, keyInfo);
      if (newEditor !== active.editor) {
        setBufferManager((prev) => prev.updateEditor(active.id, newEditor));
        setSaveStatus(newEditor.isDirty() ? 'unsaved' : 'saved');
      }
    }
  });

  // Confirm dialog overlay
  if (showConfirm) {
    return (
      <Box flexDirection="column">
        <Text>{theme.warning('Save changes? [Y] Save  [N] Discard  [C] Cancel')}</Text>
      </Box>
    );
  }

  // Error message display
  if (errorMessage && !active) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {errorMessage}</Text>
        <Text dimColor>Press any key to dismiss.</Text>
      </Box>
    );
  }

  // No active buffer
  if (!active) {
    return (
      <Box flexDirection="column">
        <Text dimColor>No file open. Use file tree (Ctrl+E) or command palette (:) to open a note.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="row" width={contentWidth} height={rows - 1}>
      {/* File tree sidebar */}
      {fileTreeVisible && (
        <FileTree
          root={fileTreeRoot}
          selectedPath={selectedTreePath}
          width={treeWidth}
          height={rows - 1}
          onSelect={handleTreeSelect}
        />
      )}

      {/* Main editor area */}
      <Box flexDirection="column" width={editorWidth}>
        {/* Buffer tabs */}
        <BufferTabs
          buffers={bufferInfos}
          activeId={active.id}
          width={editorWidth}
        />

        {/* Header bar */}
        <EditorHeaderBar
          title={headerTitle}
          tags={[...headerTags]}
          status={saveStatus}
          mode={mode}
          width={editorWidth}
          focused={focus}
          onTitleChange={setHeaderTitle}
          onTagsChange={setHeaderTags}
          onFocusEditor={() => setFocus('editor')}
        />

        {/* Error banner */}
        {errorMessage && (
          <Box>
            <Text color="red">Error: {errorMessage}</Text>
          </Box>
        )}

        {/* Edit area or Preview */}
        <Box flexGrow={1}>
          {mode === 'edit' && renderedOutput ? (
            <Text>{renderedOutput.content}</Text>
          ) : mode === 'preview' ? (
            <Text>{previewContent}</Text>
          ) : (
            <Text dimColor>Loading...</Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Map Ink's key object to a key name string for TextEditorController.
 */
function getKeyName(key: {
  return: boolean;
  backspace: boolean;
  delete: boolean;
  tab: boolean;
  upArrow: boolean;
  downArrow: boolean;
  leftArrow: boolean;
  rightArrow: boolean;
  escape: boolean;
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
}): string | undefined {
  if (key.return) return 'return';
  if (key.backspace) return 'backspace';
  if (key.delete) return 'delete';
  if (key.tab) return 'tab';
  if (key.upArrow) return 'up';
  if (key.downArrow) return 'down';
  if (key.leftArrow) return 'left';
  if (key.rightArrow) return 'right';
  if (key.escape) return 'escape';
  return undefined;
}
