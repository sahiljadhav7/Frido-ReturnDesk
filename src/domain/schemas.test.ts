import { describe, expect, it } from 'vitest';
import { checkQuantity } from './rules';
import { raiseSchema } from './schemas';

const ok = { orderLineId: 1, quantity: 1, reason: 'damaged', contactName: ' Aarav ', contactEmail: 'a@example.com' };

describe('raiseSchema', () => {
  it('trims text and stores an empty phone as null', () => {
    expect(raiseSchema.parse({ ...ok, contactPhone: '' })).toMatchObject({ contactName: 'Aarav', contactPhone: null });
  });

  it.each([
    ['a number past the Postgres int range', { quantity: 2 ** 31 }],
    ['a null character', { contactName: 'A\u0000' }],
    ['a bad email', { contactEmail: 'nope' }],
    ['an unknown field', { status: 'approved' }],
    ['blank text', { contactName: '   ' }],
  ])('refuses %s', (_name, patch) => {
    expect(raiseSchema.safeParse({ ...ok, ...patch }).success).toBe(false);
  });
});

describe('checkQuantity', () => {
  it('allows up to the quantity ordered and refuses more', () => {
    expect(() => checkQuantity(2, 2)).not.toThrow();
    expect(() => checkQuantity(3, 2)).toThrow(expect.objectContaining({ status: 422, code: 'quantity_over_ordered' }));
  });
});
