import type {
  HotelResultsFilters,
  HotelSearchRequest,
  HotelSearchResponse,
  MockHotelSearchRequest,
} from '@hotel/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  parseHotelSearch,
  serializeHotelSearch,
} from '@/features/hotel-search/utils/search-params';
import { SitePreferencesProvider } from '@/providers/site-preferences-provider';
import { ApiError } from '@/services/api/api-client';

import { HotelResults } from './hotel-results';

const state = vi.hoisted(() => ({
  params: new URLSearchParams(),
  debounced: { request: null as MockHotelSearchRequest | null, settling: false },
  source: 'mock' as 'mock' | 'live' | undefined,
  initialSearch: null as MockHotelSearchRequest | null,
  catalogSearch: null as MockHotelSearchRequest | null,
  search: {
    data: undefined as HotelSearchResponse | undefined,
    error: null as Error | null,
    isFetching: false,
    refetch: vi.fn(),
  },
  filters: null as {
    value: HotelResultsFilters;
    onChange: (filters: HotelResultsFilters) => void;
    onReset: () => void;
  } | null,
}));

vi.mock('next/navigation', () => ({ useSearchParams: () => state.params }));
vi.mock('@/features/hotel-search/queries/use-debounced-search', () => ({
  useDebouncedSearch: () => state.debounced,
}));
vi.mock('@/features/hotel-search/queries/use-hotel-search', () => ({
  useHotelSearch: () => state.search,
}));
vi.mock('@/features/hotel-search/queries/use-hotel-destinations', () => ({
  useHotelDestinations: () => ({
    data: state.source
      ? {
          source: state.source,
          destinations: [
            { id: 'dubai', name: 'Dubai', countryCode: 'AE' },
            { id: 'london', name: 'London', countryCode: 'GB' },
          ],
        }
      : undefined,
    isPending: !state.source,
    error: null,
  }),
}));
vi.mock('@/features/hotel-search/queries/use-saved-hotels', () => ({
  useSavedHotels: () => ({ ids: [], error: '', toggle: vi.fn() }),
}));
vi.mock('./hotel-search-form', () => ({
  HotelSearchForm: ({ initialSearch }: { initialSearch: MockHotelSearchRequest | null }) => {
    state.initialSearch = initialSearch;
    return <form aria-label="Search hotels" />;
  },
}));
vi.mock('./hotel-catalog', () => ({
  HotelCatalog: ({ search }: { search: MockHotelSearchRequest }) => {
    state.catalogSearch = search;
    return <section aria-label="Hotel catalogue" />;
  },
}));
vi.mock('./hotel-filters', () => ({
  HotelFilters: (props: NonNullable<typeof state.filters>) => {
    state.filters = props;
    return <aside aria-label="Filter hotels" />;
  },
}));

const request: HotelSearchRequest = {
  destination: 'dubai',
  checkIn: '2030-06-10',
  checkOut: '2030-06-17',
  nationality: 'GB',
  currency: 'USD',
  rooms: [{ adults: 2, childrenAges: [] }],
};
const response: HotelSearchResponse = {
  hotels: [
    {
      hotel: {
        id: 'mock-dubai-01',
        name: 'Previous search hotel',
        source: 'mock',
        images: [],
        facilities: [],
      },
      rates: [
        {
          rateId: 'opaque-rate-reference',
          roomName: 'Double room',
          refundable: true,
          expiresAt: '2030-06-01T12:00:00Z',
          price: {
            currency: 'USD',
            baseAmount: 60000,
            taxAmount: 9000,
            feeAmount: 0,
            markupAmount: 0,
            discountAmount: 0,
            totalAmount: 69000,
          },
        },
      ],
    },
  ],
};

function render() {
  return renderToStaticMarkup(
    <SitePreferencesProvider>
      <HotelResults />
    </SitePreferencesProvider>,
  );
}

beforeEach(() => {
  state.source = 'mock';
  state.params = new URLSearchParams(serializeHotelSearch(request));
  state.debounced = { request, settling: false };
  state.search = { data: response, error: null, isFetching: false, refetch: vi.fn() };
  state.filters = null;
  state.catalogSearch = null;
});

afterEach(() => vi.unstubAllGlobals());

