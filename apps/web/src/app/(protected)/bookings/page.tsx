import { LocalizedPageHeading as PageHeading } from '@/components/shared/page-heading';
import { BookingsList } from '@/features/booking/components/bookings-list';

export default function BookingsPage() {
  return (
    <>
      <PageHeading title="bookingsTitle" description="bookingsDescription" />
      <BookingsList />
    </>
  );
}
