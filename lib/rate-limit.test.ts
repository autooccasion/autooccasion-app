import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit } from './rate-limit';

// We test the in-memory limiter by using unique keys per test to avoid
// shared state between test cases.

describe('checkRateLimit', () => {
  it('allows the first request', () => {
    const result = checkRateLimit('test:allow-first', 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('allows up to the limit', () => {
    const key = 'test:up-to-limit';
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    }
    const over = checkRateLimit(key, 3, 60_000);
    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
  });

  it('resets after the window expires', () => {
    vi.useFakeTimers();

    const key = 'test:reset-window';
    checkRateLimit(key, 1, 1_000);
    const blocked = checkRateLimit(key, 1, 1_000);
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(1_001);
    const after = checkRateLimit(key, 1, 1_000);
    expect(after.allowed).toBe(true);

    vi.useRealTimers();
  });

  it('different keys are isolated', () => {
    checkRateLimit('test:key-a', 1, 60_000);
    checkRateLimit('test:key-a', 1, 60_000); // exhausted

    const b = checkRateLimit('test:key-b', 1, 60_000);
    expect(b.allowed).toBe(true);
  });
});
