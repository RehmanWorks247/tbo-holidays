'use client';

import type { appEnglish } from '@/lib/page-english';
import { usePageMessages } from '@/providers/use-page-messages';

export function PageHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8 space-y-2">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="max-w-2xl text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function LocalizedPageHeading({
  title,
  description,
}: {
  title: keyof typeof appEnglish;
  description?: keyof typeof appEnglish;
}) {
  const {
    messages: { app },
  } = usePageMessages();
  return (
    <PageHeading title={app[title]} description={description ? app[description] : undefined} />
  );
}
