'use client';

import Link from 'next/link';

import { RequestError } from '@/components/shared/request-error';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBookings } from '@/features/booking/queries/use-bookings';
import { statusLabel } from '@/features/booking/utils/status-label';
import { formatDate } from '@/lib/format-date';
import { formatMoney } from '@/lib/format-money';
import { usePageMessages } from '@/providers/use-page-messages';

export function BookingsList() {
  const {
    messages: { booking: copy },
    locale,
    dir,
  } = usePageMessages();
  const bookings = useBookings();
  if (bookings.isPending) return <Skeleton className="h-48" />;
  if (bookings.error) return <RequestError error={bookings.error} />;
  if (!bookings.data.length)
    return (
      <Card className="space-y-4" lang={locale} dir={dir}>
        <h2 className="font-semibold">{copy.list.emptyTitle}</h2>
        <p className="text-muted-foreground">{copy.list.emptyDescription}</p>
        <Button asChild>
          <Link href="/hotels">{copy.list.findHotel}</Link>
        </Button>
      </Card>
    );
  return (
    <div className="space-y-4" lang={locale} dir={dir}>
      {bookings.data.map((booking) => (
        <Card key={booking.id} className="flex flex-col justify-between gap-4 sm:flex-row">
          <div className="space-y-2">
            <h2 className="font-semibold">{booking.hotel.name}</h2>
            <p className="text-sm text-muted-foreground">
              {formatDate(booking.checkIn, locale)} → {formatDate(booking.checkOut, locale)}
            </p>
            <p className="text-sm">
              {statusLabel(booking.bookingStatus, copy.statuses)} ·{' '}
              {statusLabel(booking.paymentStatus, copy.statuses)}
            </p>
          </div>
          <div className="space-y-3 sm:text-end">
            <p className="font-semibold">{formatMoney(booking.price, locale)}</p>
            <Button asChild variant="outline">
              <Link href={`/booking/${booking.id}`}>{copy.list.viewBooking}</Link>
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
