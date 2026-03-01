import { describe, it, expect } from 'vitest';
import { TextBuffer } from '../../../src/tui/editor/text-buffer.js';

describe('TextBuffer', () => {
  describe('create', () => {
    it('creates from empty string producing one empty line', () => {
      const buf = TextBuffer.create('');
      const state = buf.getState();
      expect(state.lines).toEqual(['']);
      expect(state.cursor).toEqual({ line: 0, col: 0 });
      expect(state.selection).toBeNull();
    });

    it('creates from multi-line string and splits on newlines', () => {
      const buf = TextBuffer.create('hello\nworld\nfoo');
      const state = buf.getState();
      expect(state.lines).toEqual(['hello', 'world', 'foo']);
      expect(state.cursor).toEqual({ line: 0, col: 0 });
    });

    it('handles trailing newline', () => {
      const buf = TextBuffer.create('hello\n');
      expect(buf.getState().lines).toEqual(['hello', '']);
    });
  });

  describe('getText', () => {
    it('returns joined lines with newlines', () => {
      const buf = TextBuffer.create('hello\nworld');
      expect(buf.getText()).toBe('hello\nworld');
    });

    it('returns empty string for single empty line', () => {
      const buf = TextBuffer.create('');
      expect(buf.getText()).toBe('');
    });
  });

  describe('insertChar', () => {
    it('inserts character at cursor and advances cursor', () => {
      const buf = TextBuffer.create('').insertChar('a');
      const state = buf.getState();
      expect(state.lines).toEqual(['a']);
      expect(state.cursor).toEqual({ line: 0, col: 1 });
    });

    it('inserts character in middle of line', () => {
      const buf = TextBuffer.create('ac')
        .moveCursorTo({ line: 0, col: 1 })
        .insertChar('b');
      expect(buf.getState().lines).toEqual(['abc']);
      expect(buf.getState().cursor).toEqual({ line: 0, col: 2 });
    });

    it('inserts CJK character correctly', () => {
      const buf = TextBuffer.create('').insertChar('日');
      expect(buf.getState().lines).toEqual(['日']);
      expect(buf.getState().cursor).toEqual({ line: 0, col: 1 });
    });

    it('returns a new TextBuffer instance (immutability)', () => {
      const buf1 = TextBuffer.create('');
      const buf2 = buf1.insertChar('a');
      expect(buf1).not.toBe(buf2);
      expect(buf1.getState().lines).toEqual(['']);
      expect(buf2.getState().lines).toEqual(['a']);
    });
  });

  describe('insertNewline', () => {
    it('splits line at cursor and moves to next line start', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 3 })
        .insertNewline();
      const state = buf.getState();
      expect(state.lines).toEqual(['hel', 'lo']);
      expect(state.cursor).toEqual({ line: 1, col: 0 });
    });

    it('inserts newline at end of line', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 5 })
        .insertNewline();
      expect(buf.getState().lines).toEqual(['hello', '']);
      expect(buf.getState().cursor).toEqual({ line: 1, col: 0 });
    });

    it('inserts newline at start of line', () => {
      const buf = TextBuffer.create('hello').insertNewline();
      expect(buf.getState().lines).toEqual(['', 'hello']);
      expect(buf.getState().cursor).toEqual({ line: 1, col: 0 });
    });
  });

  describe('deleteBackward', () => {
    it('deletes character before cursor', () => {
      const buf = TextBuffer.create('abc')
        .moveCursorTo({ line: 0, col: 2 })
        .deleteBackward();
      expect(buf.getState().lines).toEqual(['ac']);
      expect(buf.getState().cursor).toEqual({ line: 0, col: 1 });
    });

    it('at line start joins with previous line', () => {
      const buf = TextBuffer.create('hello\nworld')
        .moveCursorTo({ line: 1, col: 0 })
        .deleteBackward();
      expect(buf.getState().lines).toEqual(['helloworld']);
      expect(buf.getState().cursor).toEqual({ line: 0, col: 5 });
    });

    it('at buffer start is no-op', () => {
      const buf = TextBuffer.create('hello').deleteBackward();
      expect(buf.getState().lines).toEqual(['hello']);
      expect(buf.getState().cursor).toEqual({ line: 0, col: 0 });
    });
  });

  describe('deleteForward', () => {
    it('deletes character at cursor', () => {
      const buf = TextBuffer.create('abc')
        .moveCursorTo({ line: 0, col: 1 })
        .deleteForward();
      expect(buf.getState().lines).toEqual(['ac']);
      expect(buf.getState().cursor).toEqual({ line: 0, col: 1 });
    });

    it('at line end joins with next line', () => {
      const buf = TextBuffer.create('hello\nworld')
        .moveCursorTo({ line: 0, col: 5 })
        .deleteForward();
      expect(buf.getState().lines).toEqual(['helloworld']);
      expect(buf.getState().cursor).toEqual({ line: 0, col: 5 });
    });

    it('at buffer end is no-op', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 5 })
        .deleteForward();
      expect(buf.getState().lines).toEqual(['hello']);
      expect(buf.getState().cursor).toEqual({ line: 0, col: 5 });
    });
  });

  describe('clearCurrentLine', () => {
    it('clears content of the current line and moves cursor to col 0', () => {
      const buf = TextBuffer.create('hello\nworld\nfoo')
        .moveCursorTo({ line: 1, col: 3 })
        .clearCurrentLine();
      expect(buf.getState().lines).toEqual(['hello', '', 'foo']);
      expect(buf.getState().cursor).toEqual({ line: 1, col: 0 });
    });

    it('is a no-op on an already empty line', () => {
      const buf = TextBuffer.create('hello\n\nworld')
        .moveCursorTo({ line: 1, col: 0 })
        .clearCurrentLine();
      expect(buf.getState().lines).toEqual(['hello', '', 'world']);
      expect(buf.getState().cursor).toEqual({ line: 1, col: 0 });
    });

    it('clears first line', () => {
      const buf = TextBuffer.create('hello world')
        .clearCurrentLine();
      expect(buf.getState().lines).toEqual(['']);
      expect(buf.getState().cursor).toEqual({ line: 0, col: 0 });
    });

    it('returns a new instance (immutability)', () => {
      const buf1 = TextBuffer.create('hello');
      const buf2 = buf1.clearCurrentLine();
      expect(buf1).not.toBe(buf2);
      expect(buf1.getState().lines).toEqual(['hello']);
      expect(buf2.getState().lines).toEqual(['']);
    });
  });

  describe('deleteLine', () => {
    it('removes current line', () => {
      const buf = TextBuffer.create('aaa\nbbb\nccc')
        .moveCursorTo({ line: 1, col: 1 })
        .deleteLine();
      expect(buf.getState().lines).toEqual(['aaa', 'ccc']);
      expect(buf.getState().cursor.line).toBe(1);
    });

    it('cursor moves up if at last line', () => {
      const buf = TextBuffer.create('aaa\nbbb')
        .moveCursorTo({ line: 1, col: 0 })
        .deleteLine();
      expect(buf.getState().lines).toEqual(['aaa']);
      expect(buf.getState().cursor.line).toBe(0);
    });

    it('does not delete last remaining line, clears it instead', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 3 })
        .deleteLine();
      expect(buf.getState().lines).toEqual(['']);
      expect(buf.getState().cursor).toEqual({ line: 0, col: 0 });
    });
  });

  describe('moveCursor', () => {
    it('moves right within line', () => {
      const buf = TextBuffer.create('hello').moveCursor('right');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 1 });
    });

    it('moves left within line', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 3 })
        .moveCursor('left');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 2 });
    });

    it('does not move left past start of buffer', () => {
      const buf = TextBuffer.create('hello').moveCursor('left');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 0 });
    });

    it('does not move right past end of line', () => {
      const buf = TextBuffer.create('hi')
        .moveCursorTo({ line: 0, col: 2 })
        .moveCursor('right');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 2 });
    });

    it('moves down to next line', () => {
      const buf = TextBuffer.create('hello\nworld').moveCursor('down');
      expect(buf.getState().cursor).toEqual({ line: 1, col: 0 });
    });

    it('moves up to previous line', () => {
      const buf = TextBuffer.create('hello\nworld')
        .moveCursorTo({ line: 1, col: 0 })
        .moveCursor('up');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 0 });
    });

    it('does not move up past first line', () => {
      const buf = TextBuffer.create('hello').moveCursor('up');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 0 });
    });

    it('does not move down past last line', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 3 })
        .moveCursor('down');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 3 });
    });

    it('up/down preserves preferred column (sticky column)', () => {
      const buf = TextBuffer.create('longline\nhi\nlongline')
        .moveCursorTo({ line: 0, col: 6 })
        .moveCursor('down'); // goes to line 1, col clamped to 2
      expect(buf.getState().cursor).toEqual({ line: 1, col: 2 });
      const buf2 = buf.moveCursor('down'); // goes to line 2, restores to col 6
      expect(buf2.getState().cursor).toEqual({ line: 2, col: 6 });
    });

    it('clamps column to line length on up/down', () => {
      const buf = TextBuffer.create('hello\nhi')
        .moveCursorTo({ line: 0, col: 5 })
        .moveCursor('down');
      expect(buf.getState().cursor).toEqual({ line: 1, col: 2 });
    });
  });

  describe('moveCursorTo', () => {
    it('moves cursor to absolute position', () => {
      const buf = TextBuffer.create('hello\nworld').moveCursorTo({ line: 1, col: 3 });
      expect(buf.getState().cursor).toEqual({ line: 1, col: 3 });
    });

    it('clamps to valid range', () => {
      const buf = TextBuffer.create('hi').moveCursorTo({ line: 5, col: 100 });
      expect(buf.getState().cursor).toEqual({ line: 0, col: 2 });
    });
  });

  describe('moveToLineStart / moveToLineEnd', () => {
    it('moveToLineStart moves to column 0', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 3 })
        .moveToLineStart();
      expect(buf.getState().cursor).toEqual({ line: 0, col: 0 });
    });

    it('moveToLineEnd moves to end of line', () => {
      const buf = TextBuffer.create('hello').moveToLineEnd();
      expect(buf.getState().cursor).toEqual({ line: 0, col: 5 });
    });
  });

  describe('moveWordLeft / moveWordRight', () => {
    it('moveWordRight jumps to start of next word', () => {
      const buf = TextBuffer.create('hello world').moveWordRight();
      expect(buf.getState().cursor.col).toBe(6);
    });

    it('moveWordLeft jumps to previous word boundary', () => {
      const buf = TextBuffer.create('hello world')
        .moveCursorTo({ line: 0, col: 8 })
        .moveWordLeft();
      expect(buf.getState().cursor.col).toBe(6);
    });

    it('moveWordLeft at line start moves to end of previous line', () => {
      const buf = TextBuffer.create('hello\nworld')
        .moveCursorTo({ line: 1, col: 0 })
        .moveWordLeft();
      expect(buf.getState().cursor).toEqual({ line: 0, col: 5 });
    });

    it('moveWordRight at line end moves to start of next line', () => {
      const buf = TextBuffer.create('hello\nworld')
        .moveCursorTo({ line: 0, col: 5 })
        .moveWordRight();
      expect(buf.getState().cursor).toEqual({ line: 1, col: 0 });
    });

    it('moveWordRight at buffer end is no-op', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 5 })
        .moveWordRight();
      expect(buf.getState().cursor).toEqual({ line: 0, col: 5 });
    });

    it('moveWordLeft at buffer start is no-op', () => {
      const buf = TextBuffer.create('hello').moveWordLeft();
      expect(buf.getState().cursor).toEqual({ line: 0, col: 0 });
    });
  });

  describe('indent / unindent', () => {
    it('indent adds 2 spaces at line start', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 3 })
        .indent();
      expect(buf.getState().lines).toEqual(['  hello']);
      expect(buf.getState().cursor.col).toBe(5);
    });

    it('unindent removes up to 2 leading spaces', () => {
      const buf = TextBuffer.create('  hello')
        .moveCursorTo({ line: 0, col: 5 })
        .unindent();
      expect(buf.getState().lines).toEqual(['hello']);
      expect(buf.getState().cursor.col).toBe(3);
    });

    it('unindent removes 1 space if only 1 leading space', () => {
      const buf = TextBuffer.create(' hello')
        .moveCursorTo({ line: 0, col: 4 })
        .unindent();
      expect(buf.getState().lines).toEqual(['hello']);
      expect(buf.getState().cursor.col).toBe(3);
    });

    it('unindent is no-op if no leading spaces', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 2 })
        .unindent();
      expect(buf.getState().lines).toEqual(['hello']);
      expect(buf.getState().cursor.col).toBe(2);
    });
  });

  describe('wrapSelection', () => {
    it('wraps with markers when no selection, inserting empty markers', () => {
      const buf = TextBuffer.create('')
        .wrapSelection('**', '**');
      expect(buf.getState().lines).toEqual(['****']);
      // cursor should be between the markers
      expect(buf.getState().cursor.col).toBe(2);
    });

    it('wraps selected text with markers', () => {
      const buf = TextBuffer.create('hello world')
        .moveCursorTo({ line: 0, col: 0 })
        .selectTo({ line: 0, col: 5 })
        .wrapSelection('**', '**');
      expect(buf.getState().lines).toEqual(['**hello** world']);
    });
  });

  describe('insertAt', () => {
    it('inserts text at specified position', () => {
      const buf = TextBuffer.create('hello world')
        .insertAt({ line: 0, col: 5 }, ' beautiful');
      expect(buf.getState().lines).toEqual(['hello beautiful world']);
    });
  });

  describe('undo / redo', () => {
    it('undo restores previous checkpointed state', () => {
      const buf = TextBuffer.create('hello')
        .checkpoint()
        .moveCursorTo({ line: 0, col: 5 })
        .insertChar('!');
      expect(buf.getText()).toBe('hello!');
      const undone = buf.undo();
      expect(undone.getText()).toBe('hello');
    });

    it('redo restores after undo', () => {
      const buf = TextBuffer.create('hello')
        .checkpoint()
        .moveCursorTo({ line: 0, col: 5 })
        .insertChar('!');
      const undone = buf.undo();
      const redone = undone.redo();
      expect(redone.getText()).toBe('hello!');
    });

    it('canUndo returns false initially', () => {
      const buf = TextBuffer.create('hello');
      expect(buf.canUndo()).toBe(false);
    });

    it('canUndo returns true after checkpoint + edit', () => {
      const buf = TextBuffer.create('hello')
        .checkpoint()
        .insertChar('x');
      expect(buf.canUndo()).toBe(true);
    });

    it('canRedo returns false initially', () => {
      const buf = TextBuffer.create('hello');
      expect(buf.canRedo()).toBe(false);
    });

    it('canRedo returns true after undo', () => {
      const buf = TextBuffer.create('hello')
        .checkpoint()
        .insertChar('x')
        .undo();
      expect(buf.canRedo()).toBe(true);
    });

    it('undo stack limit is 100 entries', () => {
      let buf = TextBuffer.create('');
      for (let i = 0; i < 110; i++) {
        buf = buf.checkpoint().insertChar(String(i % 10));
      }
      // Should be able to undo up to 100 times
      let undoCount = 0;
      let current = buf;
      while (current.canUndo()) {
        current = current.undo();
        undoCount++;
      }
      expect(undoCount).toBe(100);
    });
  });

  describe('CJK handling', () => {
    it('handles CJK characters correctly', () => {
      const buf = TextBuffer.create('日本語テスト');
      expect(buf.getText()).toBe('日本語テスト');
      expect(buf.getState().lines).toEqual(['日本語テスト']);
    });

    it('cursor moves through CJK characters one at a time', () => {
      const buf = TextBuffer.create('日本語')
        .moveCursor('right')
        .moveCursor('right');
      expect(buf.getState().cursor.col).toBe(2);
    });
  });

  describe('selectLeft / selectRight', () => {
    it('selectLeft from middle of line extends selection by 1 char', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 3 })
        .selectLeft();
      const state = buf.getState();
      expect(state.selection).toEqual({
        anchor: { line: 0, col: 3 },
        head: { line: 0, col: 2 },
      });
      expect(state.cursor).toEqual({ line: 0, col: 2 });
    });

    it('selectLeft from col 0 wraps to previous line end', () => {
      const buf = TextBuffer.create('hello\nworld')
        .moveCursorTo({ line: 1, col: 0 })
        .selectLeft();
      const state = buf.getState();
      expect(state.selection).toEqual({
        anchor: { line: 1, col: 0 },
        head: { line: 0, col: 5 },
      });
    });

    it('selectLeft at doc start is no-op', () => {
      const buf = TextBuffer.create('hello').selectLeft();
      expect(buf.getState().selection).toBeNull();
    });

    it('selectRight from end of line wraps to next line start', () => {
      const buf = TextBuffer.create('hello\nworld')
        .moveCursorTo({ line: 0, col: 5 })
        .selectRight();
      const state = buf.getState();
      expect(state.selection).toEqual({
        anchor: { line: 0, col: 5 },
        head: { line: 1, col: 0 },
      });
    });

    it('selectRight from middle of line extends selection by 1 char', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 1 })
        .selectRight();
      expect(buf.getState().selection).toEqual({
        anchor: { line: 0, col: 1 },
        head: { line: 0, col: 2 },
      });
    });

    it('selectRight at doc end is no-op', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 5 })
        .selectRight();
      expect(buf.getState().selection).toBeNull();
    });

    it('extends existing selection', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 1 })
        .selectRight()
        .selectRight();
      expect(buf.getState().selection).toEqual({
        anchor: { line: 0, col: 1 },
        head: { line: 0, col: 3 },
      });
    });
  });

  describe('selectUp / selectDown', () => {
    it('selectUp extends selection one line up', () => {
      const buf = TextBuffer.create('hello\nworld')
        .moveCursorTo({ line: 1, col: 3 })
        .selectUp();
      const state = buf.getState();
      expect(state.selection).toEqual({
        anchor: { line: 1, col: 3 },
        head: { line: 0, col: 3 },
      });
    });

    it('selectDown extends selection one line down', () => {
      const buf = TextBuffer.create('hello\nworld')
        .moveCursorTo({ line: 0, col: 2 })
        .selectDown();
      const state = buf.getState();
      expect(state.selection).toEqual({
        anchor: { line: 0, col: 2 },
        head: { line: 1, col: 2 },
      });
    });

    it('selectUp/Down preserves preferredCol across vertical selection', () => {
      const buf = TextBuffer.create('longline\nhi\nlongline')
        .moveCursorTo({ line: 0, col: 6 })
        .selectDown()  // line 1, col clamped to 2
        .selectDown(); // line 2, restores to col 6
      expect(buf.getState().selection!.head).toEqual({ line: 2, col: 6 });
    });

    it('selectUp at first line is no-op', () => {
      const buf = TextBuffer.create('hello').selectUp();
      expect(buf.getState().selection).toBeNull();
    });

    it('selectDown at last line is no-op', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 3 })
        .selectDown();
      expect(buf.getState().selection).toBeNull();
    });
  });

  describe('selectWordLeft / selectWordRight', () => {
    it('selectWordLeft skips whitespace then word chars', () => {
      const buf = TextBuffer.create('hello world')
        .moveCursorTo({ line: 0, col: 8 })
        .selectWordLeft();
      expect(buf.getState().selection).toEqual({
        anchor: { line: 0, col: 8 },
        head: { line: 0, col: 6 },
      });
    });

    it('selectWordRight skips word chars then whitespace', () => {
      const buf = TextBuffer.create('hello world')
        .selectWordRight();
      expect(buf.getState().selection).toEqual({
        anchor: { line: 0, col: 0 },
        head: { line: 0, col: 6 },
      });
    });

    it('selectWordLeft at line start wraps to previous line end', () => {
      const buf = TextBuffer.create('hello\nworld')
        .moveCursorTo({ line: 1, col: 0 })
        .selectWordLeft();
      expect(buf.getState().selection!.head).toEqual({ line: 0, col: 5 });
    });

    it('selectWordRight at line end wraps to next line start', () => {
      const buf = TextBuffer.create('hello\nworld')
        .moveCursorTo({ line: 0, col: 5 })
        .selectWordRight();
      expect(buf.getState().selection!.head).toEqual({ line: 1, col: 0 });
    });
  });

  describe('selectToLineStart / selectToLineEnd', () => {
    it('selectToLineStart from middle of line', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 3 })
        .selectToLineStart();
      expect(buf.getState().selection).toEqual({
        anchor: { line: 0, col: 3 },
        head: { line: 0, col: 0 },
      });
    });

    it('selectToLineEnd from middle of line', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 2 })
        .selectToLineEnd();
      expect(buf.getState().selection).toEqual({
        anchor: { line: 0, col: 2 },
        head: { line: 0, col: 5 },
      });
    });
  });

  describe('selectToDocStart / selectToDocEnd', () => {
    it('selectToDocStart from middle of document', () => {
      const buf = TextBuffer.create('aaa\nbbb\nccc')
        .moveCursorTo({ line: 1, col: 2 })
        .selectToDocStart();
      expect(buf.getState().selection).toEqual({
        anchor: { line: 1, col: 2 },
        head: { line: 0, col: 0 },
      });
    });

    it('selectToDocEnd from middle of document', () => {
      const buf = TextBuffer.create('aaa\nbbb\nccc')
        .moveCursorTo({ line: 1, col: 1 })
        .selectToDocEnd();
      expect(buf.getState().selection).toEqual({
        anchor: { line: 1, col: 1 },
        head: { line: 2, col: 3 },
      });
    });
  });

  describe('selectAll', () => {
    it('selectAll covers entire document', () => {
      const buf = TextBuffer.create('hello\nworld').selectAll();
      expect(buf.getState().selection).toEqual({
        anchor: { line: 0, col: 0 },
        head: { line: 1, col: 5 },
      });
    });

    it('selectAll on single line', () => {
      const buf = TextBuffer.create('hello').selectAll();
      expect(buf.getState().selection).toEqual({
        anchor: { line: 0, col: 0 },
        head: { line: 0, col: 5 },
      });
    });

    it('selectAll on empty document', () => {
      const buf = TextBuffer.create('').selectAll();
      expect(buf.getState().selection).toEqual({
        anchor: { line: 0, col: 0 },
        head: { line: 0, col: 0 },
      });
    });
  });

  describe('getSelectedText', () => {
    it('returns correct text for single-line selection', () => {
      const buf = TextBuffer.create('hello world')
        .moveCursorTo({ line: 0, col: 0 })
        .selectTo({ line: 0, col: 5 });
      expect(buf.getSelectedText()).toBe('hello');
    });

    it('returns correct text for multi-line selection', () => {
      const buf = TextBuffer.create('aaa\nbbb\nccc')
        .moveCursorTo({ line: 0, col: 1 })
        .selectTo({ line: 2, col: 2 });
      expect(buf.getSelectedText()).toBe('aa\nbbb\ncc');
    });

    it('returns empty string when no selection', () => {
      const buf = TextBuffer.create('hello');
      expect(buf.getSelectedText()).toBe('');
    });

    it('handles reversed selection (head before anchor)', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 5 })
        .selectTo({ line: 0, col: 2 });
      expect(buf.getSelectedText()).toBe('llo');
    });
  });

  describe('deleteSelection', () => {
    it('removes single-line selection', () => {
      const buf = TextBuffer.create('hello world')
        .moveCursorTo({ line: 0, col: 0 })
        .selectTo({ line: 0, col: 5 })
        .deleteSelection();
      expect(buf.getText()).toBe(' world');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 0 });
      expect(buf.getState().selection).toBeNull();
    });

    it('removes multi-line selection and merges lines', () => {
      const buf = TextBuffer.create('aaa\nbbb\nccc')
        .moveCursorTo({ line: 0, col: 1 })
        .selectTo({ line: 2, col: 2 })
        .deleteSelection();
      expect(buf.getText()).toBe('ac');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 1 });
    });

    it('with no selection is a no-op', () => {
      const buf = TextBuffer.create('hello');
      const result = buf.deleteSelection();
      expect(result.getText()).toBe('hello');
    });

    it('handles reversed selection', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 5 })
        .selectTo({ line: 0, col: 2 })
        .deleteSelection();
      expect(buf.getText()).toBe('he');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 2 });
    });
  });

  describe('replaceSelection', () => {
    it('replaces selected text', () => {
      const buf = TextBuffer.create('hello world')
        .moveCursorTo({ line: 0, col: 0 })
        .selectTo({ line: 0, col: 5 })
        .replaceSelection('hi');
      expect(buf.getText()).toBe('hi world');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 2 });
    });

    it('replaces with multi-line text', () => {
      const buf = TextBuffer.create('hello world')
        .moveCursorTo({ line: 0, col: 0 })
        .selectTo({ line: 0, col: 5 })
        .replaceSelection('hi\nthere');
      expect(buf.getText()).toBe('hi\nthere world');
    });

    it('with no selection inserts at cursor', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 5 })
        .replaceSelection(' world');
      expect(buf.getText()).toBe('hello world');
    });
  });

  describe('moveToDocStart / moveToDocEnd', () => {
    it('moveToDocStart moves cursor and clears selection', () => {
      const buf = TextBuffer.create('aaa\nbbb\nccc')
        .moveCursorTo({ line: 2, col: 2 })
        .selectTo({ line: 1, col: 1 })
        .moveToDocStart();
      expect(buf.getState().cursor).toEqual({ line: 0, col: 0 });
      expect(buf.getState().selection).toBeNull();
    });

    it('moveToDocEnd moves cursor and clears selection', () => {
      const buf = TextBuffer.create('aaa\nbbb\nccc')
        .moveToDocEnd();
      expect(buf.getState().cursor).toEqual({ line: 2, col: 3 });
      expect(buf.getState().selection).toBeNull();
    });
  });

  describe('deleteWordBackward', () => {
    it('deletes from cursor to word boundary', () => {
      const buf = TextBuffer.create('hello world')
        .moveCursorTo({ line: 0, col: 11 })
        .deleteWordBackward();
      expect(buf.getText()).toBe('hello ');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 6 });
    });

    it('at line start merges with previous line', () => {
      const buf = TextBuffer.create('hello\nworld')
        .moveCursorTo({ line: 1, col: 0 })
        .deleteWordBackward();
      expect(buf.getText()).toBe('helloworld');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 5 });
    });

    it('deletes whitespace then word', () => {
      const buf = TextBuffer.create('hello   world')
        .moveCursorTo({ line: 0, col: 8 })
        .deleteWordBackward();
      expect(buf.getText()).toBe('world');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 0 });
    });

    it('at doc start is no-op', () => {
      const buf = TextBuffer.create('hello').deleteWordBackward();
      expect(buf.getText()).toBe('hello');
    });
  });

  describe('deleteWordForward', () => {
    it('deletes from cursor to next word boundary', () => {
      const buf = TextBuffer.create('hello world')
        .deleteWordForward();
      expect(buf.getText()).toBe('world');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 0 });
    });

    it('at line end merges with next line', () => {
      const buf = TextBuffer.create('hello\nworld')
        .moveCursorTo({ line: 0, col: 5 })
        .deleteWordForward();
      expect(buf.getText()).toBe('helloworld');
    });

    it('at doc end is no-op', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 5 })
        .deleteWordForward();
      expect(buf.getText()).toBe('hello');
    });
  });

  describe('selection-aware existing methods', () => {
    it('insertChar with selection replaces selected text', () => {
      const buf = TextBuffer.create('hello world')
        .moveCursorTo({ line: 0, col: 0 })
        .selectTo({ line: 0, col: 5 })
        .insertChar('x');
      expect(buf.getText()).toBe('x world');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 1 });
      expect(buf.getState().selection).toBeNull();
    });

    it('insertNewline with selection deletes selection then inserts newline', () => {
      const buf = TextBuffer.create('hello world')
        .moveCursorTo({ line: 0, col: 0 })
        .selectTo({ line: 0, col: 5 })
        .insertNewline();
      expect(buf.getText()).toBe('\n world');
    });

    it('deleteBackward with selection deletes entire selection', () => {
      const buf = TextBuffer.create('hello world')
        .moveCursorTo({ line: 0, col: 0 })
        .selectTo({ line: 0, col: 5 })
        .deleteBackward();
      expect(buf.getText()).toBe(' world');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 0 });
    });

    it('deleteForward with selection deletes entire selection', () => {
      const buf = TextBuffer.create('hello world')
        .moveCursorTo({ line: 0, col: 0 })
        .selectTo({ line: 0, col: 5 })
        .deleteForward();
      expect(buf.getText()).toBe(' world');
    });

    it('left arrow with selection collapses to selection start', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 1 })
        .selectTo({ line: 0, col: 4 })
        .moveCursor('left');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 1 });
      expect(buf.getState().selection).toBeNull();
    });

    it('right arrow with selection collapses to selection end', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 1 })
        .selectTo({ line: 0, col: 4 })
        .moveCursor('right');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 4 });
      expect(buf.getState().selection).toBeNull();
    });

    it('up arrow with selection clears selection and moves up from head', () => {
      const buf = TextBuffer.create('hello\nworld\nfoo')
        .moveCursorTo({ line: 0, col: 2 })
        .selectTo({ line: 1, col: 3 })
        .moveCursor('up');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 3 });
      expect(buf.getState().selection).toBeNull();
    });

    it('down arrow with selection clears selection and moves down from head', () => {
      const buf = TextBuffer.create('hello\nworld\nfoo')
        .moveCursorTo({ line: 2, col: 1 })
        .selectTo({ line: 1, col: 2 })
        .moveCursor('down');
      expect(buf.getState().cursor).toEqual({ line: 2, col: 2 });
      expect(buf.getState().selection).toBeNull();
    });

    it('moveToLineStart with selection clears selection', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 1 })
        .selectTo({ line: 0, col: 4 })
        .moveToLineStart();
      expect(buf.getState().cursor).toEqual({ line: 0, col: 0 });
      expect(buf.getState().selection).toBeNull();
    });

    it('moveToLineEnd with selection clears selection', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 1 })
        .selectTo({ line: 0, col: 3 })
        .moveToLineEnd();
      expect(buf.getState().cursor).toEqual({ line: 0, col: 5 });
      expect(buf.getState().selection).toBeNull();
    });

    it('moveWordLeft with selection clears selection then moves', () => {
      const buf = TextBuffer.create('hello world')
        .moveCursorTo({ line: 0, col: 6 })
        .selectTo({ line: 0, col: 9 })
        .moveWordLeft();
      expect(buf.getState().selection).toBeNull();
      expect(buf.getState().cursor.col).toBe(6);
    });

    it('moveWordRight with selection clears selection then moves', () => {
      const buf = TextBuffer.create('hello world')
        .moveCursorTo({ line: 0, col: 0 })
        .selectTo({ line: 0, col: 3 })
        .moveWordRight();
      expect(buf.getState().selection).toBeNull();
      expect(buf.getState().cursor.col).toBe(6);
    });

    it('all existing tests continue to pass (no selection = unchanged behavior)', () => {
      // This is a meta-test — ensured by all the describe blocks above
      const buf = TextBuffer.create('hello')
        .insertChar('x');
      expect(buf.getText()).toBe('xhello');
    });

    it('reversed selection with left arrow collapses to start', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 4 })
        .selectTo({ line: 0, col: 1 })
        .moveCursor('left');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 1 });
      expect(buf.getState().selection).toBeNull();
    });

    it('reversed selection with right arrow collapses to end', () => {
      const buf = TextBuffer.create('hello')
        .moveCursorTo({ line: 0, col: 4 })
        .selectTo({ line: 0, col: 1 })
        .moveCursor('right');
      expect(buf.getState().cursor).toEqual({ line: 0, col: 4 });
      expect(buf.getState().selection).toBeNull();
    });
  });
});
