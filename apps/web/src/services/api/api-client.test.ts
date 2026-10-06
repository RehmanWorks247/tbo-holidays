import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { apiRequest, requireSessionToken } from './api-client';

afterEach(() => vi.unstubAllGlobals());

describe('API boundary', () => {
  it('validates response data and sends the session token only as a header', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: '123' }, requestId: 'request-1' }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const result = await apiRequest('/bookings', z.object({ id: z.string() }), {
      token: 'session-token',
    });
    expect(result.id).toBe('123');
    const options = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer session-token');
    expect(fetch.mock.calls[0]?.[0]).not.toContain('session-token');
  });
  it('preserves normalized error codes and correlation references', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'HOTEL_RATE_CHANGED',
            message: 'Please check the latest price.',
            requestId: 'request-2',
          }),
          { status: 409 },
        ),
      ),
    );
    await expect(apiRequest('/hotels/recheck', z.object({ id: z.string() }))).rejects.toMatchObject(
      { code: 'HOTEL_RATE_CHANGED', status: 409, requestId: 'request-2' },
    );
  });
  it('rejects incompatible successful payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { id: 123 }, requestId: 'request-3' }), {
          status: 200,
        }),
      ),
    );
    await expect(apiRequest('/bookings', z.object({ id: z.string() }))).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
  it('fails closed when a signed-in token is unavailable', async () => {
    await expect(requireSessionToken(async () => null)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
});
