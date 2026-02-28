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

  describe('Ctrl+Left / Ctrl+Right (word movement)', () => {
    it('Ctrl+Right moves to next word', () => {
      const ctrl = TextEditorController.create('hello world')
        .handleInput('', key('right', { ctrl: true }));
      expect(ctrl.getBuffer().getState().cursor.col).toBe(6);
    });

    it('Ctrl+Left moves to previous word', () => {
      const ctrl = TextEditorController.create('hello world')
        .handleInput('', key('end'))
        .handleInput('', key('left', { ctrl: true }));
      expect(ctrl.getBuffer().getState().cursor.col).toBe(6);
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

    it('Ctrl+I wraps with * (italic)', () => {
      const ctrl = TextEditorController.create('')
        .handleInput('i', key('i', { ctrl: true }));
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
});