describe('hotel result filter actions keep the shareable search state', () => {
  function historyHarness(initial: MockHotelSearchRequest) {
    state.params = new URLSearchParams(serializeHotelSearch(initial));
    state.debounced.request = initial;
    const write = (_data: unknown, _unused: string, url: string) => {
      state.params = new URL(url, 'https://hotel.test').searchParams;
    };
    const history = { pushState: vi.fn(write), replaceState: vi.fn(write) };
    vi.stubGlobal('window', { history });
    render();
    return { history, currentSearch: () => parseHotelSearch(state.params, 'mock') };
  }

  it('writes discrete filters immediately, resets pagination and preserves the stay and sort', () => {
    const initial: HotelSearchRequest = {
      ...request,
      sort: 'price-asc',
      page: 3,
      pageSize: 5,
      filters: { facilities: ['Free WiFi'] },
    };
    const { history, currentSearch } = historyHarness(initial);
    const nextFilters = { ...initial.filters, starRatings: [5], refundable: true };

    state.filters!.onChange(nextFilters);

    expect(history.pushState).toHaveBeenCalledOnce();
    expect(history.replaceState).not.toHaveBeenCalled();
    expect(currentSearch()).toEqual({ ...initial, page: undefined, filters: nextFilters });
    expect(state.params.has('page')).toBe(false);
    expect(state.params.get('filters')).toBe(JSON.stringify(nextFilters));
  });

  it('replaces name and budget edits while preserving unrelated selected filters', () => {
    const initial: HotelSearchRequest = {
      ...request,
      page: 2,
      filters: { starRatings: [4, 5], mealTypes: ['Breakfast included'] },
    };
    const { history, currentSearch } = historyHarness(initial);
    const changedName = { ...initial.filters, name: 'Palm & Sea' };
    state.filters!.onChange(changedName);
    render();
    state.filters!.onChange({ ...state.filters!.value, maxPrice: 123456 });

    expect(history.replaceState).toHaveBeenCalledTimes(2);
    expect(history.pushState).not.toHaveBeenCalled();
    expect(currentSearch()).toEqual({
      ...initial,
      page: undefined,
      filters: { ...changedName, maxPrice: 123456 },
    });
  });

  it('restores filter controls from a saved URL and resets filters without losing the search', () => {
    const initial: HotelSearchRequest = {
      ...request,
      sort: 'rating',
      filters: { starRatings: [5], facilities: ['Swimming pool'] },
    };
    const { currentSearch } = historyHarness(initial);
    const savedSearch = state.params.toString();
    state.filters!.onChange({ ...initial.filters, refundable: true });
    render();
    expect(state.filters!.value.refundable).toBe(true);

    state.params = new URLSearchParams(savedSearch);
    render();
    expect(state.filters!.value).toEqual(initial.filters);
    state.filters!.onReset();

    expect(currentSearch()).toEqual({ ...initial, filters: undefined });
    expect(state.params.has('filters')).toBe(false);
    expect(state.params.get('sort')).toBe('rating');
  });

  it('filters all destinations without filling missing stay criteria in the URL', () => {
    const initial: MockHotelSearchRequest = { currency: 'GBP', sort: 'rating', page: 2 };
    const { history, currentSearch } = historyHarness(initial);
    state.filters!.onChange({ starRatings: [1], minReviewScore: 7 });
    expect(history.pushState).toHaveBeenCalledOnce();
    expect(currentSearch()).toEqual({
      currency: 'GBP',
      sort: 'rating',
      filters: { starRatings: [1], minReviewScore: 7 },
    });
    for (const key of ['destination', 'checkIn', 'checkOut', 'nationality', 'rooms', 'page'])
      expect(state.params.has(key)).toBe(false);
    render();
    state.filters!.onReset();
    expect(currentSearch()).toEqual({ currency: 'GBP', sort: 'rating' });
  });
});

