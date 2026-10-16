'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { usePageMessages } from '@/providers/use-page-messages';

export default function NotFound() {
  const {
    messages: { app },
  } = usePageMessages();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{app.notFoundTitle}</h1>
      <p>{app.notFoundDescription}</p>
      <Button asChild>
        <Link href="/">{app.returnHome}</Link>
      </Button>
    </div>
  );
}
