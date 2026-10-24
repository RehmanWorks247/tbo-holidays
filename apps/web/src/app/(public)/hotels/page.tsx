import { Suspense } from 'react';

import { PreviewEntry } from '@/components/shared/preview-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { HotelResults } from '@/features/hotel-search/components/hotel-results';

export default function HotelsPage() {
  return (
    <>
      <div className="mx-auto max-w-7xl px-4">
        <PreviewEntry />
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <HotelResults />
      </Suspense>
    </>
  );
}
