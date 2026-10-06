const inMemoryKeys = new Map<string, string>();

/** Reuse a key after a timeout or reload. Persist only operation IDs, never guests or tokens. */
export function getIdempotencyKey(scope: string): string {
  const storageKey = `stayline:operation:${scope}`;
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(storageKey, created);
    return created;
  } catch {
    const existing = inMemoryKeys.get(scope);
    if (existing) return existing;
    const created = crypto.randomUUID();
    inMemoryKeys.set(scope, created);
    return created;
  }
}

export function validateCheckoutRedirect(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
  ) {
    throw new Error('The payment service returned an invalid checkout address.');
  }
  return url.href;
}
