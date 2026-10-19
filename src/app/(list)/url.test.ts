import { describe, expect, it } from 'vitest';
import { pendingSearches, withParams } from './url';

describe('withParams', () => {
  it('sets and clears params, and goes back to page 1 when a filter changes', () => {
    expect(withParams('q=pillow&page=3&sort=createdAt', { q: undefined, status: 'open' })).toBe('/?sort=createdAt&status=open');
  });

  it('keeps the other params when only the page changes', () => {
    expect(withParams('q=pillow&page=3', { page: '4' })).toBe('/?q=pillow&page=4');
  });
});

describe('pendingSearches', () => {
  it('ignores its own searches as they land, even late ones', () => {
    const pending = pendingSearches();
    pending.send('abc');
    pending.send('abcd');
    expect(pending.follow('abc')).toBe(false);
    expect(pending.follow('abcd')).toBe(false);
  });

  it('follows the back button: a value it never sent', () => {
    const pending = pendingSearches();
    pending.send('meera');
    expect(pending.follow('meera')).toBe(false);
    expect(pending.follow('')).toBe(true);
  });

  it('follows Clear filters even to a value it sent long ago', () => {
    const pending = pendingSearches();
    for (const q of ['a', '', 'b']) {
      pending.send(q);
      expect(pending.follow(q)).toBe(false);
    }
    expect(pending.follow('')).toBe(true);
  });
});
