import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p>This page may have moved or is no longer available.</p>
      <Button asChild>
        <Link href="/">Return home</Link>
      </Button>
    </div>
  );
}
