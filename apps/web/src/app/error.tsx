'use client';

import { Button } from '@/components/ui/button';
import { usePageMessages } from '@/providers/use-page-messages';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const {
    messages: { app },
  } = usePageMessages();
  return (
    <div role="alert" className="space-y-4">
      <h1 className="text-2xl font-semibold">{app.errorTitle}</h1>
      <p>{app.errorDescription}</p>
      <Button onClick={reset}>{app.tryAgain}</Button>
    </div>
  );
}
