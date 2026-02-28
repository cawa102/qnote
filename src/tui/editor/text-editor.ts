import { TextBuffer } from './text-buffer.js';

export interface KeyInfo {
  readonly ctrl: boolean;
  readonly shift: boolean;
  readonly meta: boolean;
  readonly name?: string;
}

const LIST_BULLET_RE = /^(\s*)([-*])\s/;
const LIST_NUMBER_RE = /^(\s*)(\d+)\.\s/;

export class TextEditorController {
  private readonly _buffer: TextBuffer;
  private readonly _dirty: boolean;
  private readonly _cleanContent: string;

  private constructor(buffer: TextBuffer, dirty: boolean, cleanContent: string) {
    this._buffer = buffer;
    this._dirty = dirty;
    this._cleanContent = cleanContent;
  }

  static create(initialContent: string): TextEditorController {
    const buffer = TextBuffer.create(initialContent);
    return new TextEditorController(buffer, false, initialContent);
  }

  handleInput(input: string, keyInfo: KeyInfo): TextEditorController {
    const newBuffer = this._dispatch(input, keyInfo);
    if (newBuffer === this._buffer) {
      return this;
    }
    const dirty = newBuffer.getText() !== this._cleanContent;
    return new TextEditorController(newBuffer, dirty, this._cleanContent);
  }

  getBuffer(): TextBuffer {
    return this._buffer;
  }

  getContent(): string {
    return this._buffer.getText();
  }

  isDirty(): boolean {
    return this._dirty;
  }

  markClean(): TextEditorController {
    return new TextEditorController(this._buffer, false, this._buffer.getText());
  }

  private _dispatch(input: string, keyInfo: KeyInfo): TextBuffer {
    const { ctrl, shift, name } = keyInfo;

    // Ctrl shortcuts
    if (ctrl) {
      if (shift && name === 'k') {
        return this._buffer.checkpoint().deleteLine();
      }
      switch (name) {
        case 'z':
          return this._buffer.undo();
        case 'y':
          return this._buffer.redo();
        case 'b':
          return this._buffer.checkpoint().wrapSelection('**', '**');
        case 'i':
          return this._buffer.checkpoint().wrapSelection('*', '*');
        case 'd':
          return this._buffer.checkpoint().deleteForward();
        case 'k':
          return this._buffer.checkpoint().insertAt(
            this._buffer.getState().cursor,
            '[](url)',
          );
        case 'left':
          return this._buffer.moveWordLeft();
        case 'right':
          return this._buffer.moveWordRight();
        default:
          return this._buffer;
      }
    }

    // Named keys
    if (name) {
      switch (name) {
        case 'return':
          return this._handleEnter();
        case 'backspace':
          return this._buffer.checkpoint().deleteBackward();
        case 'delete':
          // Currently unreachable from EditorScreen (Ink maps macOS Backspace
          // to key.delete, so getKeyName maps both to 'backspace').
          // Kept for direct API use and future Linux/Windows support.
          return this._buffer.checkpoint().deleteForward();
        case 'tab':
          return shift
            ? this._buffer.checkpoint().unindent()
            : this._buffer.checkpoint().indent();
        case 'up':
          return this._buffer.moveCursor('up');
        case 'down':
          return this._buffer.moveCursor('down');
        case 'left':
          return this._buffer.moveCursor('left');
        case 'right':
          return this._buffer.moveCursor('right');
        case 'home':
          return this._buffer.moveToLineStart();
        case 'end':
          return this._buffer.moveToLineEnd();
        default:
          return this._buffer;
      }
    }

    // Plain character
    if (input.length > 0) {
      return this._buffer.checkpoint().insertChar(input);
    }

    return this._buffer;
  }

  private _handleEnter(): TextBuffer {
    const state = this._buffer.getState();
    const currentLine = state.lines[state.cursor.line]!;
    const buf = this._buffer.checkpoint();

    // Check bullet list: - or *
    const bulletMatch = currentLine.match(LIST_BULLET_RE);
    if (bulletMatch) {
      const indent = bulletMatch[1]!;
      const marker = bulletMatch[2]!;
      const prefix = `${indent}${marker} `;
      const contentAfterPrefix = currentLine.slice(prefix.length);

      if (contentAfterPrefix.trim() === '') {
        // Empty list item — remove prefix and insert empty line
        const cleared = buf
          .moveToLineStart()
          .moveToLineEnd();
        // Delete the entire line content and replace with empty
        return deleteLineContent(cleared).insertNewline();
      }
      // Continue list
      return buf.moveToLineEnd().insertNewline().insertAt(
        { line: state.cursor.line + 1, col: 0 },
        prefix,
      ).moveCursorTo({ line: state.cursor.line + 1, col: prefix.length });
    }

    // Check numbered list: 1. 2. etc
    const numberMatch = currentLine.match(LIST_NUMBER_RE);
    if (numberMatch) {
      const indent = numberMatch[1]!;
      const num = parseInt(numberMatch[2]!, 10);
      const prefix = `${indent}${num}. `;
      const contentAfterPrefix = currentLine.slice(prefix.length);

      if (contentAfterPrefix.trim() === '') {
        // Empty numbered item — remove prefix
        return deleteLineContent(buf.moveToLineStart().moveToLineEnd()).insertNewline();
      }
      // Continue with incremented number
      const nextPrefix = `${indent}${num + 1}. `;
      return buf.moveToLineEnd().insertNewline().insertAt(
        { line: state.cursor.line + 1, col: 0 },
        nextPrefix,
      ).moveCursorTo({ line: state.cursor.line + 1, col: nextPrefix.length });
    }

    return buf.insertNewline();
  }
}

/**
 * Delete all content on the current line in a single operation.
 * Returns a buffer with the current line empty and cursor at col 0.
 */
function deleteLineContent(buffer: TextBuffer): TextBuffer {
  return buffer.clearCurrentLine();
}
