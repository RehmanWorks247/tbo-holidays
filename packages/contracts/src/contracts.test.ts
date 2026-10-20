import { describe, expect, it } from 'vitest';

import { createBookingRequestSchema } from './bookings';
import {
  cancellationPolicySchema,
  hotelSearchRequestSchema,
  mockHotelSearchRequestSchema,
  validateStay,
} from './hotels';

describe('public input contracts', () => {
  it('allows omitted mock criteria without weakening live search requirements', () => {
    expect(mockHotelSearchRequestSchema.parse({})).toEqual({ currency: 'USD' });
    expect(
      mockHotelSearchRequestSchema.parse({
        destination: ' ',
        checkIn: ' ',
        checkOut: ' ',
        nationality: ' ',
        currency: ' ',
      }),
    ).toMatchObject({
      destination: undefined,
      checkIn: undefined,
      checkOut: undefined,
      nationality: undefined,
      currency: 'USD',
    });
    expect(
      mockHotelSearchRequestSchema.parse({
        destination: '',
        checkIn: '',
        checkOut: '',
        nationality: '',
      }),
    ).toMatchObject({
      destination: undefined,
      checkIn: undefined,
      checkOut: undefined,
      nationality: undefined,
      currency: 'USD',
    });
    expect(mockHotelSearchRequestSchema.parse({ filters: { starRatings: [2] } })).toEqual({
      currency: 'USD',
      filters: { starRatings: [2] },
    });
    expect(hotelSearchRequestSchema.safeParse({}).success).toBe(false);
    expect(hotelSearchRequestSchema.safeParse({ filters: {} }).success).toBe(false);
    for (const invalid of [
      { checkIn: 'not-a-date' },
      { checkIn: '2100-11-08', checkOut: '2100-11-01' },
      { nationality: 'invalid' },
      { rooms: [] },
      { currency: 'XXX' },
      { filters: { minPrice: 100, maxPrice: 50 } },
      { totalAmount: 1 },
    ])
      expect(mockHotelSearchRequestSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects browser supplied authoritative prices', () => {
    expect(
      createBookingRequestSchema.safeParse({
        quoteId: crypto.randomUUID(),
        idempotencyKey: crypto.randomUUID(),
        totalAmount: 1,
      }).success,
    ).toBe(false);
  });
  it('validates leap days, range order, past dates and maximum stay', () => {
    expect(
      hotelSearchRequestSchema.safeParse({
        destination: '1',
        checkIn: '2027-02-29',
        checkOut: '2027-03-03',
        nationality: 'PK',
        rooms: [{ adults: 2, childrenAges: [] }],
      }).success,
    ).toBe(false);
    const now = new Date('2027-01-01T00:00:00Z');
    expect(validateStay('2026-12-31', '2027-01-02', 30, now)).toContain('past');
    expect(validateStay('2027-01-02', '2027-01-02', 30, now)).toContain('after');
    expect(validateStay('2027-01-02', '2027-02-02', 30, now)).toContain('30');
    expect(validateStay('2027-01-02', '2027-01-03', 30, now)).toBeUndefined();
  });
  it('keeps property-local policy time and percentage charges distinct from money', () => {
    const policy = {
      from: '2030-02-28T12:00:00',
      timeBasis: 'property-local',
      chargeType: 'percentage',
      percentageBasisPoints: 5000,
    };
    expect(cancellationPolicySchema.safeParse(policy).success).toBe(true);
    expect(cancellationPolicySchema.safeParse({ ...policy, from: `${policy.from}Z` }).success).toBe(
      false,
    );
    expect(
      cancellationPolicySchema.safeParse({ ...policy, percentageBasisPoints: 10001 }).success,
    ).toBe(false);
    expect(cancellationPolicySchema.safeParse({ ...policy, chargeType: 'fixed' }).success).toBe(
      false,
    );
  });
});
