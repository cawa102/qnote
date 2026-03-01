import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from 'ink-testing-library';
import { Box } from 'ink';
import { buildCaptureSlug, CaptureScreen } from '../../src/tui/screens/CaptureScreen.js';
import { createInputModeStore } from '../../src/tui/hooks/use-input-mode.js';
import { LayoutProvider } from '../../src/tui/hooks/layout-context.js';
import type { NoteService } from '../../src/core/note-service.js';
import type { NavigationStore } from '../../src/tui/hooks/use-navigation.js';

const ENTER = '\r';
const TAB = '\t';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMockNav(): NavigationStore & { calls: { method: string; args: unknown[] }[] } {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    current: () => ({ screen: 'capture' as const }),
    push: (...args: unknown[]) => { calls.push({ method: 'push', args }); },
    pop: () => { calls.push({ method: 'pop', args: [] }); },
    reset: () => { calls.push({ method: 'reset', args: [] }); },
    stackDepth: () => 1,
    subscribe: () => () => {},
  };
}

function createMockNoteService(
  createResult = { filePath: '/tmp/test.md', slug: 'test' },
): { service: NoteService; createCalls: unknown[][] } {
  const createCalls: unknown[][] = [];
  const service = {
    create: vi.fn((...args: unknown[]) => {
      createCalls.push(args);
      return Promise.resolve(createResult);
    }),
  } as unknown as NoteService;
  return { service, createCalls };
}

function renderCapture(overrides: {
  noteService?: NoteService;
  nav?: NavigationStore;
} = {}) {
  const inputMode = createInputModeStore();
  const mockNav = createMockNav();
  const { service, createCalls } = createMockNoteService();

  const instance = render(
    React.createElement(
      LayoutProvider,
      null,
      React.createElement(
        Box,
        { flexDirection: 'column' as const, width: 80, height: 24 },
        React.createElement(CaptureScreen, {
          noteService: overrides.noteService ?? service,
          nav: overrides.nav ?? mockNav,
          inputMode,
          captureDir: '/tmp/notes/quick',
        }),
      ),
    ),
  );

  return { ...instance, inputMode, nav: mockNav, createCalls, service };
}

afterEach(() => {
  cleanup();
});

describe('buildCaptureSlug', () => {
  it('slugifies a simple English title', () => {
    const slug = buildCaptureSlug('My Quick Note');
    expect(slug).toBe('my-quick-note');
  });

  it('slugifies a CJK title preserving characters', () => {
    const slug = buildCaptureSlug('認証フローのメモ');
    expect(slug).toContain('認証フロー');
  });

  it('returns timestamp fallback when title is empty', () => {
    const slug = buildCaptureSlug('');
    // Should match pattern: capture-YYYY-MM-DD-HHMMSS
    expect(slug).toMatch(/^capture-\d{4}-\d{2}-\d{2}-\d{6}$/);
  });

  it('returns timestamp fallback when title is only symbols', () => {
    const slug = buildCaptureSlug('!!!@@@###');
    expect(slug).toMatch(/^capture-\d{4}-\d{2}-\d{2}-\d{6}$/);
  });

  it('handles mixed CJK and Latin characters', () => {
    const slug = buildCaptureSlug('API認証の設計');
    expect(slug).toContain('api');
    expect(slug).toContain('認証');
  });

  it('collapses multiple dashes', () => {
    const slug = buildCaptureSlug('hello   world');
    expect(slug).toBe('hello-world');
  });

  it('trims leading and trailing dashes', () => {
    const slug = buildCaptureSlug(' -hello- ');
    expect(slug).toBe('hello');
  });

  it('truncates long slugs to 200 characters', () => {
    const longTitle = 'a'.repeat(300);
    const slug = buildCaptureSlug(longTitle);
    expect(slug.length).toBeLessThanOrEqual(200);
  });
});

describe('CaptureScreen two-phase input', () => {
  it('Enter in title phase does NOT save immediately', async () => {
    const { stdin, createCalls } = renderCapture();
    await delay(50);

    // Press Enter while in title phase
    stdin.write(ENTER);
    await delay(50);

    // Should NOT have called create yet — should advance to body phase
    expect(createCalls.length).toBe(0);
  });

  it('Enter in body phase saves note', async () => {
    const { stdin, createCalls } = renderCapture();
    await delay(50);

    // Type title
    stdin.write('Test Title');
    await delay(50);

    // Enter to advance to body phase
    stdin.write(ENTER);
    await delay(50);

    // Type body
    stdin.write('Some body text');
    await delay(50);

    // Enter to save
    stdin.write(ENTER);
    await delay(100);

    expect(createCalls.length).toBe(1);
    const args = createCalls[0]![0] as Record<string, unknown>;
    expect(args.content).toBe('Some body text');
  });

  it('Enter with empty body saves note with empty content', async () => {
    const { stdin, createCalls } = renderCapture();
    await delay(50);

    // Type title
    stdin.write('Title Only');
    await delay(50);

    // Enter to advance to body phase
    stdin.write(ENTER);
    await delay(50);

    // Enter again immediately (empty body)
    stdin.write(ENTER);
    await delay(100);

    expect(createCalls.length).toBe(1);
    const args = createCalls[0]![0] as Record<string, unknown>;
    expect(args.content).toBe('');
  });

  it('saved note has tags: ["quick"]', async () => {
    const { stdin, createCalls } = renderCapture();
    await delay(50);

    stdin.write('Tagged Note');
    await delay(50);
    stdin.write(ENTER);
    await delay(50);
    stdin.write(ENTER);
    await delay(100);

    expect(createCalls.length).toBe(1);
    const args = createCalls[0]![0] as Record<string, unknown>;
    expect(args.tags).toEqual(['quick']);
  });

  it('Tab from title phase creates note and navigates to editor', async () => {
    const { stdin, createCalls, nav } = renderCapture();
    await delay(50);

    stdin.write('Tab Test');
    await delay(50);
    stdin.write(TAB);
    await delay(100);

    expect(createCalls.length).toBe(1);
    const args = createCalls[0]![0] as Record<string, unknown>;
    expect(args.tags).toEqual(['quick']);
    // Should have navigated: pop then push to editor
    const pushCall = nav.calls.find((c) => c.method === 'push');
    expect(pushCall).toBeDefined();
    expect(pushCall!.args[0]).toBe('editor');
  });

  it('Tab from body phase creates note with body and navigates to editor', async () => {
    const { stdin, createCalls, nav } = renderCapture();
    await delay(50);

    stdin.write('Tab Body Test');
    await delay(50);
    stdin.write(ENTER);
    await delay(50);
    stdin.write('Body content');
    await delay(50);
    stdin.write(TAB);
    await delay(100);

    expect(createCalls.length).toBe(1);
    const args = createCalls[0]![0] as Record<string, unknown>;
    expect(args.tags).toEqual(['quick']);
    const pushCall = nav.calls.find((c) => c.method === 'push');
    expect(pushCall).toBeDefined();
    expect(pushCall!.args[0]).toBe('editor');
  });
});
