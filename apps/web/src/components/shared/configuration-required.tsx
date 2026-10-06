import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function ConfigurationRequired() {
  return (
    <Card className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Sign-in is not available yet</h1>
      <p className="text-muted-foreground">
        Account and booking services will be available once authentication is configured. You can
        still explore the hotel search.
      </p>
      <Button asChild>
        <Link href="/">Back to search</Link>
      </Button>
    </Card>
  );
}
