import { describe, it, expect } from 'vitest';
import { clampIndex, handleRenameInput } from '../../src/tui/screens/NoteList.js';
import type { RenameState } from '../../src/tui/screens/NoteList.js';

describe('clampIndex', () => {
  it('clamps index within bounds going down', () => {
    expect(clampIndex(0, 1, 5)).toBe(1);
    expect(clampIndex(4, 1, 5)).toBe(4);
  });

  it('clamps index within bounds going up', () => {
    expect(clampIndex(3, -1, 5)).toBe(2);
    expect(clampIndex(0, -1, 5)).toBe(0);
  });

  it('returns 0 for empty list', () => {
    expect(clampIndex(0, 1, 0)).toBe(0);
    expect(clampIndex(0, -1, 0)).toBe(0);
  });
});

describe('handleRenameInput', () => {
  const idle: RenameState = { phase: 'idle' };
  const scopeSelect: RenameState = { phase: 'scopeSelect', scopeIndex: 0 };
  const editing: RenameState = { phase: 'editing', scope: 'all', newTag: 'old-tag' };
  const confirming: RenameState = { phase: 'confirming', scope: 'all', newTag: 'new-tag' };

  // Ctrl+R transitions
  it('Ctrl+R does nothing when no tag prop', () => {
    const result = handleRenameInput(idle, 'r', { ctrl: true }, undefined);
    expect(result).toEqual(idle);
  });

  it('Ctrl+R opens scope selection when tag is set', () => {
    const result = handleRenameInput(idle, 'r', { ctrl: true }, 'old-tag');
    expect(result.phase).toBe('scopeSelect');
  });

  it('Ctrl+R does nothing when already in non-idle phase', () => {
    const result = handleRenameInput(scopeSelect, 'r', { ctrl: true }, 'old-tag');
    expect(result.phase).toBe('scopeSelect');
  });

  // scopeSelect phase
  it('arrow keys toggle scope selection', () => {
    const result = handleRenameInput(scopeSelect, '', { downArrow: true }, 'tag');
    expect(result).toEqual({ phase: 'scopeSelect', scopeIndex: 1 });

    const result2 = handleRenameInput({ phase: 'scopeSelect', scopeIndex: 1 }, '', { upArrow: true }, 'tag');
    expect(result2).toEqual({ phase: 'scopeSelect', scopeIndex: 0 });
  });

  it('Enter in scopeSelect with index 0 enters editing with scope all', () => {
    const result = handleRenameInput(
      { phase: 'scopeSelect', scopeIndex: 0 },
      '', { return: true }, 'old-tag',
    );
    expect(result).toEqual({ phase: 'editing', scope: 'all', newTag: 'old-tag' });
  });

  it('Enter in scopeSelect with index 1 enters editing with scope single', () => {
    const result = handleRenameInput(
      { phase: 'scopeSelect', scopeIndex: 1 },
      '', { return: true }, 'old-tag',
    );
    expect(result).toEqual({ phase: 'editing', scope: 'single', newTag: 'old-tag' });
  });

  it('Esc in scopeSelect returns to idle', () => {
    const result = handleRenameInput(scopeSelect, '', { escape: true }, 'tag');
    expect(result).toEqual(idle);
  });

  // editing phase
  it('Enter in editing goes to confirming', () => {
    const result = handleRenameInput(editing, '', { return: true }, 'old-tag');
    expect(result).toEqual({ phase: 'confirming', scope: 'all', newTag: 'old-tag' });
  });

  it('Esc in editing returns to idle', () => {
    const result = handleRenameInput(editing, '', { escape: true }, 'old-tag');
    expect(result).toEqual(idle);
  });

  // confirming phase
  it('Enter in confirming returns done action', () => {
    const result = handleRenameInput(confirming, '', { return: true }, 'old-tag');
    expect(result).toEqual({ phase: 'done', scope: 'all', newTag: 'new-tag' });
  });

  it('Esc in confirming returns to idle', () => {
    const result = handleRenameInput(confirming, '', { escape: true }, 'old-tag');
    expect(result).toEqual(idle);
  });
});
