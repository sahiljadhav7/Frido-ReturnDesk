import { describe, expect, it } from 'vitest';
import { checkQuantity } from './rules';
import { listQuerySchema, raiseSchema } from './schemas';

const ok = { orderLineId: 1, quantity: 1, reason: 'damaged', contactName: ' Aarav ', contactEmail: 'a@example.com' };

describe('raiseSchema', () => {
  it('trims text and stores an empty phone as null', () => {
    expect(raiseSchema.parse({ ...ok, contactPhone: '' })).toMatchObject({ contactName: 'Aarav', contactPhone: null });
    expect(raiseSchema.parse({ ...ok, contactPhone: '   ' }).contactPhone).toBeNull();
    expect(raiseSchema.parse(ok).contactPhone).toBeNull();
  });

  it.each([
    ['a number past the Postgres int range', { quantity: 2 ** 31 }],
    ['a null character', { contactName: 'A\u0000' }],
    ['a bad email', { contactEmail: 'nope' }],
    ['an unknown field', { status: 'approved' }],
    ['blank text', { contactName: '   ' }],
    ['a null character in the phone', { contactPhone: '98\u0000' }],
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

describe('listQuerySchema', () => {
  it('fills defaults and splits comma-separated filters', () => {
    expect(listQuerySchema.parse({ status: 'open,in_review', reason: 'damaged' })).toEqual({
      status: ['open', 'in_review'], reason: ['damaged'], sort: 'lastActivityAt', order: 'desc', page: 1, pageSize: 20,
    });
  });

  it('reads page numbers from query strings', () => {
    expect(listQuerySchema.parse({ page: '3', pageSize: '100', q: ' ord ' })).toMatchObject({ page: 3, pageSize: 100, q: 'ord' });
  });

  it.each([
    ['pageSize over 100', { pageSize: '101' }],
    ['a page of zero', { page: '0' }],
    ['a non-numeric page', { page: 'two' }],
    ['an unknown sort', { sort: 'reference' }],
    ['an unknown status', { status: 'open,lost' }],
    ['an unknown parameter', { limit: '5' }],
  ])('refuses %s', (_name, query) => {
    expect(listQuerySchema.safeParse(query).success).toBe(false);
  });
});
