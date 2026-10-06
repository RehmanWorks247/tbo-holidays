import Link from 'next/link';

import { PageHeading } from '@/components/shared/page-heading';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BookingCheckout } from '@/features/checkout/components/booking-checkout';
import { RateReview } from '@/features/checkout/components/rate-review';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ rateId?: string; bookingId?: string }>;
}) {
  const { rateId, bookingId } = await searchParams;
  return (
    <>
      <PageHeading
        title="Checkout"
        description="Review the latest room price, add your guests, and continue to payment."
      />
      {bookingId ? (
        <BookingCheckout bookingId={bookingId} />
      ) : rateId ? (
        <RateReview rateId={rateId} />
      ) : (
        <Card className="space-y-4">
          <p>Select an available room to begin checkout.</p>
          <Button asChild>
            <Link href="/hotels">Find a room</Link>
          </Button>
        </Card>
      )}
    </>
  );
}
