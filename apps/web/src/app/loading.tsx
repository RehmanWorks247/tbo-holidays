'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { usePageMessages } from '@/providers/use-page-messages';

export default function Loading() {
  const {
    messages: { app },
  } = usePageMessages();
  return (
    <div role="status" aria-label={app.loadingPage} className="space-y-5">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
      <span className="sr-only">{app.loading}</span>
    </div>
  );
}
