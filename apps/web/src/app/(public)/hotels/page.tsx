import { Suspense } from 'react';

import { PageHeading } from '@/components/shared/page-heading';
import { Skeleton } from '@/components/ui/skeleton';
import { HotelResults } from '@/features/hotel-search/components/hotel-results';

export default function HotelsPage() {
  return (
    <>
      <PageHeading title="Find a hotel" description="Explore room options for your stay." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <HotelResults />
      </Suspense>
    </>
  );
}
