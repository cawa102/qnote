import { TextBuffer } from './text-buffer.js';
import { getClipboard, setClipboard } from './clipboard.js';

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
    const { ctrl, shift, meta, name } = keyInfo;

    // 1. Meta(Option) + Shift + key — word selection, doc boundary selection
    if (meta && shift && name) {
      switch (name) {
        case 'left':
          return this._buffer.selectWordLeft();
        case 'right':
          return this._buffer.selectWordRight();
        case 'up':
          return this._buffer.selectToDocStart();
        case 'down':
          return this._buffer.selectToDocEnd();
        default:
          return this._buffer;
      }
    }

    // 2. Meta(Option) + key — word movement, doc boundary movement, clipboard, formatting
    if (meta && name) {
      switch (name) {
        case 'left':
          return this._buffer.moveWordLeft();
        case 'right':
          return this._buffer.moveWordRight();
        case 'up':
          return this._buffer.moveToDocStart();
        case 'down':
          return this._buffer.moveToDocEnd();
        case 'a':
          return this._buffer.selectAll();
        case 'c':
          return this._handleCopy();
        case 'x':
          return this._handleCut();
        case 'v':
          return this._handlePaste();
        case 'b':
          return this._buffer.checkpoint().wrapSelection('**', '**');
        case 'i':
          return this._buffer.checkpoint().wrapSelection('*', '*');
        default:
          return this._buffer;
      }
    }

    // 3. Ctrl + Shift + key — delete line
    if (ctrl && shift && name) {
      switch (name) {
        case 'k':
          return this._buffer.checkpoint().deleteLine();
        default:
          return this._buffer;
      }
    }

    // 4. Ctrl + key — undo/redo, bold/italic/link, selectAll
    //    Note: Ctrl+C/X/V are NOT bound here. On macOS terminals, Ctrl+C sends
    //    SIGINT (app exit) and never reaches Ink. Use Option+C/X/V instead.
    //    Ctrl+I sends Tab and is indistinguishable from Tab key. Use Option+I.
    if (ctrl && name) {
      switch (name) {
        case 'z':
          return this._buffer.undo();
        case 'y':
          return this._buffer.redo();
        case 'a':
          return this._buffer.selectAll();
        case 'b':
          return this._buffer.checkpoint().wrapSelection('**', '**');
        case 'd':
          return this._buffer.checkpoint().deleteForward();
        case 'k':
          return this._buffer.checkpoint().insertAt(
            this._buffer.getState().cursor,
            '[](url)',
          );
        default:
          return this._buffer;
      }
    }

    // 5. Shift + named key — selection movement
    if (shift && name) {
      switch (name) {
        case 'left':
          return this._buffer.selectLeft();
        case 'right':
          return this._buffer.selectRight();
        case 'up':
          return this._buffer.selectUp();
        case 'down':
          return this._buffer.selectDown();
        case 'home':
          return this._buffer.selectToLineStart();
        case 'end':
          return this._buffer.selectToLineEnd();
        case 'tab':
          return this._buffer.checkpoint().unindent();
        default:
          break; // fall through for other shift+key combos
      }
    }

    // 6. Named key — movement + selection clear
    if (name) {
      switch (name) {
        case 'return':
          return this._handleEnter();
        case 'backspace':
          return this._buffer.checkpoint().deleteBackward();
        case 'delete':
          return this._buffer.checkpoint().deleteForward();
        case 'tab':
          return this._buffer.checkpoint().indent();
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

    // 7. Plain character — selection-aware insert
    if (input.length > 0) {
      return this._buffer.checkpoint().insertChar(input);
    }

    return this._buffer;
  }

  private _handleCopy(): TextBuffer {
    const text = this._buffer.getSelectedText();
    if (text) {
      setClipboard(text);
    }
    return this._buffer;
  }

  private _handleCut(): TextBuffer {
    const text = this._buffer.getSelectedText();
    if (!text) {
      return this._buffer;
    }
    setClipboard(text);
    return this._buffer.checkpoint().deleteSelection();
  }

  private _handlePaste(): TextBuffer {
    const text = getClipboard();
    if (!text) {
      return this._buffer;
    }
    return this._buffer.checkpoint().replaceSelection(text);
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
