import { describe, expect, it } from 'vitest';
import { escapeLike } from './reads';

describe('escapeLike', () => {
  it('escapes the backslash first, then the wildcards', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});
