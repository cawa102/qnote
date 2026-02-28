import type { CursorPosition, Selection, TextBufferState, UndoEntry } from './types.js';

const UNDO_LIMIT = 100;

export class TextBuffer {
  private readonly _lines: readonly string[];
  private readonly _cursor: CursorPosition;
  private readonly _selection: Selection | null;
  private readonly _undoStack: readonly UndoEntry[];
  private readonly _redoStack: readonly UndoEntry[];
  private readonly _preferredCol: number | null;

  private constructor(
    lines: readonly string[],
    cursor: CursorPosition,
    selection: Selection | null,
    undoStack: readonly UndoEntry[],
    redoStack: readonly UndoEntry[],
    preferredCol: number | null,
  ) {
    this._lines = lines;
    this._cursor = cursor;
    this._selection = selection;
    this._undoStack = undoStack;
    this._redoStack = redoStack;
    this._preferredCol = preferredCol;
  }

  static create(content: string): TextBuffer {
    const lines = content.split('\n');
    return new TextBuffer(
      lines,
      { line: 0, col: 0 },
      null,
      [],
      [],
      null,
    );
  }

  getState(): TextBufferState {
    return {
      lines: this._lines,
      cursor: this._cursor,
      selection: this._selection,
    };
  }

  getText(): string {
    return this._lines.join('\n');
  }

  insertChar(char: string): TextBuffer {
    const { line, col } = this._cursor;
    const currentLine = this._lines[line]!;
    const newLine = currentLine.slice(0, col) + char + currentLine.slice(col);
    const newLines = replaceLineAt(this._lines, line, newLine);
    return this._with({
      lines: newLines,
      cursor: { line, col: col + char.length },
      preferredCol: null,
    });
  }

  insertNewline(): TextBuffer {
    const { line, col } = this._cursor;
    const currentLine = this._lines[line]!;
    const before = currentLine.slice(0, col);
    const after = currentLine.slice(col);
    const newLines = [
      ...this._lines.slice(0, line),
      before,
      after,
      ...this._lines.slice(line + 1),
    ];
    return this._with({
      lines: newLines,
      cursor: { line: line + 1, col: 0 },
      preferredCol: null,
    });
  }

  deleteBackward(): TextBuffer {
    const { line, col } = this._cursor;
    if (col > 0) {
      const currentLine = this._lines[line]!;
      const newLine = currentLine.slice(0, col - 1) + currentLine.slice(col);
      return this._with({
        lines: replaceLineAt(this._lines, line, newLine),
        cursor: { line, col: col - 1 },
        preferredCol: null,
      });
    }
    if (line > 0) {
      const prevLine = this._lines[line - 1]!;
      const currentLine = this._lines[line]!;
      const merged = prevLine + currentLine;
      const newLines = [
        ...this._lines.slice(0, line - 1),
        merged,
        ...this._lines.slice(line + 1),
      ];
      return this._with({
        lines: newLines,
        cursor: { line: line - 1, col: prevLine.length },
        preferredCol: null,
      });
    }
    return this;
  }

  deleteForward(): TextBuffer {
    const { line, col } = this._cursor;
    const currentLine = this._lines[line]!;
    if (col < currentLine.length) {
      const newLine = currentLine.slice(0, col) + currentLine.slice(col + 1);
      return this._with({
        lines: replaceLineAt(this._lines, line, newLine),
        preferredCol: null,
      });
    }
    if (line < this._lines.length - 1) {
      const nextLine = this._lines[line + 1]!;
      const merged = currentLine + nextLine;
      const newLines = [
        ...this._lines.slice(0, line),
        merged,
        ...this._lines.slice(line + 2),
      ];
      return this._with({
        lines: newLines,
        preferredCol: null,
      });
    }
    return this;
  }

  clearCurrentLine(): TextBuffer {
    const { line } = this._cursor;
    return this._with({
      lines: replaceLineAt(this._lines, line, ''),
      cursor: { line, col: 0 },
      preferredCol: null,
    });
  }

  deleteLine(): TextBuffer {
    if (this._lines.length === 1) {
      return this._with({
        lines: [''],
        cursor: { line: 0, col: 0 },
        preferredCol: null,
      });
    }
    const { line } = this._cursor;
    const newLines = [
      ...this._lines.slice(0, line),
      ...this._lines.slice(line + 1),
    ];
    const newLine = Math.min(line, newLines.length - 1);
    const newCol = Math.min(this._cursor.col, newLines[newLine]!.length);
    return this._with({
      lines: newLines,
      cursor: { line: newLine, col: newCol },
      preferredCol: null,
    });
  }

