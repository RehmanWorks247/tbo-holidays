import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Environment } from '../../config/environment';
import type { SupplierBookingRequest } from '../hotels/hotel-supplier';
import { CurrencyService } from '../pricing/currency.service';
import { TboClient, type TboReadOperation } from './tbo.client';
import { TboService } from './tbo.service';
import type { TboCatalogService } from './tbo-catalog.service';

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
      headers: {
        Authorization: `Basic ${Buffer.from('unit-test-user:unit-test-password').toString('base64')}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: '{"CheckIn":"2100-01-01"}',
    });
    expect(request.mock.calls[0]?.[0]).toBe('https://supplier.example.test/HotelAPI/Search');
  });

  it('uses the documented HotelDetails route casing', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(Response.json({ Status: { Code: 200 }, HotelDetails: [] }));
    vi.stubGlobal('fetch', request);
    await makeClient().read('HotelDetails', { Hotelcodes: '123', Language: 'EN' });
    expect(request).toHaveBeenCalledWith(
      'https://supplier.example.test/HotelAPI/HotelDetails',
      expect.objectContaining({ method: 'POST', redirect: 'error' }),
    );
  });

  it('reads the country directory with GET and no request body', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(Response.json({ Status: { Code: 200 }, CountryList: [] }));
    vi.stubGlobal('fetch', request);
    await makeClient().read('CountryList', {});
    expect(request).toHaveBeenCalledExactlyOnceWith(
      'https://supplier.example.test/HotelAPI/CountryList',
      expect.objectContaining({ method: 'GET', redirect: 'error' }),
    );
    expect(request.mock.calls[0]?.[1]).not.toHaveProperty('body');
  });

  it('reads a country city directory with the documented POST body', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(Response.json({ Status: { Code: 200 }, CityList: [] }));
    vi.stubGlobal('fetch', request);
    await makeClient().read('CityList', { CountryCode: 'SA' });
    expect(request).toHaveBeenCalledExactlyOnceWith(
      'https://supplier.example.test/HotelAPI/CityList',
      expect.objectContaining({ method: 'POST', body: '{"CountryCode":"SA"}' }),
    );
  });

  it('does not dispatch another batch when the complete search deadline has elapsed', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    await expect(makeClient().read('Search', {}, Date.now() - 1)).rejects.toMatchObject({
      code: 'SUPPLIER_SEARCH_TIMEOUT',
      status: 504,
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('caps an in-flight read and its retries by the complete search deadline', async () => {
    vi.useFakeTimers();
    const request = vi.fn(
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    vi.stubGlobal('fetch', request);
    const result = expect(makeClient().read('Search', {}, Date.now() + 25)).rejects.toMatchObject({
      code: 'SUPPLIER_SEARCH_TIMEOUT',
      status: 504,
    });
    await vi.runAllTimersAsync();
    await result;
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each(['Book', 'Cancel', 'BookingDetail', '../Book', 'Hoteldetails'])(
    'rejects %s at runtime before a request even if the type boundary is bypassed',
    async (operation) => {
      const request = vi.fn();
      vi.stubGlobal('fetch', request);
      await expect(makeClient().read(operation as TboReadOperation, {})).rejects.toMatchObject({
        code: 'SUPPLIER_OPERATION_NOT_ALLOWED',
      });
      expect(request).not.toHaveBeenCalled();
      expect(Logger.prototype.warn).not.toHaveBeenCalled();
    },
  );

  it.each([401, 403])('does not retry HTTP authentication rejection %s', async (status) => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status }));
    vi.stubGlobal('fetch', request);
    await expect(makeClient().read('Search', {})).rejects.toMatchObject({
      code: 'SUPPLIER_AUTHENTICATION_FAILED',
      status: 503,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([
    { label: 'missing envelope', payload: { unexpected: true } },
    { label: 'string status code', payload: { Status: { Code: '200' } } },
    { label: 'fractional status code', payload: { Status: { Code: 200.1 } } },
    { label: 'invalid description', payload: { Status: { Code: 200, Description: {} } } },
  ])('does not retry an invalid response with $label', async ({ payload }) => {
    const request = vi.fn().mockResolvedValue(Response.json(payload));
    vi.stubGlobal('fetch', request);
    await expect(makeClient().read('Search', {})).rejects.toMatchObject({
      code: 'INVALID_SUPPLIER_RESPONSE',
      status: 502,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not retry malformed JSON or expose its contents', async () => {
    const request = vi.fn().mockResolvedValue(new Response('secret-invalid-json'));
    vi.stubGlobal('fetch', request);
    await expect(makeClient().read('Search', {})).rejects.toMatchObject({
      code: 'INVALID_SUPPLIER_RESPONSE',
      status: 502,
      message: 'The supplier returned an unsupported response.',
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('passes Search no availability to the service without rewriting its payload', async () => {
    const payload = { Status: { Code: 201 }, HotelResult: [] };
    const request = vi.fn().mockResolvedValue(Response.json(payload));
    vi.stubGlobal('fetch', request);
    await expect(makeClient().read('Search', {})).resolves.toEqual(payload);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('preserves contradictory Search 201 inventory for service validation', async () => {
    const payload = { Status: { Code: 201 }, HotelResult: [{ HotelCode: 'unexpected' }] };
    const request = vi.fn().mockResolvedValue(Response.json(payload));
    vi.stubGlobal('fetch', request);
    await expect(makeClient().read('Search', {})).resolves.toEqual(payload);
  });

  it.each([
    { supplierCode: 201, code: 'HOTEL_NOT_AVAILABLE' },
    { supplierCode: 207, code: 'HOTEL_NOT_AVAILABLE' },
    { supplierCode: 315, code: 'RATE_EXPIRED' },
  ])(
    'maps PreBook body $supplierCode to $code without retrying',
    async ({ supplierCode, code }) => {
      const request = vi.fn().mockResolvedValue(Response.json({ Status: { Code: supplierCode } }));
      vi.stubGlobal('fetch', request);
      await expect(
        makeClient().read('PreBook', { BookingCode: 'private-rate' }),
      ).rejects.toMatchObject({
        code,
        status: 409,
      });
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { supplierCode: 400, code: 'SUPPLIER_REQUEST_REJECTED', status: 502 },
    { supplierCode: 401, code: 'SUPPLIER_AUTHENTICATION_FAILED', status: 503 },
    { supplierCode: 402, code: 'SUPPLIER_ACCOUNT_BLOCKED', status: 503 },
    { supplierCode: 300, code: 'SUPPLIER_INSUFFICIENT_BALANCE', status: 503 },
    { supplierCode: 405, code: 'SUPPLIER_UNAVAILABLE', status: 503 },
    { supplierCode: 479, code: 'SUPPLIER_UNAVAILABLE', status: 503 },
    { supplierCode: 500, code: 'SUPPLIER_UNAVAILABLE', status: 503 },
    { supplierCode: 999, code: 'SUPPLIER_UNAVAILABLE', status: 503 },
  ])(
    'maps supplier body $supplierCode without retry or raw descriptions',
    async ({ supplierCode, code, status }) => {
      const request = vi
        .fn()
        .mockResolvedValue(
          Response.json({ Status: { Code: supplierCode, Description: 'upstream-secret' } }),
        );
      vi.stubGlobal('fetch', request);
      const result = makeClient().read('PreBook', { BookingCode: 'private-rate' });
      await expect(result).rejects.toMatchObject({ code, status });
      await expect(result).rejects.not.toHaveProperty(
        'message',
        expect.stringContaining('upstream-secret'),
      );
      expect(request).toHaveBeenCalledTimes(1);
      expect(Logger.prototype.warn).toHaveBeenCalledExactlyOnceWith({
        supplier: 'TBO',
        operation: 'PreBook',
        attempt: 1,
        retryable: false,
      });
    },
  );

  it('retries body-level throttling separately from the HTTP status', async () => {
    vi.useFakeTimers();
    const request = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ Status: { Code: 429 } }))
      .mockResolvedValueOnce(Response.json({ Status: { Code: 200 }, HotelResult: [] }));
    vi.stubGlobal('fetch', request);
    const result = makeClient().read('Search', {});
    await vi.runAllTimersAsync();
    await expect(result).resolves.toMatchObject({ Status: { Code: 200 } });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('bounds repeated supplier throttling by the configured retry count', async () => {
    vi.useFakeTimers();
    const request = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(Response.json({ Status: { Code: 429, Description: 'private details' } })),
      );
    vi.stubGlobal('fetch', request);
    const result = expect(makeClient(true, 2).read('Search', {})).rejects.toMatchObject({
      code: 'SUPPLIER_UNAVAILABLE',
      status: 503,
    });
    await vi.runAllTimersAsync();
    await result;
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('retries safe reads after a network failure without exposing it in logs', async () => {
    vi.useFakeTimers();
    const request = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network-secret'))
      .mockResolvedValueOnce(Response.json({ Status: { Code: 200 }, HotelResult: [] }));
    vi.stubGlobal('fetch', request);
    const result = makeClient().read('Search', {});
    await vi.runAllTimersAsync();
    await expect(result).resolves.toMatchObject({ Status: { Code: 200 } });
    expect(request).toHaveBeenCalledTimes(2);
    expect(Logger.prototype.warn).toHaveBeenCalledExactlyOnceWith({
      supplier: 'TBO',
      operation: 'Search',
      attempt: 1,
      retryable: true,
    });
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
    const supplier = new TboService(
      makeClient(),
      new CurrencyService(),
      {} as TboCatalogService,
      new ConfigService<Environment, true>({
        TBO_BASE_URL: 'https://supplier.example.test/HotelAPI',
        TBO_USERNAME: 'unit-test-user',
      }),
    );
    await expect(supplier.createBooking({} as SupplierBookingRequest)).rejects.toMatchObject({
      code: 'SUPPLIER_INTEGRATION_REQUIRED',
    });
    await expect(
      supplier.cancelBooking({ clientReference: 'existing', supplierBookingId: 'upstream' }),
    ).rejects.toMatchObject({ code: 'SUPPLIER_INTEGRATION_REQUIRED' });
    expect(request).not.toHaveBeenCalled();
  });
});
