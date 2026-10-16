'use client';

import { requestErrorMessageKey } from '@/lib/request-error-message';
import { usePageMessages } from '@/providers/use-page-messages';
import { ApiError } from '@/services/api/api-client';

export function RequestError({ error }: { error: Error }) {
  const {
    messages: { app },
    t,
  } = usePageMessages();
  const key =
    error instanceof ApiError
      ? requestErrorMessageKey(error.code, error.status)
      : requestErrorMessageKey();
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm"
    >
      <p>{app[key]}</p>
      {error instanceof ApiError && error.requestId ? (
        <p className="mt-2 text-muted-foreground">
          {t(app.requestReference, { reference: error.requestId })}
        </p>
      ) : null}
    </div>
  );
}