describe('empty mock hotel browsing', () => {
  it('renders all 45 hotels using backend sample stay context and leaves the form and URL empty', () => {
    state.params = new URLSearchParams();
    state.debounced = { request: { currency: 'USD' }, settling: false };
    state.search.data = {
      hotels: Array.from({ length: 45 }, (_, index) => ({
        ...response.hotels[0]!,
        hotel: {
          ...response.hotels[0]!.hotel,
          id: `sample-${index}`,
          name: `Sample hotel ${index}`,
        },
      })),
      metadata: {
        source: 'mock',
        total: 45,
        page: 1,
        pageSize: 50,
        totalPages: 1,
        destination: 'All destinations',
        previewStay: {
          checkIn: '2030-06-10',
          checkOut: '2030-06-17',
          nationality: 'GB',
          currency: 'USD',
          rooms: [{ adults: 2, childrenAges: [] }],
        },
        facets: {
          minPrice: 69000,
          maxPrice: 69000,
          starRatings: [],
          reviewScores: [],
          facilities: [],
          mealTypes: [],
          propertyTypes: [],
          neighbourhoods: [],
          refundableCount: 45,
        },
      },
    };
    const markup = render();
    expect(markup.match(/id="hotel-sample-/g)).toHaveLength(45);
    expect(markup).toContain('45 hotels');
    expect(markup).toContain('Explore sample hotels across all destinations');
    expect(markup).toContain('Sample stay');
    expect(markup).not.toContain('Hotel results pages');
    expect(state.initialSearch).toEqual({ currency: 'USD' });
    expect(state.params.toString()).toBe('');
  });

  it.each(['live', undefined] as const)(
    'browses the real catalogue without using preview rates when mode is %s',
    (source) => {
      state.source = source;
      state.params = new URLSearchParams();
      const markup = render();
      expect(markup).not.toContain('Previous search hotel');
      expect(state.initialSearch).toEqual({ currency: 'USD' });
      expect(state.catalogSearch).toEqual({ currency: 'USD' });
      expect(markup).toContain('Hotel catalogue');
    },
  );

  it('browses a typed country without dates and preserves it in the search form', () => {
    state.source = 'live';
    state.params = new URLSearchParams('destination=tUrKeY');
    const markup = render();
    expect(state.catalogSearch).toEqual({ destination: 'tUrKeY', currency: 'USD' });
    expect(state.initialSearch).toEqual(state.catalogSearch);
    expect(markup).not.toContain('Previous search hotel');
    expect(markup).not.toContain('incomplete or invalid');
  });

  it('routes currency and default guests without a location or stay to unrestricted live browsing', () => {
    state.source = 'live';
    state.params = new URLSearchParams({
      currency: 'USD',
      rooms: JSON.stringify([{ adults: 2, childrenAges: [] }]),
    });
    const markup = render();
    expect(state.catalogSearch).toEqual({
      currency: 'USD',
      rooms: [{ adults: 2, childrenAges: [] }],
    });
    expect(state.initialSearch).toEqual(state.catalogSearch);
    expect(markup).toContain('Hotel catalogue');
    expect(markup).not.toContain('Previous search hotel');
    expect(markup).not.toContain('incomplete or invalid');
  });
});

describe('hotel results retain only safe content during query transitions', () => {
  it.each([
    { currency: 'EUR' as const },
    { destination: 'london' },
    { hotelId: '1000001' },
    { checkIn: '2030-07-10', checkOut: '2030-07-17' },
    { nationality: 'US' },
    { rooms: [{ adults: 1, childrenAges: [9] }] },
  ])(
    'hides previous stay prices before the changed request has finished debouncing: %j',
    (changes) => {
      state.params = new URLSearchParams(serializeHotelSearch({ ...request, ...changes }));
      state.debounced.settling = true;
      const markup = render();
      expect(markup).not.toContain('Previous search hotel');
      expect(markup).not.toContain('$690.00');
      expect(markup).toContain('role="status"');
    },
  );

  it('retains matching-stay cards but removes all keyboard interaction during filter updates', () => {
    state.params = new URLSearchParams(
      serializeHotelSearch({ ...request, filters: { starRatings: [5] } }),
    );
    state.debounced.settling = true;
    const markup = render();
    expect(markup).toContain('Previous search hotel');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('inert=""');
  });

  it('restores interaction when the matching query is settled', () => {
    const markup = render();
    expect(markup).toContain('Previous search hotel');
    expect(markup).toContain('aria-busy="false"');
    expect(markup).not.toContain('inert=""');
  });

  it.each([{ currency: 'EUR' as const }, { filters: { starRatings: [5] } }])(
    'does not expose an old query error or an old-query retry while the next search settles: %j',
    (changes) => {
      state.params = new URLSearchParams(serializeHotelSearch({ ...request, ...changes }));
      state.debounced.settling = true;
      state.search.data = undefined;
      state.search.error = new ApiError(
        'API_UNAVAILABLE',
        'Old query error',
        503,
        'old-request-id',
      );
      const markup = render();
      expect(markup).not.toContain('old-request-id');
      expect(markup).not.toContain('Try again');
      expect(markup).not.toContain('role="alert"');
      expect(markup).toContain('role="status"');
    },
  );

  it('shows a current failure and retry without continuing to announce loading', () => {
    state.search.data = undefined;
    state.search.error = new ApiError(
      'API_UNAVAILABLE',
      'Current query error',
      503,
      'current-request-id',
    );
    const markup = render();
    expect(markup).toContain('current-request-id');
    expect(markup).toContain('Try again');
    expect(markup).toContain('role="alert"');
    expect(markup).not.toContain('Finding your hotel');
  });

  it('does not present cached inventory as results for an invalid search URL', () => {
    state.params = new URLSearchParams('destination=dubai&rooms=invalid');
    const markup = render();
    expect(markup).not.toContain('Previous search hotel');
    expect(markup).toContain('incomplete or invalid');
  });
});
