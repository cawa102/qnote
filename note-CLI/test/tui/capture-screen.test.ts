import { describe, it, expect } from 'vitest';
import { buildCaptureSlug } from '../../src/tui/screens/CaptureScreen.js';

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
