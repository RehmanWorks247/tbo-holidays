import { PageHeading } from '@/components/shared/page-heading';
import { AdminPlaceholder } from '@/features/account/components/admin-placeholder';

export default function AdminBookingsPage() {
  return (
    <>
      <PageHeading title="Booking operations" />
      <AdminPlaceholder bookings />
    </>
  );
}
