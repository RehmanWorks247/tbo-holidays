import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-5">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
