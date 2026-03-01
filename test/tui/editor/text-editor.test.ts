import { describe, it, expect } from 'vitest';
import { TextEditorController } from '../../../src/tui/editor/text-editor.js';
import type { KeyInfo } from '../../../src/tui/editor/text-editor.js';

const plain = (input: string): KeyInfo => ({
  ctrl: false,
  shift: false,
  meta: false,
});

const key = (name: string, mods?: Partial<KeyInfo>): KeyInfo => ({
  ctrl: false,
  shift: false,
  meta: false,
  name,
  ...mods,
});

describe('TextEditorController', () => {
  describe('create', () => {
    it('creates from initial content', () => {
      const ctrl = TextEditorController.create('hello');
      expect(ctrl.getContent()).toBe('hello');
      expect(ctrl.isDirty()).toBe(false);
    });
  });

  describe('plain character input', () => {
    it('inserts character via insertChar', () => {
      const ctrl = TextEditorController.create('')
        .handleInput('a', plain('a'));
      expect(ctrl.getContent()).toBe('a');
      expect(ctrl.isDirty()).toBe(true);
    });

    it('inserts multiple characters', () => {
      let ctrl = TextEditorController.create('');
      for (const ch of 'abc') {
        ctrl = ctrl.handleInput(ch, plain(ch));
      }
      expect(ctrl.getContent()).toBe('abc');
    });
  });

  describe('Enter / newline', () => {
    it('inserts newline on Enter', () => {
      const ctrl = TextEditorController.create('hello')
        .handleInput('', key('return'));
      expect(ctrl.getContent()).toBe('\nhello');
    });

    it('list continuation: Enter on "- hello" inserts "- " on next line', () => {
      let ctrl = TextEditorController.create('');
      // Type "- hello"
      for (const ch of '- hello') {
        ctrl = ctrl.handleInput(ch, plain(ch));
      }
      // Press Enter
      ctrl = ctrl.handleInput('', key('return'));
      expect(ctrl.getContent()).toBe('- hello\n- ');
    });

    it('list continuation: Enter on empty list item "- " removes prefix', () => {
      let ctrl = TextEditorController.create('');
      // Type "- "
      for (const ch of '- ') {
        ctrl = ctrl.handleInput(ch, plain(ch));
      }
      // Press Enter on empty list item
      ctrl = ctrl.handleInput('', key('return'));
      expect(ctrl.getContent()).toBe('\n');
    });

    it('list continuation: Enter on "* item" inserts "* "', () => {
      let ctrl = TextEditorController.create('');
      for (const ch of '* item') {
        ctrl = ctrl.handleInput(ch, plain(ch));
      }
      ctrl = ctrl.handleInput('', key('return'));
      expect(ctrl.getContent()).toBe('* item\n* ');
    });

    it('list continuation: numbered list increments number', () => {
      let ctrl = TextEditorController.create('');
      for (const ch of '1. first') {
        ctrl = ctrl.handleInput(ch, plain(ch));
      }
      ctrl = ctrl.handleInput('', key('return'));
      expect(ctrl.getContent()).toBe('1. first\n2. ');
    });
  });

  describe('Backspace', () => {
    it('deletes character backward', () => {
      const ctrl = TextEditorController.create('abc')
        .handleInput('', key('end'))  // move to end
        .handleInput('', key('backspace'));
      expect(ctrl.getContent()).toBe('ab');
    });
  });

  describe('Delete', () => {
    it('deletes character forward via name', () => {
      const ctrl = TextEditorController.create('abc')
        .handleInput('', key('delete'));
      expect(ctrl.getContent()).toBe('bc');
    });

    it('deletes character forward via Ctrl+D', () => {
      const ctrl = TextEditorController.create('abc')
        .handleInput('d', key('d', { ctrl: true }));
      expect(ctrl.getContent()).toBe('bc');
    });

    it('Ctrl+D merges with next line at end of line', () => {
      const ctrl = TextEditorController.create('abc\ndef')
        .handleInput('', key('end'))
        .handleInput('d', key('d', { ctrl: true }));
      expect(ctrl.getContent()).toBe('abcdef');
    });
  });

  describe('Arrow keys', () => {
    it('moves cursor with arrow keys', () => {
      const ctrl = TextEditorController.create('hello')
        .handleInput('', key('right'))
        .handleInput('', key('right'));
      expect(ctrl.getBuffer().getState().cursor.col).toBe(2);
    });

    it('up/down moves between lines', () => {
      const ctrl = TextEditorController.create('aaa\nbbb')
        .handleInput('', key('down'));
      expect(ctrl.getBuffer().getState().cursor.line).toBe(1);
    });
  });

  describe('Home / End', () => {
    it('Home moves to line start', () => {
      const ctrl = TextEditorController.create('hello')
        .handleInput('', key('right'))
        .handleInput('', key('right'))
        .handleInput('', key('home'));
      expect(ctrl.getBuffer().getState().cursor.col).toBe(0);
    });

    it('End moves to line end', () => {
      const ctrl = TextEditorController.create('hello')
        .handleInput('', key('end'));
      expect(ctrl.getBuffer().getState().cursor.col).toBe(5);
    });
  });

  describe('Ctrl+Left / Ctrl+Right (no word movement — handled by Option+Arrow)', () => {
    it('Ctrl+Right is no-op (word movement is Option+Right)', () => {
      const ctrl = TextEditorController.create('hello world')
        .handleInput('', key('right', { ctrl: true }));
      // Ctrl+Arrow is not bound — cursor stays at start
      expect(ctrl.getBuffer().getState().cursor.col).toBe(0);
    });

    it('Ctrl+Left is no-op (word movement is Option+Left)', () => {
      const ctrl = TextEditorController.create('hello world')
        .handleInput('', key('end'))
        .handleInput('', key('left', { ctrl: true }));
      // Ctrl+Arrow is not bound — cursor stays at end
      expect(ctrl.getBuffer().getState().cursor.col).toBe(11);
    });
  });

  describe('Tab / Shift+Tab', () => {
    it('Tab indents', () => {
      const ctrl = TextEditorController.create('hello')
        .handleInput('', key('tab'));
      expect(ctrl.getContent()).toBe('  hello');
    });

    it('Shift+Tab unindents', () => {
      const ctrl = TextEditorController.create('  hello')
        .handleInput('', key('tab', { shift: true }));
      expect(ctrl.getContent()).toBe('hello');
    });
  });

  describe('Markdown shortcuts', () => {
    it('Ctrl+B wraps with ** (bold)', () => {
      const ctrl = TextEditorController.create('')
        .handleInput('b', key('b', { ctrl: true }));
      expect(ctrl.getContent()).toBe('****');
    });

    it('Option+I wraps with * (italic) — Ctrl+I sends Tab on Mac', () => {
      const ctrl = TextEditorController.create('')
        .handleInput('i', key('i', { meta: true }));
      expect(ctrl.getContent()).toBe('**');
    });

    it('Ctrl+K inserts link template', () => {
      const ctrl = TextEditorController.create('')
        .handleInput('k', key('k', { ctrl: true }));
      expect(ctrl.getContent()).toBe('[](url)');
    });

    it('Ctrl+Shift+K deletes current line', () => {
      const ctrl = TextEditorController.create('aaa\nbbb\nccc')
        .handleInput('', key('down'))
        .handleInput('k', key('k', { ctrl: true, shift: true }));
      expect(ctrl.getContent()).toBe('aaa\nccc');
    });
  });

  describe('Undo / Redo', () => {
    it('Ctrl+Z undoes last change', () => {
      const ctrl = TextEditorController.create('hello')
        .handleInput('', key('end'))
        .handleInput('!', plain('!'))
        .handleInput('z', key('z', { ctrl: true }));
      expect(ctrl.getContent()).toBe('hello');
    });

    it('Ctrl+Y redoes after undo', () => {
      const ctrl = TextEditorController.create('hello')
        .handleInput('', key('end'))
        .handleInput('!', plain('!'))
        .handleInput('z', key('z', { ctrl: true }))
        .handleInput('y', key('y', { ctrl: true }));
      expect(ctrl.getContent()).toBe('hello!');
    });
  });

  describe('isDirty / markClean', () => {
    it('isDirty returns false initially', () => {
      expect(TextEditorController.create('hello').isDirty()).toBe(false);
    });

    it('isDirty returns true after edit', () => {
      const ctrl = TextEditorController.create('hello')
        .handleInput('x', plain('x'));
      expect(ctrl.isDirty()).toBe(true);
    });

    it('markClean resets dirty flag', () => {
      const ctrl = TextEditorController.create('hello')
        .handleInput('x', plain('x'))
        .markClean();
      expect(ctrl.isDirty()).toBe(false);
    });
  });

  describe('key modifier distinction', () => {
    it('plain "b" inserts character, Ctrl+B wraps bold', () => {
      const inserted = TextEditorController.create('')
        .handleInput('b', plain('b'));
      expect(inserted.getContent()).toBe('b');

      const bold = TextEditorController.create('')
        .handleInput('b', key('b', { ctrl: true }));
      expect(bold.getContent()).toBe('****');
    });
  });

  describe('immutability', () => {
    it('handleInput returns a new instance', () => {
      const ctrl1 = TextEditorController.create('hello');
      const ctrl2 = ctrl1.handleInput('x', plain('x'));
      expect(ctrl1).not.toBe(ctrl2);
      expect(ctrl1.getContent()).toBe('hello');
      expect(ctrl2.getContent()).toBe('xhello');
    });
  });

  describe('Shift+Arrow selection', () => {
    it('Shift+Left creates selection left', () => {
      const ctrl = TextEditorController.create('hello')
        .handleInput('', key('end'))
        .handleInput('', key('left', { shift: true }));
      const sel = ctrl.getBuffer().getState().selection;
      expect(sel).toEqual({
        anchor: { line: 0, col: 5 },
        head: { line: 0, col: 4 },
      });
    });

    it('Shift+Right creates selection right', () => {
      const ctrl = TextEditorController.create('hello')
        .handleInput('', key('right', { shift: true }));
      const sel = ctrl.getBuffer().getState().selection;
      expect(sel).toEqual({
        anchor: { line: 0, col: 0 },
        head: { line: 0, col: 1 },
      });
    });

    it('Shift+Up extends selection vertically', () => {
      const ctrl = TextEditorController.create('hello\nworld')
        .handleInput('', key('down'))
        .handleInput('', key('up', { shift: true }));
      const sel = ctrl.getBuffer().getState().selection;
      expect(sel).not.toBeNull();
      expect(sel!.head.line).toBe(0);
    });

    it('Shift+Down extends selection vertically', () => {
      const ctrl = TextEditorController.create('hello\nworld')
        .handleInput('', key('down', { shift: true }));
      const sel = ctrl.getBuffer().getState().selection;
      expect(sel).not.toBeNull();
      expect(sel!.head.line).toBe(1);
    });

    it('Shift+Home selects to line start', () => {
      const ctrl = TextEditorController.create('hello')
        .handleInput('', key('end'))
        .handleInput('', key('home', { shift: true }));
      const sel = ctrl.getBuffer().getState().selection;
      expect(sel).toEqual({
        anchor: { line: 0, col: 5 },
        head: { line: 0, col: 0 },
      });
    });

    it('Shift+End selects to line end', () => {
      const ctrl = TextEditorController.create('hello')
        .handleInput('', key('end', { shift: true }));
      const sel = ctrl.getBuffer().getState().selection;
      expect(sel).toEqual({
        anchor: { line: 0, col: 0 },
        head: { line: 0, col: 5 },
      });
    });
  });

  describe('Ctrl+Shift word selection (removed — handled by Option+Shift+Arrow)', () => {
    it('Ctrl+Shift+Left is no-op (word selection is Option+Shift+Left)', () => {
      const ctrl = TextEditorController.create('hello world')
        .handleInput('', key('end'))
        .handleInput('', key('left', { ctrl: true, shift: true }));
      // Ctrl+Shift+Arrow is not bound — no selection created
      const sel = ctrl.getBuffer().getState().selection;
      expect(sel).toBeNull();
    });

    it('Ctrl+Shift+Right is no-op (word selection is Option+Shift+Right)', () => {
      const ctrl = TextEditorController.create('hello world')
        .handleInput('', key('right', { ctrl: true, shift: true }));
      // Ctrl+Shift+Arrow is not bound — no selection created
      const sel = ctrl.getBuffer().getState().selection;
      expect(sel).toBeNull();
    });
  });

  describe('Ctrl+A (select all)', () => {
    it('Ctrl+A selects entire document', () => {
      const ctrl = TextEditorController.create('hello\nworld')
        .handleInput('a', key('a', { ctrl: true }));
      const sel = ctrl.getBuffer().getState().selection;
      expect(sel).toEqual({
        anchor: { line: 0, col: 0 },
        head: { line: 1, col: 5 },
      });
    });
  });

  describe('Clipboard operations (Option key — Ctrl+C sends SIGINT on Mac)', () => {
    it('Option+C copies selected text to clipboard', () => {
      const ctrl = TextEditorController.create('hello world')
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('c', key('c', { meta: true }));
      // Selection should remain after copy
      expect(ctrl.getBuffer().getState().selection).not.toBeNull();
      // Content unchanged
      expect(ctrl.getContent()).toBe('hello world');
    });

    it('Option+C with no selection is a no-op', () => {
      const ctrl = TextEditorController.create('hello')
        .handleInput('c', key('c', { meta: true }));
      expect(ctrl.getContent()).toBe('hello');
    });

    it('Option+X cuts selected text', () => {
      const ctrl = TextEditorController.create('hello world')
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('x', key('x', { meta: true }));
      expect(ctrl.getContent()).toBe(' world');
    });

    it('Option+V pastes clipboard at cursor', () => {
      // Select "hello", copy, move to end, paste
      const ctrl = TextEditorController.create('hello world')
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('c', key('c', { meta: true }))
        .handleInput('', key('end'))
        .handleInput('v', key('v', { meta: true }));
      expect(ctrl.getContent()).toBe('hello worldhello');
    });

    it('Option+V with selection replaces selection with clipboard', () => {
      // Select "hello", copy, then select " world", paste
      const ctrl = TextEditorController.create('hello world')
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('c', key('c', { meta: true }))
        // Move right to deselect, then select " world"
        .handleInput('', key('right'))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('v', key('v', { meta: true }));
      expect(ctrl.getContent()).toBe('hellohello');
    });
  });

  describe('Meta(Option) key bindings', () => {
    it('Meta+Left moves word left', () => {
      const ctrl = TextEditorController.create('hello world')
        .handleInput('', key('end'))
        .handleInput('', key('left', { meta: true }));
      expect(ctrl.getBuffer().getState().cursor.col).toBe(6);
    });

    it('Meta+Right moves word right', () => {
      const ctrl = TextEditorController.create('hello world')
        .handleInput('', key('right', { meta: true }));
      expect(ctrl.getBuffer().getState().cursor.col).toBe(6);
    });

    it('Meta+Up moves to doc start', () => {
      const ctrl = TextEditorController.create('hello\nworld')
        .handleInput('', key('down'))
        .handleInput('', key('up', { meta: true }));
      expect(ctrl.getBuffer().getState().cursor).toEqual({ line: 0, col: 0 });
    });

    it('Meta+Down moves to doc end', () => {
      const ctrl = TextEditorController.create('hello\nworld')
        .handleInput('', key('down', { meta: true }));
      expect(ctrl.getBuffer().getState().cursor).toEqual({ line: 1, col: 5 });
    });

    it('Meta+Shift+Left selects word left', () => {
      const ctrl = TextEditorController.create('hello world')
        .handleInput('', key('end'))
        .handleInput('', key('left', { meta: true, shift: true }));
      expect(ctrl.getBuffer().getState().selection).toEqual({
        anchor: { line: 0, col: 11 },
        head: { line: 0, col: 6 },
      });
    });

    it('Meta+Shift+Right selects word right', () => {
      const ctrl = TextEditorController.create('hello world')
        .handleInput('', key('right', { meta: true, shift: true }));
      expect(ctrl.getBuffer().getState().selection).toEqual({
        anchor: { line: 0, col: 0 },
        head: { line: 0, col: 6 },
      });
    });

    it('Meta+A selects all', () => {
      const ctrl = TextEditorController.create('hello\nworld')
        .handleInput('a', key('a', { meta: true }));
      const sel = ctrl.getBuffer().getState().selection;
      expect(sel).toEqual({
        anchor: { line: 0, col: 0 },
        head: { line: 1, col: 5 },
      });
    });

    it('Meta+B wraps with ** (bold)', () => {
      const ctrl = TextEditorController.create('')
        .handleInput('b', key('b', { meta: true }));
      expect(ctrl.getContent()).toBe('****');
    });

    it('Meta+I wraps with * (italic)', () => {
      const ctrl = TextEditorController.create('')
        .handleInput('i', key('i', { meta: true }));
      expect(ctrl.getContent()).toBe('**');
    });
  });

  describe('Selection-aware input', () => {
    it('Character input replaces selection', () => {
      const ctrl = TextEditorController.create('hello')
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('X', plain('X'));
      expect(ctrl.getContent()).toBe('Xlo');
    });

    it('Backspace with selection deletes entire selection', () => {
      const ctrl = TextEditorController.create('hello')
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('backspace'));
      expect(ctrl.getContent()).toBe('lo');
    });

    it('Enter with selection deletes selection then inserts newline', () => {
      const ctrl = TextEditorController.create('hello')
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('right', { shift: true }))
        .handleInput('', key('return'));
      expect(ctrl.getContent()).toBe('\nllo');
    });
  });

  describe('existing keybindings preserved', () => {
    it('Ctrl+B still wraps bold', () => {
      const ctrl = TextEditorController.create('')
        .handleInput('b', key('b', { ctrl: true }));
      expect(ctrl.getContent()).toBe('****');
    });

    it('Option+I wraps italic (Ctrl+I sends Tab on Mac)', () => {
      const ctrl = TextEditorController.create('')
        .handleInput('i', key('i', { meta: true }));
      expect(ctrl.getContent()).toBe('**');
    });

    it('Ctrl+Z still undoes', () => {
      const ctrl = TextEditorController.create('hello')
        .handleInput('', key('end'))
        .handleInput('!', plain('!'))
        .handleInput('z', key('z', { ctrl: true }));
      expect(ctrl.getContent()).toBe('hello');
    });
  });
});
