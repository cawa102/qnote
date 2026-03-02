import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatRelativeTime } from '../../src/theme/relative-time.js';

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for times less than 1 minute ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-27T12:00:30+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toBe('just now');
  });

  it('returns "Nm ago" for times less than 1 hour ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-27T12:05:00+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toBe('5m ago');
  });

  it('returns "Nh ago" for times less than 24 hours ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-27T15:00:00+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toBe('3h ago');
  });

  it('returns "yesterday" for times 1 day ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-28T12:00:00+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toBe('yesterday');
  });

  it('returns "Nd ago" for times 2-6 days ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T12:00:00+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toBe('3d ago');
  });

  it('returns "Nw ago" for times 7-29 days ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T12:00:00+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toBe('2w ago');
  });

  it('returns date string for times older than 30 days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toContain('Feb');
    expect(result).toContain('27');
  });
});
