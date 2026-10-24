import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { PreviewHotelDetails } from '@/features/hotel-details/components/preview-hotel-details';
import { previewHotels } from '@/features/hotel-search/data/preview-hotels';

export default async function PreviewHotelPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const hotel = previewHotels.find((item) => item.id === hotelId);
  if (!hotel) notFound();
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <PreviewHotelDetails hotel={hotel} />
    </Suspense>
  );
}
