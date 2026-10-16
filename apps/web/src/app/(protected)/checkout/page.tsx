import { LocalizedPageHeading as PageHeading } from '@/components/shared/page-heading';
import { BookingCheckout } from '@/features/checkout/components/booking-checkout';
import { CheckoutEmpty } from '@/features/checkout/components/checkout-empty';
import { RateReview } from '@/features/checkout/components/rate-review';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ rateId?: string; bookingId?: string }>;
}) {
  const { rateId, bookingId } = await searchParams;
  return (
    <>
      <PageHeading title="checkoutTitle" description="checkoutDescription" />
      {bookingId ? (
        <BookingCheckout bookingId={bookingId} />
      ) : rateId ? (
        <RateReview rateId={rateId} />
      ) : (
        <CheckoutEmpty />
      )}
    </>
  );
}
