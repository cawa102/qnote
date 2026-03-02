import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { writeFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { serializeFrontmatter } from '../../storage/frontmatter.js';
import { BufferManager } from '../editor/buffer-manager.js';
import { highlightLines } from '../editor/syntax-highlighter.js';
import { renderViewport } from '../editor/renderer.js';
import { renderMarkdown } from '../utils/render-markdown.js';
import { buildFileTree, flattenTree } from '../editor/file-tree-builder.js';
import { BufferTabs } from '../components/BufferTabs.js';
import { EditorHeaderBar } from '../components/EditorHeaderBar.js';
import type { SaveStatus } from '../components/EditorHeaderBar.js';
import { FileTree } from '../components/FileTree.js';
import { HelpPanel, HELP_PANEL_HEIGHT } from '../components/HelpPanel.js';
import { useLayoutContext } from '../hooks/layout-context.js';
import { theme } from '../../theme/colors.js';
import { formatRuler } from '../../theme/format.js';
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
  readonly cursorAtEnd?: boolean;
}

const MIN_TREE_WIDTH = 15;
const MAX_TREE_WIDTH = 30;
const TREE_WIDTH_RATIO = 0.25;
export const SEPARATOR_WIDTH = 3; // ' │ '

export interface EditorLayout {
  readonly treeWidth: number;
  readonly separatorWidth: number;
  readonly editorWidth: number;
}

export function computeEditorLayout(contentWidth: number, fileTreeVisible: boolean): EditorLayout {
  if (!fileTreeVisible) {
    return { treeWidth: 0, separatorWidth: 0, editorWidth: contentWidth };
  }
  const treeWidth = Math.min(MAX_TREE_WIDTH, Math.max(MIN_TREE_WIDTH, Math.floor(contentWidth * TREE_WIDTH_RATIO)));
  const editorWidth = contentWidth - treeWidth - SEPARATOR_WIDTH;
  return { treeWidth, separatorWidth: SEPARATOR_WIDTH, editorWidth };
}

/**
 * Determine the next Ctrl+E state (3-state cycle):
 * - tree hidden → show tree + focus tree
 * - tree visible & focus elsewhere → focus tree
 * - tree visible & focus on tree → hide tree + focus editor
 */
export function nextCtrlEState(
  fileTreeVisible: boolean,
  currentFocus: FocusArea,
): { readonly fileTreeVisible: boolean; readonly focus: FocusArea } {
  if (!fileTreeVisible) {
    return { fileTreeVisible: true, focus: 'fileTree' };
  }
  if (currentFocus === 'fileTree') {
    return { fileTreeVisible: false, focus: 'editor' };
  }
  return { fileTreeVisible: true, focus: 'fileTree' };
}

export type TreeAction =
  | { readonly type: 'move'; readonly index: number }
  | { readonly type: 'open'; readonly path: string }
  | { readonly type: 'toggle'; readonly path: string }
  | { readonly type: 'noop' };

/**
 * Pure function: given a key name, tree root, and current cursor index,
 * return the action to perform.
 */
export function handleTreeKey(
  keyName: string,
  root: FileTreeNode,
  cursorIndex: number,
): TreeAction {
  const flat = flattenTree(root);
  const maxIndex = flat.length - 1;

  if (keyName === 'j' || keyName === 'down') {
    return { type: 'move', index: Math.min(cursorIndex + 1, maxIndex) };
  }
  if (keyName === 'k' || keyName === 'up') {
    return { type: 'move', index: Math.max(cursorIndex - 1, 0) };
  }

  const entry = flat[cursorIndex];
  if (!entry) return { type: 'noop' };
  const node = entry.node;

  if (keyName === 'return') {
    if (node.type === 'file') {
      return { type: 'open', path: node.path };
    }
    return { type: 'toggle', path: node.path };
  }

  if (keyName === 'l' || keyName === 'right') {
    if (node.type === 'directory' && !node.expanded) {
      return { type: 'toggle', path: node.path };
    }
    return { type: 'noop' };
  }

  if (keyName === 'h' || keyName === 'left') {
    if (node.type === 'directory' && node.expanded) {
      return { type: 'toggle', path: node.path };
    }
    return { type: 'noop' };
  }

  return { type: 'noop' };
}

