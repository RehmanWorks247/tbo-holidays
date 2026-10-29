import { describe, expect, it } from 'vitest';

import {
  catalogSearchPattern,
  catalogSearchText,
  tboCitiesResponseSchema,
  tboCountriesResponseSchema,
} from './tbo-catalog.schemas';

describe('TBO catalogue schemas and search normalization', () => {
  it('normalizes verified numeric and string city identifiers without losing identity', () => {
    expect(
      tboCitiesResponseSchema.parse({
        Status: { Code: 200 },
        CityList: [
          { Code: 123, Name: ' City ' },
          { Code: '456', Name: 'Other' },
        ],
      }).CityList,
    ).toEqual([
      { Code: '123', Name: 'City' },
      { Code: '456', Name: 'Other' },
    ]);
  });

  it.each([0, -1, 1.5, '123/Book', '9007199254740992'])(
    'rejects invalid city identity %s',
    (Code) => {
      expect(
        tboCitiesResponseSchema.safeParse({
          Status: { Code: 200 },
          CityList: [{ Code, Name: 'City' }],
        }).success,
      ).toBe(false);
    },
  );

  it.each(['sa', 'SAU', '', 'S1'])(
    'rejects country codes outside uppercase ISO shape: %s',
    (Code) => {
      expect(
        tboCountriesResponseSchema.safeParse({
          Status: { Code: 200 },
          CountryList: [{ Code, Name: 'Country' }],
        }).success,
      ).toBe(false);
    },
  );

  it('requires successful envelopes and named entries', () => {
    expect(
      tboCountriesResponseSchema.safeParse({
        Status: { Code: 401 },
        CountryList: [],
      }).success,
    ).toBe(false);
    expect(
      tboCitiesResponseSchema.safeParse({
        Status: { Code: 200 },
        CityList: [{ Code: '123', Name: ' ' }],
      }).success,
    ).toBe(false);
  });

  it('uses the same accent, spacing and casing normalization for stored data and input', () => {
    expect(catalogSearchText('  São   PAULO\n')).toBe('sao paulo');
    expect(catalogSearchText('MÜNCHEN')).toBe(catalogSearchText('munchen'));
  });

  it('escapes LIKE wildcard and escape characters without interpreting SQL text', () => {
    expect(catalogSearchPattern('100%_\\ Hotel')).toBe('100\\%\\_\\\\ hotel');
    expect(catalogSearchPattern("x'; DROP TABLE hotels; --")).toBe("x'; drop table hotels; --");
  });
});
