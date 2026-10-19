import { describe, expect, it } from 'vitest';
import { completion } from './order-number-input';

describe('completion', () => {
  it.each([
    ['100', 'ORD-1001', '1'],
    ['1', 'ORD-1001', '001'],
    ['ORD-10', 'ORD-1001', '01'],
    ['ord-1', 'ORD-1001', '001'],
    ['O', 'ORD-1001', 'RD-1001'],
    ['1001', 'ORD-1001', ''],
    ['isha', 'ORD-1006', ''],
    ['#10', 'ORD-1001', ''],
    ['', 'ORD-1001', ''],
    ['1', undefined, ''],
  ])('%j then %s completes with %j', (typed, number, rest) => {
    expect(completion(typed, number)).toBe(rest);
  });
});
