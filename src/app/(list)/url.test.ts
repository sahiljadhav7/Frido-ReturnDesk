import { describe, expect, it } from 'vitest';
import { withParams } from './url';

describe('withParams', () => {
  it('sets and clears params, and goes back to page 1 when a filter changes', () => {
    expect(withParams('q=pillow&page=3&sort=createdAt', { q: undefined, status: 'open' })).toBe('/?sort=createdAt&status=open');
  });

  it('keeps the other params when only the page changes', () => {
    expect(withParams('q=pillow&page=3', { page: '4' })).toBe('/?q=pillow&page=4');
  });
});
