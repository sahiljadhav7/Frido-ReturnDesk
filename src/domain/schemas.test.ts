import { describe, expect, it } from 'vitest';
import type { Status } from './lifecycle';
import { checkQuantity, checkStatusChange } from './rules';
import { listQuerySchema, raiseSchema, type StatusChangeInput } from './schemas';

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

describe('listQuerySchema.strip()', () => {
  it('drops unknown params like utm_source but still refuses bad values', () => {
    expect(listQuerySchema.strip().parse({ status: 'open', utm_source: 'mail' })).toMatchObject({ status: ['open'] });
    expect(listQuerySchema.strip().safeParse({ status: 'lost', utm_source: 'mail' }).success).toBe(false);
  });
});

describe('checkStatusChange', () => {
  const cap = { unitPricePaise: 1000, quantity: 2 };
  const fails = (from: Status, input: StatusChangeInput, status: number, code: string) =>
    expect(() => checkStatusChange(from, input, cap)).toThrow(expect.objectContaining({ status, code }));

  it('allows the legal moves', () => {
    expect(() => checkStatusChange('open', { to: 'in_review' }, cap)).not.toThrow();
    expect(() => checkStatusChange('in_review', { to: 'rejected' }, cap)).not.toThrow();
    expect(() => checkStatusChange('in_review', { to: 'approved', resolution: 'replacement' }, cap)).not.toThrow();
    expect(() => checkStatusChange('in_review', { to: 'approved', resolution: 'refund', refundAmountPaise: 2000 }, cap)).not.toThrow();
    expect(() => checkStatusChange('approved', { to: 'completed' }, cap)).not.toThrow();
  });

  it.each([
    ['open', 'rejected'],
    ['open', 'approved'],
    ['rejected', 'in_review'],
    ['completed', 'approved'],
    ['in_review', 'in_review'],
  ] as const)('refuses %s → %s with 409, before any 422', (from, to) => {
    fails(from, { to, resolution: to === 'approved' ? undefined : 'refund' }, 409, 'illegal_transition');
  });

  it.each([
    ['no Resolution', { to: 'approved' }, 'resolution_required'],
    ['Refund without an amount', { to: 'approved', resolution: 'refund' }, 'refund_amount_required'],
    ['a zero amount', { to: 'approved', resolution: 'refund', refundAmountPaise: 0 }, 'refund_amount_out_of_range'],
    ['a negative amount', { to: 'approved', resolution: 'refund', refundAmountPaise: -5 }, 'refund_amount_out_of_range'],
    ['one paisa over the cap', { to: 'approved', resolution: 'refund', refundAmountPaise: 2001 }, 'refund_amount_out_of_range'],
    ['an amount with Replacement', { to: 'approved', resolution: 'replacement', refundAmountPaise: 100 }, 'refund_amount_not_allowed'],
    ['a Resolution on Rejected', { to: 'rejected', resolution: 'store_credit' }, 'resolution_not_allowed'],
    ['an amount on Rejected', { to: 'rejected', refundAmountPaise: 100 }, 'resolution_not_allowed'],
  ] as const)('refuses %s with 422', (_name, input, code) => {
    fails('in_review', input, 422, code);
  });
});
