import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatRelativeTime } from '../../src/theme/relative-time.js';

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "たった今" for times less than 1 minute ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-27T12:00:30+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toBe('たった今');
  });

  it('returns "N分前" for times less than 1 hour ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-27T12:05:00+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toBe('5分前');
  });

  it('returns "N時間前" for times less than 24 hours ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-27T15:00:00+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toBe('3時間前');
  });

  it('returns "昨日" for times 1 day ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-28T12:00:00+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toBe('昨日');
  });

  it('returns "N日前" for times 2-6 days ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T12:00:00+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toBe('3日前');
  });

  it('returns "N週間前" for times 7-29 days ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T12:00:00+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toBe('2週間前');
  });

  it('returns date string for times older than 30 days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00+09:00'));
    const result = formatRelativeTime('2026-02-27T12:00:00+09:00');
    expect(result).toContain('Feb');
    expect(result).toContain('27');
  });
});
