import { describe, expect, it } from 'vitest';
import { formatDateTime, formatDay, formatPaise } from './format';

describe('formatPaise', () => {
  it('shows integer paise as rupees with Indian grouping', () => {
    expect(formatPaise(149900)).toBe('₹1,499.00');
    expect(formatPaise(12345678)).toBe('₹1,23,456.78');
  });
});

describe('formatDay', () => {
  it('uses the Kolkata date, not the UTC one', () => {
    expect(formatDay('2026-09-28T20:00:00Z')).toBe('29 Sep 2026');
  });
});

describe('formatDateTime', () => {
  it('shows Kolkata time on a 24-hour clock, with or without the year', () => {
    expect(formatDateTime('2026-10-17T08:35:00Z')).toBe('17 Oct 2026, 14:05');
    expect(formatDateTime('2026-10-16T18:40:00Z', { year: false })).toBe('17 Oct, 00:10');
  });
});
