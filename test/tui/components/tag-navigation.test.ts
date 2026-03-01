import { describe, it, expect } from 'vitest';
import { handleTagKey, deleteTag } from '../../../src/tui/components/tag-navigation.js';

describe('handleTagKey', () => {
  describe('left arrow', () => {
    it('selects last tag when at input position (cursor === tagCount)', () => {
      expect(handleTagKey('left', 3, 3, true)).toEqual({ type: 'select', index: 2 });
    });

    it('returns noop when no tags exist', () => {
      expect(handleTagKey('left', 0, 0, true)).toEqual({ type: 'noop' });
    });

    it('returns noop when already at first tag', () => {
      expect(handleTagKey('left', 3, 0, true)).toEqual({ type: 'noop' });
    });

    it('selects previous tag', () => {
      expect(handleTagKey('left', 3, 2, true)).toEqual({ type: 'select', index: 1 });
    });
  });

  describe('right arrow', () => {
    it('selects next tag', () => {
      expect(handleTagKey('right', 3, 1, true)).toEqual({ type: 'select', index: 2 });
    });

    it('moves to input when at last tag', () => {
      expect(handleTagKey('right', 3, 2, true)).toEqual({ type: 'select', index: 3 });
    });

    it('returns noop when already at input position', () => {
      expect(handleTagKey('right', 3, 3, true)).toEqual({ type: 'noop' });
    });
  });

  describe('backspace', () => {
    it('deletes selected tag', () => {
      expect(handleTagKey('backspace', 3, 1, true)).toEqual({ type: 'delete', index: 1 });
    });

    it('selects last tag when at input with empty input', () => {
      expect(handleTagKey('backspace', 3, 3, true)).toEqual({ type: 'select', index: 2 });
    });

    it('returns noop when at input with non-empty input', () => {
      expect(handleTagKey('backspace', 3, 3, false)).toEqual({ type: 'noop' });
    });

    it('returns noop when no tags and at input', () => {
      expect(handleTagKey('backspace', 0, 0, true)).toEqual({ type: 'noop' });
    });
  });

  describe('unknown key', () => {
    it('returns noop', () => {
      expect(handleTagKey('a', 3, 1, true)).toEqual({ type: 'noop' });
    });
  });
});

describe('deleteTag', () => {
  it('deletes middle tag and keeps cursor at same index', () => {
    const result = deleteTag(['a', 'b', 'c'], 1);
    expect(result).toEqual({ tags: ['a', 'c'], cursor: 1 });
  });

  it('deletes first tag and keeps cursor at 0', () => {
    const result = deleteTag(['a', 'b', 'c'], 0);
    expect(result).toEqual({ tags: ['b', 'c'], cursor: 0 });
  });

  it('deletes last tag and clamps cursor to new length (input position)', () => {
    const result = deleteTag(['a', 'b', 'c'], 2);
    expect(result).toEqual({ tags: ['a', 'b'], cursor: 2 });
  });

  it('deletes sole tag and moves cursor to input position', () => {
    const result = deleteTag(['a'], 0);
    expect(result).toEqual({ tags: [], cursor: 0 });
  });
});
