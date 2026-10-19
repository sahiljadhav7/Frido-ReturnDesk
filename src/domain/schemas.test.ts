import { describe, expect, it } from 'vitest';
import type { Status } from './lifecycle';
import { checkCorrectable, checkQuantity, checkStatusChange } from './rules';
import { correctionSchema, listQuerySchema, normalizeOrderNumber, noteSchema, raiseSchema, statusChangeSchema, type StatusChangeInput } from './schemas';

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
    expect(() => checkStatusChange('in_review', { to: 'rejected', reason: 'Used item.' }, cap)).not.toThrow();
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
    ['an amount past the Postgres int range', statusChangeSchema.parse({ to: 'approved', resolution: 'refund', refundAmountPaise: 2 ** 31 }), 'refund_amount_out_of_range'],
    ['an amount with Replacement', { to: 'approved', resolution: 'replacement', refundAmountPaise: 100 }, 'refund_amount_not_allowed'],
    ['a Resolution on Rejected', { to: 'rejected', reason: 'Used item.', resolution: 'store_credit' }, 'resolution_not_allowed'],
    ['an amount on Rejected', { to: 'rejected', reason: 'Used item.', refundAmountPaise: 100 }, 'resolution_not_allowed'],
  ] as const)('refuses %s with 422', (_name, input, code) => {
    fails('in_review', input, 422, code);
  });
});

describe('noteSchema', () => {
  it('trims the body', () => {
    expect(noteSchema.parse({ body: '  Pickup booked.  ' })).toEqual({ body: 'Pickup booked.' });
  });

  it.each([
    ['an empty body', { body: '' }],
    ['a blank body', { body: '   ' }],
    ['a body over 2000 characters', { body: 'a'.repeat(2001) }],
    ['a null character', { body: 'a\u0000' }],
    ['an unknown field', { body: 'ok', id: 3 }],
  ])('refuses %s', (_name, input) => {
    expect(noteSchema.safeParse(input).success).toBe(false);
  });
});

describe('rejection reason', () => {
  const cap = { unitPricePaise: 1000, quantity: 2 };
  it('rejects with a reason', () => {
    expect(() => checkStatusChange('in_review', statusChangeSchema.parse({ to: 'rejected', reason: ' Item was used. ' }), cap)).not.toThrow();
  });

  it.each([
    ['no reason', { to: 'rejected' }],
    ['a blank reason', { to: 'rejected', reason: '   ' }],
  ])('refuses a reject with %s with 422', (_name, input) => {
    expect(() => checkStatusChange('in_review', statusChangeSchema.parse(input), cap)).toThrow(expect.objectContaining({ status: 422, code: 'rejection_reason_required' }));
  });

  it('refuses a reason on any other move with 422', () => {
    expect(() => checkStatusChange('open', { to: 'in_review', reason: 'why' }, cap)).toThrow(expect.objectContaining({ status: 422, code: 'reason_not_allowed' }));
  });

  it('still answers an illegal move with 409 first', () => {
    expect(() => checkStatusChange('open', { to: 'rejected' }, cap)).toThrow(expect.objectContaining({ status: 409 }));
  });
});

describe('normalizeOrderNumber', () => {
  it.each([
    ['ORD-1001', 'ORD-1001'],
    [' ord-1001 ', 'ORD-1001'],
    ['1001', 'ORD-1001'],
    ['ORD1001', 'ORD-1001'],
    ['ord 1001', 'ORD-1001'],
    ['#1001', 'ORD-1001'],
    ['ORD - 1001', 'ORD-1001'],
  ])('reads %j as %s', (typed, number) => {
    expect(normalizeOrderNumber(typed)).toBe(number);
  });

  it('leaves anything else as typed, uppercased, so it simply finds nothing', () => {
    expect(normalizeOrderNumber(' inv-77 ')).toBe('INV-77');
  });
});

describe('correctionSchema', () => {
  it('leaves out what the agent did not send, so a correction never wipes the phone', () => {
    expect(correctionSchema.parse({ reason: 'damaged' })).toEqual({ reason: 'damaged' });
    expect(correctionSchema.parse({ contactPhone: ' ' })).toEqual({ contactPhone: null });
  });

  it.each([
    ['a status', { status: 'approved' }],
    ['an empty correction', {}],
    ['blank text', { contactName: '   ' }],
  ])('refuses %s', (_name, body) => {
    expect(correctionSchema.safeParse(body).success).toBe(false);
  });
});

describe('checkCorrectable', () => {
  it('allows Open and In Review and refuses a Decided request with 409', () => {
    expect(() => checkCorrectable('open')).not.toThrow();
    expect(() => checkCorrectable('in_review')).not.toThrow();
    for (const s of ['approved', 'rejected', 'completed'] as Status[])
      expect(() => checkCorrectable(s)).toThrow(expect.objectContaining({ status: 409, code: 'request_decided' }));
  });
});
