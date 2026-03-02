import { TextEditorController } from './text-editor.js';
import type { BufferInfo } from './types.js';
import type { NoteMeta } from '../../types.js';

interface BufferEntry {
  readonly id: string;
  readonly filePath: string;
  readonly editor: TextEditorController;
  readonly meta: NoteMeta;
}

export class BufferManager {
  private readonly _buffers: readonly BufferEntry[];
  private readonly _activeId: string | null;

  private constructor(buffers: readonly BufferEntry[], activeId: string | null) {
    this._buffers = buffers;
    this._activeId = activeId;
  }

  static create(): BufferManager {
    return new BufferManager([], null);
  }

  openBuffer(filePath: string, content: string, meta: NoteMeta, cursorAtEnd?: boolean): BufferManager {
    // If already open, just focus it
    const existing = this._buffers.find((b) => b.id === filePath);
    if (existing) {
      return new BufferManager(this._buffers, filePath);
    }

    const editor = cursorAtEnd
      ? TextEditorController.createWithCursorAtEnd(content)
      : TextEditorController.create(content);
    const entry: BufferEntry = {
      id: filePath,
      filePath,
      editor,
      meta,
    };
    return new BufferManager([...this._buffers, entry], filePath);
  }

  closeBuffer(id: string): BufferManager {
    const index = this._buffers.findIndex((b) => b.id === id);
    if (index < 0) {
      return this;
    }

    const newBuffers = [
      ...this._buffers.slice(0, index),
      ...this._buffers.slice(index + 1),
    ];

    if (newBuffers.length === 0) {
      return new BufferManager(newBuffers, null);
    }

    // If closing active buffer, switch to adjacent
    let newActiveId = this._activeId;
    if (this._activeId === id) {
      const newIndex = Math.min(index, newBuffers.length - 1);
      newActiveId = newBuffers[newIndex]!.id;
    }

    return new BufferManager(newBuffers, newActiveId);
  }

  getActive(): BufferEntry | null {
    if (this._activeId === null) {
      return null;
    }
    const entry = this._buffers.find((b) => b.id === this._activeId);
    if (!entry) {
      return null;
    }
    return {
      id: entry.id,
      filePath: entry.filePath,
      editor: entry.editor,
      meta: entry.meta,
    };
  }

  setActive(id: string): BufferManager {
    const exists = this._buffers.some((b) => b.id === id);
    if (!exists) {
      return this;
    }
    return new BufferManager(this._buffers, id);
  }

  getBufferInfos(): readonly BufferInfo[] {
    return this._buffers.map((b) => ({
      id: b.id,
      filePath: b.filePath,
      title: b.meta.title,
      dirty: b.editor.isDirty(),
    }));
  }

  updateEditor(id: string, editor: TextEditorController): BufferManager {
    const newBuffers = this._buffers.map((b) =>
      b.id === id ? { ...b, editor } : b,
    );
    return new BufferManager(newBuffers, this._activeId);
  }

  nextBuffer(): BufferManager {
    if (this._buffers.length <= 1 || this._activeId === null) {
      return this;
    }
    const currentIndex = this._buffers.findIndex((b) => b.id === this._activeId);
    const nextIndex = (currentIndex + 1) % this._buffers.length;
    return new BufferManager(this._buffers, this._buffers[nextIndex]!.id);
  }

  prevBuffer(): BufferManager {
    if (this._buffers.length <= 1 || this._activeId === null) {
      return this;
    }
    const currentIndex = this._buffers.findIndex((b) => b.id === this._activeId);
    const prevIndex = (currentIndex - 1 + this._buffers.length) % this._buffers.length;
    return new BufferManager(this._buffers, this._buffers[prevIndex]!.id);
  }

  hasUnsaved(): boolean {
    return this._buffers.some((b) => b.editor.isDirty());
  }
}
