import { describe, it, expect } from 'vitest';
import { clampIndex } from '../../src/tui/screens/NoteList.js';

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
