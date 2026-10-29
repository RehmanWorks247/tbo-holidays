import type { HotelCatalogResponse, MockHotelSearchRequest } from '@hotel/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SitePreferencesProvider } from '@/providers/site-preferences-provider';

import { HotelCatalog } from './hotel-catalog';

type CatalogOptions = {
  queryKey: readonly unknown[];
  refetchInterval: (query: {
    state: { data?: HotelCatalogResponse; error?: Error | null };
  }) => number | false;
};
const state = vi.hoisted(() => ({
  data: undefined as HotelCatalogResponse | undefined,
  isPending: false,
  error: null as Error | null,
  options: null as CatalogOptions | null,
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: CatalogOptions) => {
    state.options = options;
    return {
      data: state.data,
      isPending: state.isPending,
      error: state.error,
      isFetching: false,
      refetch: vi.fn(),
    };
  },
}));

beforeEach(() => {
  state.isPending = false;
  state.error = null;
  state.options = null;
  state.data = {
    source: 'live',
    hotels: [
      {
        id: '1000001',
        name: 'Real supplier hotel',
        city: 'Istanbul',
        countryCode: 'TR',
        images: [],
        facilities: [],
        source: 'live',
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    syncing: false,
  };
});

function render(search: MockHotelSearchRequest = { destination: 'Turkey', currency: 'GBP' }) {
  return renderToStaticMarkup(
    <SitePreferencesProvider>
      <HotelCatalog search={search} />
    </SitePreferencesProvider>,
  );
}

describe('live hotel catalogue browsing', () => {
  it('uses the same unrestricted catalogue query for bare browsing and default guests/currency', () => {
    const bareMarkup = render({ currency: 'USD' });
    expect(state.options?.queryKey).toEqual([
      'hotel-catalog',
      { query: '', page: 1, pageSize: 20 },
    ]);
    const defaultsMarkup = render({
      currency: 'USD',
      rooms: [{ adults: 2, childrenAges: [] }],
    });
    expect(state.options?.queryKey).toEqual([
      'hotel-catalog',
      { query: '', page: 1, pageSize: 20 },
    ]);
    expect(bareMarkup).toContain('<h1>All hotels</h1>');
    expect(defaultsMarkup).toContain('<h1>All hotels</h1>');
    expect(defaultsMarkup).not.toContain('taxes included');
  });

  it('makes clear the complete TBO catalogue is still loading while retaining loaded hotels', () => {
    state.data!.syncing = true;
    state.data!.total = 123;
    state.data!.totalPages = 7;
    const markup = render({ currency: 'USD', rooms: [{ adults: 2, childrenAges: [] }] });
    expect(markup).toContain('123 hotels loaded so far');
    expect(markup).toContain(
      'Loading all hotels available in the TBO catalogue across countries and cities',
    );
    expect(markup).toContain('Real supplier hotel');
    expect(markup).toContain('Hotel catalogue pages');
    expect(markup).toContain('Page 1 of 7');
  });

  it('shows supplier hotel content without invented stay prices', () => {
    const markup = render();
    expect(markup).toContain('Real supplier hotel');
    expect(markup).toContain('Istanbul');
    expect(markup).toContain('1 hotels found');
    expect(markup).toContain('View hotel');
    expect(markup).not.toContain('Sample');
    expect(markup).not.toContain('taxes included');
    expect(state.options?.queryKey).toEqual([
      'hotel-catalog',
      { query: 'Turkey', page: 1, pageSize: 20 },
    ]);
  });

  it('only polls while supplier content is still loading', () => {
    state.data!.syncing = true;
    const markup = render();
    expect(markup).toContain('loaded so far');
    expect(markup).toContain('Real supplier hotel');
    const interval = state.options!.refetchInterval;
    expect(interval({ state: { data: state.data } })).toBe(2_500);
    expect(interval({ state: { data: { ...state.data!, syncing: false } } })).toBe(false);
    expect(interval({ state: {} })).toBe(false);
  });

  it('explains an empty catalogue after synchronization finishes', () => {
    state.data = { ...state.data!, hotels: [], total: 0, totalPages: 0 };
    const markup = render();
    expect(markup).toContain('No hotels match this search');
    expect(markup).toContain('Try another country, city or hotel name');
  });

  it('stops polling retained syncing data after a failed refresh and offers manual retry', () => {
    state.data!.syncing = true;
    state.error = new Error('Connection unavailable');
    const markup = render();
    expect(
      state.options!.refetchInterval({ state: { data: state.data, error: state.error } }),
    ).toBe(false);
    expect(markup).toContain('Real supplier hotel');
    expect(markup).toContain('Try again');
    expect(markup).not.toContain('Loading more matching hotels');
  });
});
