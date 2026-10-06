import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { HotelDetails } from '@/features/hotel-details/components/hotel-details';

export default async function HotelPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = await params;
  return (
    <Suspense fallback={<Skeleton className="h-72" />}>
      <HotelDetails hotelId={hotelId} />
    </Suspense>
  );
}
