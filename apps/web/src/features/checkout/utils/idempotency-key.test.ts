import { afterEach, describe, expect, it, vi } from 'vitest';

import { getIdempotencyKey, validateCheckoutRedirect } from './idempotency-key';

afterEach(() => vi.unstubAllGlobals());

describe('checkout idempotency', () => {
  it('reuses the original operation key after a reload and scopes it by user and booking', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    const original = getIdempotencyKey('checkout:user-1:booking-1');
    vi.resetModules();
    const reloaded = await import('./idempotency-key');
    expect(reloaded.getIdempotencyKey('checkout:user-1:booking-1')).toBe(original);
    expect(reloaded.getIdempotencyKey('checkout:user-2:booking-1')).not.toBe(original);
  });
  it('keeps retries stable when browser storage is unavailable', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('Storage blocked');
        },
      },
    });
    expect(getIdempotencyKey('checkout:storage-blocked')).toBe(
      getIdempotencyKey('checkout:storage-blocked'),
    );
  });
});

describe('payment redirect boundary', () => {
  it('permits secure provider checkout and local development URLs', () => {
    expect(validateCheckoutRedirect('https://checkout.example.com/pay/session')).toBe(
      'https://checkout.example.com/pay/session',
    );
    expect(validateCheckoutRedirect('http://localhost:4000/pay')).toBe('http://localhost:4000/pay');
  });
  it('rejects executable and insecure remote addresses', () => {
    expect(() => validateCheckoutRedirect('javascript:alert(1)')).toThrow();
    expect(() => validateCheckoutRedirect('http://checkout.example.com/pay')).toThrow();
  });
});
