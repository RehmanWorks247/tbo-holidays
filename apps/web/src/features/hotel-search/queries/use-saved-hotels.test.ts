import { describe, expect, it } from 'vitest';

import { parseSavedHotels } from './use-saved-hotels';

describe('saved hotel browser data boundary', () => {
  it('starts empty when nothing has been saved and preserves unique IDs in saved order', () => {
    expect(parseSavedHotels(null)).toEqual([]);
    expect(parseSavedHotels('')).toEqual([]);
    expect(parseSavedHotels('["mock-dubai-01","123456","mock-dubai-01"]')).toEqual([
      'mock-dubai-01',
      '123456',
    ]);
  });

  it('accepts the documented maximum list and ID sizes', () => {
    const ids = Array.from({ length: 100 }, (_, index) => `hotel-${index}`);
    expect(parseSavedHotels(JSON.stringify(ids))).toEqual(ids);
    expect(parseSavedHotels(JSON.stringify(['a'.repeat(100)]))).toEqual(['a'.repeat(100)]);
  });

  it.each([
    'not-json',
    'null',
    '{}',
    '"hotel-1"',
    '[null]',
    '[123]',
    '["valid-id",false]',
    '[""]',
    '["   "]',
    JSON.stringify(['a'.repeat(101)]),
    JSON.stringify(Array.from({ length: 101 }, (_, index) => `hotel-${index}`)),
  ])('rejects malformed or unbounded local storage: %s', (value) => {
    expect(() => parseSavedHotels(value)).toThrow();
  });
});
