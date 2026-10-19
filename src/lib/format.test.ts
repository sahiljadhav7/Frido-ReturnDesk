import { describe, expect, it } from 'vitest';
import { formatPaise } from './format';

describe('formatPaise', () => {
  it('shows integer paise as rupees with Indian grouping', () => {
    expect(formatPaise(149900)).toBe('₹1,499.00');
    expect(formatPaise(12345678)).toBe('₹1,23,456.78');
  });
});
