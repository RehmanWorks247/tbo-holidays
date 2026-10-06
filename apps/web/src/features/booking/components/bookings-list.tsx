'use client';

import Link from 'next/link';

import { RequestError } from '@/components/shared/request-error';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBookings } from '@/features/booking/queries/use-bookings';
import { statusLabel } from '@/features/booking/utils/status-label';
import { formatMoney } from '@/lib/format-money';

export function BookingsList() {
  const bookings = useBookings();
  if (bookings.isPending) return <Skeleton className="h-48" />;
  if (bookings.error) return <RequestError error={bookings.error} />;
  if (!bookings.data.length)
    return (
      <Card className="space-y-4">
        <h2 className="font-semibold">Your next trip starts here</h2>
        <p className="text-muted-foreground">
          Your bookings will appear here once you start a reservation.
        </p>
        <Button asChild>
          <Link href="/hotels">Find a hotel</Link>
        </Button>
      </Card>
    );
  return (
    <div className="space-y-4">
      {bookings.data.map((booking) => (
        <Card key={booking.id} className="flex flex-col justify-between gap-4 sm:flex-row">
          <div className="space-y-2">
            <h2 className="font-semibold">{booking.hotel.name}</h2>
            <p className="text-sm text-muted-foreground">
              {booking.checkIn} → {booking.checkOut}
            </p>
            <p className="text-sm">
              {statusLabel(booking.bookingStatus)} · {statusLabel(booking.paymentStatus)}
            </p>
          </div>
          <div className="space-y-3 sm:text-right">
            <p className="font-semibold">{formatMoney(booking.price)}</p>
            <Button asChild variant="outline">
              <Link href={`/booking/${booking.id}`}>View booking</Link>
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
