import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { PreviewHotelResults } from '@/features/hotel-search/components/preview-hotel-results';

export default function PreviewHotelsPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <PreviewHotelResults />
    </Suspense>
  );
}