/**
 * Immutably toggle the expanded state of a directory node in the tree.
 */
export function toggleTreeNode(root: FileTreeNode, targetPath: string): FileTreeNode {
  if (root.path === targetPath && root.type === 'directory') {
    return { ...root, expanded: !root.expanded };
  }
  if (root.type === 'directory' && root.children) {
    const newChildren = root.children.map((child) => toggleTreeNode(child, targetPath));
    if (newChildren.every((c, i) => c === root.children![i])) return root;
    return { ...root, children: newChildren };
  }
  return root;
}

/**
 * Determine the next focus area when a Ctrl key is pressed for header editing.
 * Returns null if the key doesn't correspond to a header focus action.
 */
/**
 * Pure function: determine buffer switch direction from Ctrl+Arrow key press.
 */
export function handleCtrlArrow(key: { rightArrow: boolean; leftArrow: boolean }): 'next' | 'prev' | null {
  if (key.rightArrow) return 'next';
  if (key.leftArrow) return 'prev';
  return null;
}

export function getNextHeaderFocus(current: FocusArea, key: string): FocusArea | null {
  if (current === 'fileTree') return null;
  if (key === 't') return 'headerTitle';
  if (key === 'g') return 'headerTags';
  return null;
}

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
  cursorAtEnd,
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
  const [showHelp, setShowHelp] = useState(false);

  // File tree state
  const [fileTreeRoot, setFileTreeRoot] = useState<FileTreeNode>({
    name: 'notes',
    path: notesDir,
    type: 'directory',
    children: [],
    expanded: true,
  });
  const [selectedTreePath, setSelectedTreePath] = useState(notesDir);
  const [treeCursorIndex, setTreeCursorIndex] = useState(0);

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
          cursorAtEnd,
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

  // Sync header only when active buffer switches (ID changes), not on every edit.
  // bufferManager.updateEditor() creates a new BufferManager on each keystroke
  // but never updates meta — so reading meta here would overwrite user edits.
  const activeBufferId = bufferManager.getActive()?.id ?? null;
  useEffect(() => {
    const current = bufferManager.getActive();
    if (current) {
      setHeaderTitle(current.meta.title);
      setHeaderTags(current.meta.tags);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBufferId]);

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
  const layout = computeEditorLayout(contentWidth, fileTreeVisible);
  const { treeWidth, editorWidth } = layout;
  const headerHeight = 3; // title + tags + ruler
  const tabsHeight = 1;
  const footerHeight = 0; // footer is outside EditorScreen
  const helpHeight = showHelp ? HELP_PANEL_HEIGHT : 0;
  const viewportHeight = Math.max(1, rows - headerHeight - tabsHeight - footerHeight - 2 - helpHeight);

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
      selection: state.selection,
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
      const fullContent = serializeFrontmatter(
        { title: headerTitle, tags: [...headerTags], created: active.meta.created, modified: now },
        contentSnapshot,
      );

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
      try {
        noteService.updateIndex({
          filePath: active.filePath,
          title: headerTitle,
          tags: [...headerTags],
          content: contentSnapshot,
          created: active.meta.created,
          modified: now,
        });
      } catch {
        // File was saved successfully, but index update failed.
        // Show warning and let user recover with `qnote reindex`.
        setSaveStatus('error');
        setErrorMessage('Saved file, but failed to update search index. Run qnote reindex.');
        return;
      }
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
          setFileTreeVisible(false);
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

    // Ctrl+/ — toggle keybinding help panel
    // Ink doesn't set key.ctrl for \x1f (outside \x01-\x1a range), so check input directly
    if (input === '\x1f') {
      setShowHelp((prev) => !prev);
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
      // Ctrl+E — 3-state cycle: show+focus / focus / hide
      if (input === 'e') {
        const next = nextCtrlEState(fileTreeVisible, focus);
        setFileTreeVisible(next.fileTreeVisible);
        setFocus(next.focus);
        return;
      }
      // Ctrl+Shift+] / Ctrl+Shift+[ — switch buffer (remapped from Ctrl+Arrow)
      if (input === '}') {
        setBufferManager((prev) => prev.nextBuffer());
        setScrollOffset(0);
        return;
      }
      if (input === '{') {
        setBufferManager((prev) => prev.prevBuffer());
        setScrollOffset(0);
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
      // Ctrl+T — focus title header / Ctrl+G — focus tags header
      if (mode === 'edit') {
        const nextFocus = getNextHeaderFocus(focus, input);
        if (nextFocus) {
          setFocus(nextFocus);
          return;
        }
      }
    }

    // Escape — back / confirmation
    if (key.escape) {
      if (focus === 'fileTree') {
        // Mirror Ctrl+E: hide tree and return to editor
        setFileTreeVisible(false);
        setFocus('editor');
        return;
      }
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

    // Dispatch to file tree
    if (focus === 'fileTree') {
      const keyName = getKeyName(key) ?? input;
      if (keyName) {
        const action = handleTreeKey(keyName, fileTreeRoot, treeCursorIndex);
        switch (action.type) {
          case 'move':
            setTreeCursorIndex(action.index);
            break;
          case 'open':
            handleTreeSelect(action.path);
            break;
          case 'toggle':
            setFileTreeRoot((prev) => toggleTreeNode(prev, action.path));
            break;
          case 'noop':
            break;
        }
      }
      return;
    }

    // Dispatch to editor
    if (focus === 'editor' && active && mode === 'edit') {
      const keyName = getKeyName(key);
      // For modifier+letter combos (Ctrl+A, Option+C, etc.), Ink provides the
      // letter as `input` but no boolean key property fires, so getKeyName
      // returns undefined. Use input as the key name when a modifier is held.
      const name = keyName ?? (
        (key.ctrl || key.meta) && input.length === 1 ? input : undefined
      );
      const keyInfo: KeyInfo = {
        ctrl: key.ctrl,
        shift: key.shift,
        meta: key.meta,
        name,
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

  return (
    <Box flexDirection="row" width={contentWidth} height={rows - 1}>
      {/* File tree sidebar */}
      {fileTreeVisible && (
        <FileTree
          root={fileTreeRoot}
          selectedPath={selectedTreePath}
          cursorIndex={focus === 'fileTree' ? treeCursorIndex : undefined}
          width={treeWidth}
          height={rows - 1}
          onSelect={handleTreeSelect}
        />
      )}

      {/* Separator between file tree and editor */}
      {fileTreeVisible && (
        <Box flexDirection="column" width={SEPARATOR_WIDTH}>
          {Array.from({ length: rows - 1 }, (_, i) => (
            <Text key={i}>{theme.dim(' │ ')}</Text>
          ))}
        </Box>
      )}

      {/* Main editor area */}
      <Box flexDirection="column" width={editorWidth}>
        {/* Buffer tabs */}
        <BufferTabs
          buffers={bufferInfos}
          activeId={active?.id ?? ''}
          width={editorWidth}
        />

        {/* Separator between tabs and header */}
        <Text>{formatRuler(editorWidth)}</Text>

        {/* Header bar (only when a buffer is active) */}
        {active && (
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
        )}

        {/* Error banner */}
        {errorMessage && (
          <Box>
            <Text color="red">Error: {errorMessage}</Text>
          </Box>
        )}

        {/* Edit area or Preview or Placeholder */}
        <Box flexGrow={1}>
          {active ? (
            mode === 'edit' && renderedOutput ? (
              <Text>{renderedOutput.content}</Text>
            ) : mode === 'preview' ? (
              <Text>{previewContent}</Text>
            ) : (
              <Text dimColor>Loading...</Text>
            )
          ) : (
            <Text dimColor>Select a file from the tree (Ctrl+E)</Text>
          )}
        </Box>

        {/* Keybinding help panel (non-modal) */}
        {showHelp && <HelpPanel width={editorWidth} />}
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
  home: boolean;
  end: boolean;
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
  // Ink maps macOS Backspace (\x7f) to key.delete instead of key.backspace.
  // Treat both as 'backspace' (deleteBackward). Use Ctrl+D for deleteForward.
  if (key.backspace || key.delete) return 'backspace';
  if (key.tab) return 'tab';
  if (key.home) return 'home';
  if (key.end) return 'end';
  if (key.upArrow) return 'up';
  if (key.downArrow) return 'down';
  if (key.leftArrow) return 'left';
  if (key.rightArrow) return 'right';
  if (key.escape) return 'escape';
  return undefined;
}
