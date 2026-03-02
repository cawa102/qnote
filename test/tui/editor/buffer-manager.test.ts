import { describe, it, expect } from 'vitest';
import { BufferManager } from '../../../src/tui/editor/buffer-manager.js';
import { TextEditorController } from '../../../src/tui/editor/text-editor.js';
import type { NoteMeta } from '../../../src/types.js';

const makeMeta = (title: string): NoteMeta => ({
  title,
  tags: [],
  created: '2026-01-01T00:00:00+09:00',
  modified: '2026-01-01T00:00:00+09:00',
});

describe('BufferManager', () => {
  describe('create', () => {
    it('creates with no active buffer', () => {
      const mgr = BufferManager.create();
      expect(mgr.getActive()).toBeNull();
      expect(mgr.getBufferInfos()).toEqual([]);
    });
  });

  describe('openBuffer', () => {
    it('opens a buffer and sets it active', () => {
      const mgr = BufferManager.create()
        .openBuffer('/notes/a.md', 'hello', makeMeta('Note A'));
      const active = mgr.getActive();
      expect(active).not.toBeNull();
      expect(active!.id).toBe('/notes/a.md');
      expect(active!.filePath).toBe('/notes/a.md');
      expect(active!.meta.title).toBe('Note A');
      expect(active!.editor.getContent()).toBe('hello');
    });

    it('opening same file path focuses existing buffer', () => {
      const mgr = BufferManager.create()
        .openBuffer('/notes/a.md', 'hello', makeMeta('Note A'))
        .openBuffer('/notes/b.md', 'world', makeMeta('Note B'))
        .openBuffer('/notes/a.md', 'hello', makeMeta('Note A'));
      expect(mgr.getActive()!.id).toBe('/notes/a.md');
      expect(mgr.getBufferInfos()).toHaveLength(2);
    });

    it('opens buffer with cursor at end when cursorAtEnd is true', () => {
      const content = '# Title\n\n';
      const mgr = BufferManager.create()
        .openBuffer('/notes/new.md', content, makeMeta('Title'), true);
      const active = mgr.getActive();
      expect(active).not.toBeNull();
      const state = active!.editor.getBuffer().getState();
      // "# Title\n\n" splits into ["# Title", "", ""] — cursor at line 2, col 0
      expect(state.cursor).toEqual({ line: 2, col: 0 });
    });

    it('opens buffer with cursor at start when cursorAtEnd is false', () => {
      const content = '# Title\n\nSome text';
      const mgr = BufferManager.create()
        .openBuffer('/notes/existing.md', content, makeMeta('Title'), false);
      const active = mgr.getActive();
      const state = active!.editor.getBuffer().getState();
      expect(state.cursor).toEqual({ line: 0, col: 0 });
    });

    it('ignores cursorAtEnd when buffer is already open', () => {
      const mgr = BufferManager.create()
        .openBuffer('/notes/a.md', '# Title\n\n', makeMeta('Title'), false)
        .openBuffer('/notes/a.md', '# Title\n\n', makeMeta('Title'), true);
      const state = mgr.getActive()!.editor.getBuffer().getState();
      expect(state.cursor).toEqual({ line: 0, col: 0 });
    });

    it('tracks multiple buffers', () => {
      const mgr = BufferManager.create()
        .openBuffer('/notes/a.md', 'aaa', makeMeta('A'))
        .openBuffer('/notes/b.md', 'bbb', makeMeta('B'))
        .openBuffer('/notes/c.md', 'ccc', makeMeta('C'));
      expect(mgr.getBufferInfos()).toHaveLength(3);
    });
  });

  describe('closeBuffer', () => {
    it('removes buffer and switches to adjacent', () => {
      const mgr = BufferManager.create()
        .openBuffer('/notes/a.md', 'aaa', makeMeta('A'))
        .openBuffer('/notes/b.md', 'bbb', makeMeta('B'))
        .openBuffer('/notes/c.md', 'ccc', makeMeta('C'))
        .setActive('/notes/b.md')
        .closeBuffer('/notes/b.md');
      expect(mgr.getBufferInfos()).toHaveLength(2);
      expect(mgr.getActive()!.id).not.toBe('/notes/b.md');
    });

    it('closing last buffer returns null active', () => {
      const mgr = BufferManager.create()
        .openBuffer('/notes/a.md', 'aaa', makeMeta('A'))
        .closeBuffer('/notes/a.md');
      expect(mgr.getActive()).toBeNull();
      expect(mgr.getBufferInfos()).toHaveLength(0);
    });
  });

  describe('setActive', () => {
    it('switches active buffer', () => {
      const mgr = BufferManager.create()
        .openBuffer('/notes/a.md', 'aaa', makeMeta('A'))
        .openBuffer('/notes/b.md', 'bbb', makeMeta('B'))
        .setActive('/notes/a.md');
      expect(mgr.getActive()!.id).toBe('/notes/a.md');
    });
  });

  describe('getBufferInfos', () => {
    it('returns BufferInfo array for BufferTabs', () => {
      const mgr = BufferManager.create()
        .openBuffer('/notes/a.md', 'aaa', makeMeta('A'))
        .openBuffer('/notes/b.md', 'bbb', makeMeta('B'));
      const infos = mgr.getBufferInfos();
      expect(infos).toHaveLength(2);
      expect(infos[0]!.id).toBe('/notes/a.md');
      expect(infos[0]!.title).toBe('A');
      expect(infos[0]!.dirty).toBe(false);
    });
  });

  describe('updateEditor', () => {
    it('replaces the editor for a buffer', () => {
      const mgr = BufferManager.create()
        .openBuffer('/notes/a.md', 'hello', makeMeta('A'));
      const newEditor = mgr.getActive()!.editor
        .handleInput('!', { ctrl: false, shift: false, meta: false });
      const updated = mgr.updateEditor('/notes/a.md', newEditor);
      expect(updated.getActive()!.editor.getContent()).toBe('!hello');
      expect(updated.getBufferInfos()[0]!.dirty).toBe(true);
    });
  });

  describe('nextBuffer / prevBuffer', () => {
    it('nextBuffer cycles forward', () => {
      const mgr = BufferManager.create()
        .openBuffer('/notes/a.md', 'aaa', makeMeta('A'))
        .openBuffer('/notes/b.md', 'bbb', makeMeta('B'))
        .openBuffer('/notes/c.md', 'ccc', makeMeta('C'))
        .setActive('/notes/a.md');
      const next = mgr.nextBuffer();
      expect(next.getActive()!.id).toBe('/notes/b.md');
    });

    it('nextBuffer wraps around', () => {
      const mgr = BufferManager.create()
        .openBuffer('/notes/a.md', 'aaa', makeMeta('A'))
        .openBuffer('/notes/b.md', 'bbb', makeMeta('B'))
        .setActive('/notes/b.md');
      const next = mgr.nextBuffer();
      expect(next.getActive()!.id).toBe('/notes/a.md');
    });

    it('prevBuffer cycles backward', () => {
      const mgr = BufferManager.create()
        .openBuffer('/notes/a.md', 'aaa', makeMeta('A'))
        .openBuffer('/notes/b.md', 'bbb', makeMeta('B'))
        .setActive('/notes/b.md');
      const prev = mgr.prevBuffer();
      expect(prev.getActive()!.id).toBe('/notes/a.md');
    });

    it('prevBuffer wraps around', () => {
      const mgr = BufferManager.create()
        .openBuffer('/notes/a.md', 'aaa', makeMeta('A'))
        .openBuffer('/notes/b.md', 'bbb', makeMeta('B'))
        .setActive('/notes/a.md');
      const prev = mgr.prevBuffer();
      expect(prev.getActive()!.id).toBe('/notes/b.md');
    });
  });

  describe('hasUnsaved', () => {
    it('returns false when all buffers clean', () => {
      const mgr = BufferManager.create()
        .openBuffer('/notes/a.md', 'aaa', makeMeta('A'));
      expect(mgr.hasUnsaved()).toBe(false);
    });

    it('returns true when any buffer is dirty', () => {
      const mgr = BufferManager.create()
        .openBuffer('/notes/a.md', 'hello', makeMeta('A'));
      const newEditor = mgr.getActive()!.editor
        .handleInput('x', { ctrl: false, shift: false, meta: false });
      const updated = mgr.updateEditor('/notes/a.md', newEditor);
      expect(updated.hasUnsaved()).toBe(true);
    });
  });

  describe('immutability', () => {
    it('openBuffer returns new instance', () => {
      const mgr1 = BufferManager.create();
      const mgr2 = mgr1.openBuffer('/notes/a.md', 'aaa', makeMeta('A'));
      expect(mgr1).not.toBe(mgr2);
      expect(mgr1.getActive()).toBeNull();
      expect(mgr2.getActive()).not.toBeNull();
    });
  });
});
