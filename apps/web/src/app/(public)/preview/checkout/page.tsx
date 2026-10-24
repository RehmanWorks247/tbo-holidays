import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { PreviewCheckout } from '@/features/checkout/components/preview-checkout';
import { previewHotels } from '@/features/hotel-search/data/preview-hotels';

export default async function PreviewCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const hotel = previewHotels.find((item) => item.id === query.hotel);
  const room = hotel?.rooms.find((item) => item.id === query.room);
  if (!hotel || !room) notFound();
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <PreviewCheckout key={`${hotel.id}-${room.id}`} hotel={hotel} room={room} />
    </Suspense>
  );
}
