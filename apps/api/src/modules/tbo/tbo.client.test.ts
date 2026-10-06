import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Environment } from '../../config/environment';
import type { SupplierBookingRequest } from '../hotels/hotel-supplier';
import { CurrencyService } from '../pricing/currency.service';
import { TboClient } from './tbo.client';
import { TboService } from './tbo.service';

function makeClient(enabled = true, retries = 1) {
  return new TboClient(
    new ConfigService<Environment, true>({
      TBO_READS_ENABLED: enabled,
      TBO_BASE_URL: 'https://supplier.example.test/HotelAPI',
      TBO_USERNAME: 'unit-test-user',
      TBO_PASSWORD: 'unit-test-password',
      TBO_TIMEOUT_MS: 100,
      TBO_MAX_RETRIES: retries,
    }),
  );
}

describe('supplier transport protection', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('never makes network requests when the integration is disabled', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    await expect(makeClient(false).read('Search', {})).rejects.toMatchObject({
      code: 'SUPPLIER_NOT_CONFIGURED',
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('retries safe reads after transient errors and sends credentials only in a header', async () => {
    vi.useFakeTimers();
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ Status: { Code: 200 }, HotelResult: [] }));
    vi.stubGlobal('fetch', request);
    const result = makeClient().read('Search', { CheckIn: '2100-01-01' });
    await vi.runAllTimersAsync();
    await expect(result).resolves.toMatchObject({ Status: { Code: 200 } });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      redirect: 'error',
      body: '{"CheckIn":"2100-01-01"}',
    });
  });

  it('does not retry rejected credentials or malformed JSON contracts', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', request);
    await expect(makeClient().read('Search', {})).rejects.toMatchObject({
      code: 'SUPPLIER_UNAVAILABLE',
    });
    expect(request).toHaveBeenCalledTimes(1);
    request.mockClear().mockResolvedValue(Response.json({ unexpected: true }));
    await expect(makeClient().read('Search', {})).rejects.toMatchObject({
      code: 'SUPPLIER_UNAVAILABLE',
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('aborts requests at the configured deadline without exposing the underlying error', async () => {
    vi.useFakeTimers();
    const request = vi.fn(
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () =>
            reject(new DOMException('upstream secret', 'AbortError')),
          );
        }),
    );
    vi.stubGlobal('fetch', request);
    const result = expect(makeClient(true, 0).read('Search', {})).rejects.toMatchObject({
      code: 'SUPPLIER_UNAVAILABLE',
      message: 'The hotel supplier could not complete the request.',
    });
    await vi.runAllTimersAsync();
    await result;
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('keeps mutations disabled even when read credentials are configured', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    const supplier = new TboService(makeClient(), new CurrencyService());
    await expect(supplier.createBooking({} as SupplierBookingRequest)).rejects.toMatchObject({
      code: 'SUPPLIER_INTEGRATION_REQUIRED',
    });
    await expect(
      supplier.cancelBooking({ clientReference: 'existing', supplierBookingId: 'upstream' }),
    ).rejects.toMatchObject({ code: 'SUPPLIER_INTEGRATION_REQUIRED' });
    expect(request).not.toHaveBeenCalled();
  });
});
