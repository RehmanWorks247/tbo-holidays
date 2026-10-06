import { describe, expect, it } from 'vitest';

import { createBookingRequestSchema } from './bookings';
import { hotelSearchRequestSchema, validateStay } from './hotels';

describe('public input contracts', () => {
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
});
