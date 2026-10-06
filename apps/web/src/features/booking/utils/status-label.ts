import type { BookingStatus, PaymentStatus } from '@hotel/contracts';

const labels: Record<BookingStatus | PaymentStatus, string> = {
  BOOKING_PENDING: 'Awaiting checkout',
  BOOKING_PROCESSING: 'Confirming with hotel',
  BOOKING_CONFIRMED: 'Booking confirmed',
  BOOKING_FAILED: 'Booking failed',
  BOOKING_CANCELLED: 'Booking cancelled',
  RECONCILIATION_REQUIRED: 'Confirmation under review',
  PAYMENT_PENDING: 'Payment pending',
  PAYMENT_SUCCEEDED: 'Payment received',
  PAYMENT_FAILED: 'Payment failed',
  REFUND_PENDING: 'Refund pending',
  REFUNDED: 'Refunded',
};
export function statusLabel(status: BookingStatus | PaymentStatus): string {
  return labels[status];
}
