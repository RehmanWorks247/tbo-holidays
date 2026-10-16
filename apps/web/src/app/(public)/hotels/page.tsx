import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { HotelResults } from '@/features/hotel-search/components/hotel-results';

export default function HotelsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <HotelResults />
    </Suspense>
  );
}
