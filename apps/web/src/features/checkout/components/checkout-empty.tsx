'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePageMessages } from '@/providers/use-page-messages';

export function CheckoutEmpty() {
  const {
    messages: { app },
  } = usePageMessages();
  return (
    <Card className="space-y-4">
      <p>{app.selectRoom}</p>
      <Button asChild>
        <Link href="/hotels">{app.findRoom}</Link>
      </Button>
    </Card>
  );
}
