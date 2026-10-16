'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePageMessages } from '@/providers/use-page-messages';

export function ConfigurationRequired() {
  const {
    messages: { app },
  } = usePageMessages();
  return (
    <Card className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">{app.signInUnavailable}</h1>
      <p className="text-muted-foreground">{app.accountUnavailable}</p>
      <Button asChild>
        <Link href="/">{app.backToSearch}</Link>
      </Button>
    </Card>
  );
}
