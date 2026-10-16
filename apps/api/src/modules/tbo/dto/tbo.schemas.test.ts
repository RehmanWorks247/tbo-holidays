import { describe, expect, it } from 'vitest';

import {
  tboCatalogResponseSchema,
  tboDetailsResponseSchema,
  tboHotelCodeSchema,
  tboPreBookResponseSchema,
  tboRoomSchema,
  tboSearchResponseSchema,
} from './tbo.schemas';

const room = {
  Name: ['Synthetic double'],
  BookingCode: 'synthetic-rate-only',
  TotalFare: '110.00',
  TotalTax: '10.00',
};
const policy = {
  FromDate: '29-02-2104 17:23:59',
  ChargeType: 'Fixed',
  CancellationCharge: '10.00',
};
const hotel = { HotelCode: '100', Currency: 'USD', Rooms: [room] };

describe('TBO wire validation', () => {
  it('normalizes numeric identifiers without accepting precision loss', () => {
    expect(tboHotelCodeSchema.parse(100)).toBe('100');
    expect(tboHotelCodeSchema.parse('00100')).toBe('100');
    expect(tboHotelCodeSchema.parse('9007199254740991')).toBe('9007199254740991');
  });

  it.each([
    '',
    ' ',
    '1.5',
    '1e2',
    'Infinity',
    '-1',
    '9007199254740992',
    0,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects invalid identifier %s', (value) =>
    expect(tboHotelCodeSchema.safeParse(value).success).toBe(false),
  );

  it('requires a complete successful search envelope and recognizes explicit no availability', () => {
    expect(
      tboSearchResponseSchema.parse({ Status: { Code: 200 }, HotelResult: [hotel] }).HotelResult,
    ).toHaveLength(1);
    expect(tboSearchResponseSchema.parse({ Status: { Code: 201 } }).HotelResult).toEqual([]);
    expect(
      tboSearchResponseSchema.parse({ Status: { Code: 201 }, HotelResult: [] }).HotelResult,
    ).toEqual([]);
    for (const response of [
      { Status: { Code: 200 } },
      { Status: { Code: 201 }, HotelResult: [hotel] },
      { Status: { Code: 201 }, HotelResult: null },
      { Status: { Code: 207 }, HotelResult: [] },
    ])
      expect(tboSearchResponseSchema.safeParse(response).success).toBe(false);
  });

  it('requires explicit refundability and policies for PreBook', () => {
    const response = (candidate: unknown) => ({
      Status: { Code: 200 },
      HotelResult: [{ ...hotel, Rooms: [candidate] }],
    });
    expect(tboPreBookResponseSchema.safeParse(response(room)).success).toBe(false);
    expect(
      tboPreBookResponseSchema.safeParse(
        response({ ...room, IsRefundable: true, CancelPolicies: [] }),
      ).success,
    ).toBe(false);
    expect(
      tboPreBookResponseSchema.safeParse(
        response({ ...room, IsRefundable: true, CancelPolicies: [policy] }),
      ).success,
    ).toBe(true);
    expect(
      tboPreBookResponseSchema.safeParse(
        response({ ...room, IsRefundable: false, CancelPolicies: [] }),
      ).success,
    ).toBe(true);
    expect(tboPreBookResponseSchema.safeParse({ Status: { Code: 201 } }).success).toBe(false);
  });

  it.each([
    '29-02-2100 00:00:00',
    '31-04-2100 00:00:00',
    '01-13-2100 00:00:00',
    '00-01-2100 00:00:00',
    '01-01-2100 24:00:00',
    '01-01-2100 01:60:00',
    '01-01-2100 01:00:60',
    '1-01-2100 00:00:00',
    '01-01-0000 00:00:00',
    '2100-01-01T00:00:00Z',
  ])('rejects invalid or ambiguous policy date %s', (FromDate) =>
    expect(
      tboRoomSchema.safeParse({ ...room, CancelPolicies: [{ ...policy, FromDate }] }).success,
    ).toBe(false),
  );

  it.each([0, -1, 2, '0', '1.5', '1e0', '', Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid or out-of-combination policy index %s',
    (Index) =>
      expect(
        tboRoomSchema.safeParse({ ...room, CancelPolicies: [{ ...policy, Index }] }).success,
      ).toBe(false),
  );

  it('keeps a missing policy index absent and accepts explicit one-based indexes', () => {
    expect(
      tboRoomSchema.parse({ ...room, CancelPolicies: [policy] }).CancelPolicies?.[0],
    ).not.toHaveProperty('Index');
    expect(
      tboRoomSchema.parse({ ...room, CancelPolicies: [{ ...policy, Index: '1' }] })
        .CancelPolicies?.[0]?.Index,
    ).toBe(1);
  });

  it.each([
    '-1',
    'NaN',
    'Infinity',
    '',
    '1e3',
    '9'.repeat(100),
    '1.2.3',
    2_000_000_001,
    Infinity,
    NaN,
    0.0000001,
  ])('rejects malformed or unbounded monetary value %s', (TotalFare) =>
    expect(tboRoomSchema.safeParse({ ...room, TotalFare }).success).toBe(false),
  );

  it('fails supplied malformed terms instead of silently discarding them', () => {
    for (const fields of [
      { Name: [] },
      { Name: [' '] },
      { IsRefundable: 'true' },
      { WithTransfers: 'false' },
      { CancelPolicies: [{ ...policy, ChargeType: 'Nights' }] },
      { CancelPolicies: [{ ...policy, ChargeType: 'Percentage', CancellationCharge: '100.01' }] },
      { CancelPolicies: [{ ...policy, ChargeType: 'Percentage', CancellationCharge: '10.001' }] },
      { Supplements: [{ Type: 'Unknown', Description: 'Charge', Price: '1', Currency: 'USD' }] },
      {
        Supplements: [
          { Index: 2, Type: 'AtProperty', Description: 'Charge', Price: '1', Currency: 'USD' },
        ],
      },
      { RoomID: [] },
      { RoomID: ['9007199254740992'] },
      { RoomPromotion: [123] },
      { Amenities: 'Pool' },
      { DayRates: [{ BasePrice: 10 }] },
    ])
      expect(tboRoomSchema.safeParse({ ...room, ...fields }).success).toBe(false);
  });

  it('accepts documented numeric/named ratings and content shapes', () => {
    const content = {
      HotelCode: 100,
      HotelName: 'Synthetic hotel',
      HotelRating: 'ThreeStar',
      Attractions: { Nearby: '<p>Park</p>' },
      Images: [],
      HotelFacilities: [],
    };
    expect(
      tboCatalogResponseSchema.parse({ Status: { Code: 200 }, Hotels: [content] }).Hotels[0]
        ?.HotelRating,
    ).toBe('ThreeStar');
    expect(
      tboDetailsResponseSchema.parse({
        Status: { Code: 200 },
        HotelDetails: [{ ...content, HotelRating: 5 }],
      }).HotelDetails[0]?.HotelRating,
    ).toBe(5);
    expect(
      tboDetailsResponseSchema.safeParse({
        Status: { Code: 200 },
        HotelDetails: [{ ...content, HotelRating: 6 }],
      }).success,
    ).toBe(false);
    expect(tboCatalogResponseSchema.safeParse({ Status: { Code: 201 }, Hotels: [] }).success).toBe(
      false,
    );
  });
});
