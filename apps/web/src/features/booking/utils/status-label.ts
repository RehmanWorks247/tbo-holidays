import type { BookingStatus, PaymentStatus } from '@hotel/contracts';

import type { BookingMessages } from '@/features/booking/messages/booking-english';

export function statusLabel(
  status: BookingStatus | PaymentStatus,
  labels: BookingMessages['statuses'],
): string {
  return labels[status];
}
