import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';

import { requireSessionToken } from '@/services/api/api-client';
import { bookingsApi } from '@/services/api/bookings.api';

export const bookingKeys = {
  list: (userId: string | null | undefined) => ['bookings', userId] as const,
  detail: (userId: string | null | undefined, id: string) => ['booking', userId, id] as const,
};

export function useBookings() {
  const { userId, getToken } = useAuth();
  return useQuery({
    queryKey: bookingKeys.list(userId),
    queryFn: async ({ signal }) => bookingsApi.list(await requireSessionToken(getToken), signal),
    enabled: Boolean(userId),
  });
}

export function useBooking(id: string) {
  const { userId, getToken } = useAuth();
  return useQuery({
    queryKey: bookingKeys.detail(userId, id),
    queryFn: async ({ signal }) => bookingsApi.get(id, await requireSessionToken(getToken), signal),
    enabled: Boolean(userId && id),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return ['BOOKING_PENDING', 'BOOKING_PROCESSING', 'RECONCILIATION_REQUIRED'].includes(
        data.bookingStatus,
      ) || data.paymentStatus === 'REFUND_PENDING'
        ? 10_000
        : false;
    },
  });
}