  moveCursor(direction: 'up' | 'down' | 'left' | 'right'): TextBuffer {
    const { line, col } = this._cursor;
    switch (direction) {
      case 'left': {
        if (col > 0) {
          return this._with({ cursor: { line, col: col - 1 }, preferredCol: null });
        }
        return this;
      }
      case 'right': {
        const lineLen = this._lines[line]!.length;
        if (col < lineLen) {
          return this._with({ cursor: { line, col: col + 1 }, preferredCol: null });
        }
        return this;
      }
      case 'up': {
        if (line > 0) {
          const preferred = this._preferredCol ?? col;
          const targetLen = this._lines[line - 1]!.length;
          const newCol = Math.min(preferred, targetLen);
          return this._with({
            cursor: { line: line - 1, col: newCol },
            preferredCol: preferred,
          });
        }
        return this;
      }
      case 'down': {
        if (line < this._lines.length - 1) {
          const preferred = this._preferredCol ?? col;
          const targetLen = this._lines[line + 1]!.length;
          const newCol = Math.min(preferred, targetLen);
          return this._with({
            cursor: { line: line + 1, col: newCol },
            preferredCol: preferred,
          });
        }
        return this;
      }
    }
  }

  moveCursorTo(pos: CursorPosition): TextBuffer {
    const line = Math.max(0, Math.min(pos.line, this._lines.length - 1));
    const col = Math.max(0, Math.min(pos.col, this._lines[line]!.length));
    return this._with({
      cursor: { line, col },
      preferredCol: null,
    });
  }

  moveToLineStart(): TextBuffer {
    return this._with({
      cursor: { line: this._cursor.line, col: 0 },
      preferredCol: null,
    });
  }

  moveToLineEnd(): TextBuffer {
    const lineLen = this._lines[this._cursor.line]!.length;
    return this._with({
      cursor: { line: this._cursor.line, col: lineLen },
      preferredCol: null,
    });
  }

  moveWordLeft(): TextBuffer {
    const { line, col } = this._cursor;
    if (col === 0) {
      if (line > 0) {
        const prevLineLen = this._lines[line - 1]!.length;
        return this._with({
          cursor: { line: line - 1, col: prevLineLen },
          preferredCol: null,
        });
      }
      return this;
    }
    const currentLine = this._lines[line]!;
    let newCol = col - 1;
    // Skip whitespace
    while (newCol > 0 && /\s/.test(currentLine[newCol - 1]!)) {
      newCol--;
    }
    // Skip word characters
    while (newCol > 0 && /\S/.test(currentLine[newCol - 1]!)) {
      newCol--;
    }
    return this._with({
      cursor: { line, col: newCol },
      preferredCol: null,
    });
  }

  moveWordRight(): TextBuffer {
    const { line, col } = this._cursor;
    const currentLine = this._lines[line]!;
    if (col >= currentLine.length) {
      if (line < this._lines.length - 1) {
        return this._with({
          cursor: { line: line + 1, col: 0 },
          preferredCol: null,
        });
      }
      return this;
    }
    let newCol = col;
    // Skip current word characters
    while (newCol < currentLine.length && /\S/.test(currentLine[newCol]!)) {
      newCol++;
    }
    // Skip whitespace
    while (newCol < currentLine.length && /\s/.test(currentLine[newCol]!)) {
      newCol++;
    }
    return this._with({
      cursor: { line, col: newCol },
      preferredCol: null,
    });
  }

  indent(): TextBuffer {
    const { line, col } = this._cursor;
    const currentLine = this._lines[line]!;
    const newLine = '  ' + currentLine;
    return this._with({
      lines: replaceLineAt(this._lines, line, newLine),
      cursor: { line, col: col + 2 },
      preferredCol: null,
    });
  }

  unindent(): TextBuffer {
    const { line, col } = this._cursor;
    const currentLine = this._lines[line]!;
    let spacesToRemove = 0;
    if (currentLine.startsWith('  ')) {
      spacesToRemove = 2;
    } else if (currentLine.startsWith(' ')) {
      spacesToRemove = 1;
    }
    if (spacesToRemove === 0) {
      return this;
    }
    const newLine = currentLine.slice(spacesToRemove);
    const newCol = Math.max(0, col - spacesToRemove);
    return this._with({
      lines: replaceLineAt(this._lines, line, newLine),
      cursor: { line, col: newCol },
      preferredCol: null,
    });
  }

  selectTo(pos: CursorPosition): TextBuffer {
    const anchor = this._selection?.anchor ?? this._cursor;
    const headLine = Math.max(0, Math.min(pos.line, this._lines.length - 1));
    const headCol = Math.max(0, Math.min(pos.col, this._lines[headLine]!.length));
    return this._with({
      cursor: { line: headLine, col: headCol },
      selection: { anchor, head: { line: headLine, col: headCol } },
      preferredCol: null,
    });
  }

