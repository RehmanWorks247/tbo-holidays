import { ApiError } from '@/services/api/api-client';

export function RequestError({ error }: { error: Error }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm"
    >
      <p>{error.message}</p>
      {error instanceof ApiError && error.requestId ? (
        <p className="mt-2 text-muted-foreground">Reference: {error.requestId}</p>
      ) : null}
    </div>
  );
}
