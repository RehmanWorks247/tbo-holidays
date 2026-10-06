import { BookingDetails } from '@/features/booking/components/booking-details';

export default async function BookingPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <BookingDetails bookingId={bookingId} />;
}
