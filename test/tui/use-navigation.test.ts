import { describe, it, expect } from 'vitest';
import { createNavigationStore } from '../../src/tui/hooks/use-navigation.js';
import type { NavigationStore } from '../../src/tui/hooks/use-navigation.js';

describe('NavigationStore', () => {
  it('starts with palette as initial screen', () => {
    const nav = createNavigationStore();
    expect(nav.current().screen).toBe('palette');
  });

  it('pushes a new screen onto the stack', () => {
    const nav = createNavigationStore();
    nav.push('noteList', { filter: 'recent' });
    const entry = nav.current();
    expect(entry.screen).toBe('noteList');
    if (entry.screen === 'noteList') {
      expect(entry.filter).toBe('recent');
    }
  });

  it('pushes without params', () => {
    const nav = createNavigationStore();
    nav.push('search');
    expect(nav.current().screen).toBe('search');
  });

  it('pops back to previous screen', () => {
    const nav = createNavigationStore();
    nav.push('noteList');
    nav.push('notePreview', { filePath: '/a.md' });
    nav.pop();
    expect(nav.current().screen).toBe('noteList');
  });

  it('does not pop past the root', () => {
    const nav = createNavigationStore();
    nav.pop();
    expect(nav.current().screen).toBe('palette');
  });

  it('resets to palette', () => {
    const nav = createNavigationStore();
    nav.push('noteList');
    nav.push('notePreview');
    nav.reset();
    expect(nav.current().screen).toBe('palette');
    expect(nav.stackDepth()).toBe(1);
  });

  it('reports correct stack depth', () => {
    const nav = createNavigationStore();
    expect(nav.stackDepth()).toBe(1);
    nav.push('noteList');
    expect(nav.stackDepth()).toBe(2);
    nav.push('notePreview');
    expect(nav.stackDepth()).toBe(3);
    nav.pop();
    expect(nav.stackDepth()).toBe(2);
  });

  it('notifies subscribers on push', () => {
    const nav = createNavigationStore();
    let called = false;
    nav.subscribe(() => { called = true; });
    nav.push('noteList');
    expect(called).toBe(true);
  });

  it('notifies subscribers on pop', () => {
    const nav = createNavigationStore();
    nav.push('noteList');
    let called = false;
    nav.subscribe(() => { called = true; });
    nav.pop();
    expect(called).toBe(true);
  });

  it('notifies subscribers on reset', () => {
    const nav = createNavigationStore();
    nav.push('noteList');
    let called = false;
    nav.subscribe(() => { called = true; });
    nav.reset();
    expect(called).toBe(true);
  });

  it('unsubscribes correctly', () => {
    const nav = createNavigationStore();
    let callCount = 0;
    const unsubscribe = nav.subscribe(() => { callCount++; });
    nav.push('noteList');
    expect(callCount).toBe(1);
    unsubscribe();
    nav.push('search');
    expect(callCount).toBe(1); // should not have been called again
  });

  it('does not notify on pop when already at root', () => {
    const nav = createNavigationStore();
    let called = false;
    nav.subscribe(() => { called = true; });
    nav.pop();
    expect(called).toBe(false);
  });
});
