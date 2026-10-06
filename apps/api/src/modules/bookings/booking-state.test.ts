import { describe, expect, it } from 'vitest';

import { assertBookingTransition, canFulfillBooking } from './booking-state';

describe('booking state transitions', () => {
  it('requires verified payment before fulfillment', () => {
    expect(canFulfillBooking('BOOKING_PENDING', 'PAYMENT_PENDING')).toBe(false);
    expect(canFulfillBooking('BOOKING_PENDING', 'PAYMENT_SUCCEEDED')).toBe(true);
    expect(canFulfillBooking('BOOKING_PROCESSING', 'PAYMENT_SUCCEEDED')).toBe(false);
  });

  it('allows reconciliation to confirm but prevents replaying a mutation', () => {
    expect(() =>
      assertBookingTransition('RECONCILIATION_REQUIRED', 'BOOKING_CONFIRMED'),
    ).not.toThrow();
    expect(() => assertBookingTransition('RECONCILIATION_REQUIRED', 'BOOKING_PENDING')).toThrow();
    expect(() => assertBookingTransition('BOOKING_CONFIRMED', 'BOOKING_PROCESSING')).toThrow();
    expect(() => assertBookingTransition('BOOKING_CANCELLED', 'BOOKING_CONFIRMED')).toThrow();
  });
});
