import { describe, expect, it } from 'vitest';
import { formatDay, formatPaise } from './format';

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
