import { BookingStatus, PaymentStatus } from '@prisma/client';

import { DomainError } from '../../common/errors/domain-error';

const transitions: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  BOOKING_PENDING: ['BOOKING_PROCESSING', 'BOOKING_FAILED'],
  BOOKING_PROCESSING: ['BOOKING_CONFIRMED', 'BOOKING_FAILED', 'RECONCILIATION_REQUIRED'],
  RECONCILIATION_REQUIRED: ['BOOKING_CONFIRMED', 'BOOKING_FAILED'],
  BOOKING_CONFIRMED: ['BOOKING_CANCELLED'],
  BOOKING_FAILED: [],
  BOOKING_CANCELLED: [],
};

export function assertBookingTransition(from: BookingStatus, to: BookingStatus): void {
  if (from === to || transitions[from].includes(to)) return;
  throw new DomainError(
    'INVALID_BOOKING_TRANSITION',
    `Cannot move booking from ${from} to ${to}.`,
    409,
  );
}

export function canFulfillBooking(
  bookingStatus: BookingStatus,
  paymentStatus: PaymentStatus,
): boolean {
  return bookingStatus === 'BOOKING_PENDING' && paymentStatus === 'PAYMENT_SUCCEEDED';
}
