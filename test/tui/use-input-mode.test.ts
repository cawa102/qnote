import { describe, it, expect } from 'vitest';
import { createInputModeStore } from '../../src/tui/hooks/use-input-mode.js';

describe('InputModeStore', () => {
  it('starts in navigation mode', () => {
    const store = createInputModeStore();
    expect(store.current()).toBe('navigation');
  });

  it('switches to text mode', () => {
    const store = createInputModeStore();
    store.set('text');
    expect(store.current()).toBe('text');
  });

  it('switches back to navigation mode', () => {
    const store = createInputModeStore();
    store.set('text');
    store.set('navigation');
    expect(store.current()).toBe('navigation');
  });

  it('notifies subscribers on change', () => {
    const store = createInputModeStore();
    let notified = false;
    store.subscribe(() => {
      notified = true;
    });
    store.set('text');
    expect(notified).toBe(true);
  });

  it('unsubscribe stops notifications', () => {
    const store = createInputModeStore();
    let count = 0;
    const unsub = store.subscribe(() => {
      count++;
    });
    store.set('text');
    unsub();
    store.set('navigation');
    expect(count).toBe(1);
  });

  it('does not notify when setting same mode', () => {
    const store = createInputModeStore();
    let count = 0;
    store.subscribe(() => {
      count++;
    });
    store.set('navigation'); // same as initial
    expect(count).toBe(0);
  });
});
