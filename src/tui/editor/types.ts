// --- Editor types ---

export interface CursorPosition {
  readonly line: number;
  readonly col: number;
}

export interface Selection {
  readonly anchor: CursorPosition;
  readonly head: CursorPosition;
}

export interface TextBufferState {
  readonly lines: readonly string[];
  readonly cursor: CursorPosition;
  readonly selection: Selection | null;
}

export interface UndoEntry {
  readonly before: TextBufferState;
  readonly after: TextBufferState;
}

export interface BufferInfo {
  readonly id: string;
  readonly filePath: string;
  readonly title: string;
  readonly dirty: boolean;
}

export interface EditorScreenParams {
  readonly filePath?: string;
  readonly showFileTree?: boolean;
  readonly cursorAtEnd?: boolean;
}

export type EditorMode = 'edit' | 'preview';

export type FocusArea = 'editor' | 'fileTree' | 'headerTitle' | 'headerTags';

export interface FileTreeNode {
  readonly name: string;
  readonly path: string;
  readonly type: 'file' | 'directory';
  readonly children?: readonly FileTreeNode[];
  readonly expanded?: boolean;
}
