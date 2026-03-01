import { describe, it, expect, beforeEach } from 'vitest';
import { getClipboard, setClipboard, resetClipboard } from '../../../src/tui/editor/clipboard.js';

describe('Clipboard', () => {
  beforeEach(() => {
    resetClipboard();
  });

  it('initial clipboard is empty string', () => {
    expect(getClipboard()).toBe('');
  });

  it('setClipboard stores text, getClipboard retrieves it', () => {
    setClipboard('hello');
    expect(getClipboard()).toBe('hello');
  });

  it('setClipboard overwrites previous content', () => {
    setClipboard('first');
    setClipboard('second');
    expect(getClipboard()).toBe('second');
  });

  it('empty string is a valid clipboard value', () => {
    setClipboard('something');
    setClipboard('');
    expect(getClipboard()).toBe('');
  });

  it('stores multi-line text', () => {
    setClipboard('line1\nline2\nline3');
    expect(getClipboard()).toBe('line1\nline2\nline3');
  });
});
