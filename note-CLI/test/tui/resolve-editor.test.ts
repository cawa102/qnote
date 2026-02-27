import { describe, it, expect, afterEach } from 'vitest';
import { resolveEditor } from '../../src/tui/utils/resolve-editor.js';

describe('resolveEditor', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns $VISUAL when set and available', () => {
    process.env.VISUAL = 'vi'; // vi should exist on macOS
    const result = resolveEditor();
    expect(result).toBe('vi');
  });

  it('falls back to $EDITOR when $VISUAL is unset', () => {
    delete process.env.VISUAL;
    process.env.EDITOR = 'vi';
    const result = resolveEditor();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('falls back to vi or nano when both env vars are unset', () => {
    delete process.env.VISUAL;
    delete process.env.EDITOR;
    // On most systems, vi or nano should be available
    const result = resolveEditor();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('skips unavailable editors in the chain', () => {
    process.env.VISUAL = 'nonexistent-editor-xyz-123';
    process.env.EDITOR = 'vi'; // vi should exist
    const result = resolveEditor();
    expect(result).toBe('vi');
  });
});
