import { describe, expect, it } from 'vitest';
import { completion } from './suggest-input';

const order = ['ORD-1001', '1001'];
const request = ['RD-000025', '25', 'ORD-1001', '1001', 'Aarav Mehta', 'aarav.mehta@example.com'];

describe('completion', () => {
  it.each([
    ['100', order, '1'],
    ['1', order, '001'],
    ['ord-10', order, '01'],
    ['O', order, 'RD-1001'],
    ['1001', order, ''],
    ['#10', order, ''],
    ['', order, ''],
    ['1', [], ''],
    ['RD-00002', request, '5'],
    ['2', request, '5'],
    ['aar', request, 'av Mehta'],
    ['aarav.', request, 'mehta@example.com'],
    ['mehta', request, ''],
  ])('%j continues with %j', (typed, candidates, rest) => {
    expect(completion(typed, candidates)).toBe(rest);
  });
});
