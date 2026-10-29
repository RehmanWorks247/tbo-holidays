import { afterEach, describe, expect, it, vi } from 'vitest';

import { hotelsApi } from './hotels.api';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('hotel API requests', () => {
  it('browses supplier hotel content with an encoded country query and explicit pagination', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            source: 'live',
            hotels: [],
            total: 0,
            page: 2,
            pageSize: 20,
            totalPages: 0,
            syncing: true,
          },
          requestId: 'catalog-1',
        }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const result = await hotelsApi.catalog({ query: 'country:TR', page: 2, pageSize: 20 });
    const url = new URL(fetch.mock.calls[0]![0] as string);
    expect(url.pathname).toContain('/hotels/catalog');
    expect(url.searchParams.get('query')).toBe('country:TR');
    expect(url.searchParams.get('page')).toBe('2');
    expect(result.syncing).toBe(true);
  });
  it('encodes typed suggestions, bounds the dropdown, and carries cancellation', async () => {
    const controller = new AbortController();
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            source: 'live',
            suggestions: [
              {
                id: '1000001',
                type: 'hotel',
                name: 'Palm & Sea',
                destinationId: '115936',
                destinationName: 'Dubai',
                countryCode: 'AE',
              },
            ],
          },
          requestId: 'suggestions-1',
        }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const result = await hotelsApi.suggestions('Palm & Sea', controller.signal);
    const url = new URL(fetch.mock.calls[0]![0] as string);
    expect(url.searchParams.get('query')).toBe('Palm & Sea');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(result.suggestions[0]?.destinationId).toBe('115936');
    const options = fetch.mock.calls[0]![1] as RequestInit;
    controller.abort();
    expect(options.signal?.aborted).toBe(true);
  });

  it('allows supplier availability time without changing the short autocomplete deadline', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { hotels: [] },
            requestId: 'search-1',
          }),
        ),
      ),
    );
    await hotelsApi.search({
      destination: '115936',
      hotelId: '1000001',
      checkIn: '2030-01-10',
      checkOut: '2030-01-12',
      nationality: 'GB',
      currency: 'USD',
      rooms: [{ adults: 2, childrenAges: [] }],
    });
    expect(timeout).toHaveBeenCalledWith(120_000);
  });
});
