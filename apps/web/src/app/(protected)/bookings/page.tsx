import { PageHeading } from '@/components/shared/page-heading';
import { BookingsList } from '@/features/booking/components/bookings-list';

export default function BookingsPage() {
  return (
    <>
      <PageHeading
        title="My bookings"
        description="Review upcoming stays and track reservation updates."
      />
      <BookingsList />
    </>
  );
}