  wrapSelection(before: string, after: string): TextBuffer {
    if (this._selection) {
      const { anchor, head } = this._selection;
      const [start, end] = normalizeSelection(anchor, head);
      const startLine = this._lines[start.line]!;
      const endLine = this._lines[end.line]!;

      if (start.line === end.line) {
        const selectedText = startLine.slice(start.col, end.col);
        const newLine =
          startLine.slice(0, start.col) +
          before +
          selectedText +
          after +
          startLine.slice(end.col);
        return this._with({
          lines: replaceLineAt(this._lines, start.line, newLine),
          cursor: { line: start.line, col: end.col + before.length + after.length },
          selection: null,
          preferredCol: null,
        });
      }
      // Multi-line selection: wrap start and end
      const newStartLine =
        startLine.slice(0, start.col) + before + startLine.slice(start.col);
      const newEndLine =
        endLine.slice(0, end.col) + after + endLine.slice(end.col);
      let newLines = replaceLineAt(this._lines, start.line, newStartLine);
      newLines = replaceLineAt(newLines, end.line, newEndLine);
      return this._with({
        lines: newLines,
        cursor: { line: end.line, col: end.col + after.length },
        selection: null,
        preferredCol: null,
      });
    }
    // No selection: insert empty markers at cursor
    const { line, col } = this._cursor;
    const currentLine = this._lines[line]!;
    const newLine =
      currentLine.slice(0, col) + before + after + currentLine.slice(col);
    return this._with({
      lines: replaceLineAt(this._lines, line, newLine),
      cursor: { line, col: col + before.length },
      selection: null,
      preferredCol: null,
    });
  }

  insertAt(pos: CursorPosition, text: string): TextBuffer {
    const line = Math.max(0, Math.min(pos.line, this._lines.length - 1));
    const currentLine = this._lines[line]!;
    const col = Math.max(0, Math.min(pos.col, currentLine.length));
    const newLine = currentLine.slice(0, col) + text + currentLine.slice(col);
    return this._with({
      lines: replaceLineAt(this._lines, line, newLine),
      preferredCol: null,
    });
  }

  checkpoint(): TextBuffer {
    const entry: UndoEntry = {
      before: this.getState(),
      after: this.getState(),
    };
    const newStack = this._undoStack.length >= UNDO_LIMIT
      ? [...this._undoStack.slice(1), entry]
      : [...this._undoStack, entry];
    return new TextBuffer(
      this._lines,
      this._cursor,
      this._selection,
      newStack,
      [], // clear redo on new checkpoint
      this._preferredCol,
    );
  }

  undo(): TextBuffer {
    if (this._undoStack.length === 0) {
      return this;
    }
    const lastEntry = this._undoStack[this._undoStack.length - 1]!;
    const redoEntry: UndoEntry = {
      before: lastEntry.before,
      after: this.getState(),
    };
    const { before } = lastEntry;
    return new TextBuffer(
      before.lines,
      before.cursor,
      before.selection,
      this._undoStack.slice(0, -1),
      [...this._redoStack, redoEntry],
      null,
    );
  }

  redo(): TextBuffer {
    if (this._redoStack.length === 0) {
      return this;
    }
    const lastEntry = this._redoStack[this._redoStack.length - 1]!;
    const undoEntry: UndoEntry = {
      before: this.getState(),
      after: lastEntry.after,
    };
    const { after } = lastEntry;
    return new TextBuffer(
      after.lines,
      after.cursor,
      after.selection,
      [...this._undoStack, undoEntry],
      this._redoStack.slice(0, -1),
      null,
    );
  }

  canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  canRedo(): boolean {
    return this._redoStack.length > 0;
  }

  private _with(overrides: {
    lines?: readonly string[];
    cursor?: CursorPosition;
    selection?: Selection | null;
    preferredCol?: number | null;
  }): TextBuffer {
    return new TextBuffer(
      overrides.lines ?? this._lines,
      overrides.cursor ?? this._cursor,
      overrides.selection !== undefined ? overrides.selection : this._selection,
      this._undoStack,
      this._redoStack,
      overrides.preferredCol !== undefined ? overrides.preferredCol : this._preferredCol,
    );
  }
}

function replaceLineAt(
  lines: readonly string[],
  index: number,
  newLine: string,
): readonly string[] {
  return [...lines.slice(0, index), newLine, ...lines.slice(index + 1)];
}

function normalizeSelection(
  anchor: CursorPosition,
  head: CursorPosition,
): [CursorPosition, CursorPosition] {
  if (
    anchor.line < head.line ||
    (anchor.line === head.line && anchor.col <= head.col)
  ) {
    return [anchor, head];
  }
  return [head, anchor];
}
