import type { HotelSearchSuggestion } from '@hotel/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HotelDestinationPicker } from './hotel-destination-picker';

const state = vi.hoisted(() => ({ suggestions: [] as HotelSearchSuggestion[] }));
vi.mock('@/features/hotel-search/queries/use-hotel-suggestions', () => ({
  useHotelSuggestions: () => ({
    data: { source: 'live', suggestions: state.suggestions },
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

beforeEach(() => {
  state.suggestions = [];
});

function render(value: { destination: string; hotelId?: string }, initialLabel?: string) {
  return renderToStaticMarkup(
    <HotelDestinationPicker
      id="destination"
      value={value}
      initialLabel={initialLabel}
      onChange={vi.fn()}
      onBlur={vi.fn()}
    />,
  );
}

describe('hotel destination autocomplete', () => {
  it('renders a keyboard accessible combobox instead of a raw city-code field', () => {
    const markup = render({ destination: '' });
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-autocomplete="list"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('placeholder="Country, city or hotel name"');
  });

  it('restores the selected city name after the exact-id suggestion lookup', () => {
    state.suggestions = [
      {
        id: '115936',
        type: 'destination',
        name: 'Dubai',
        destinationId: '115936',
        destinationName: 'Dubai',
        countryCode: 'AE',
      },
    ];
    const markup = render({ destination: '115936' });
    expect(markup).toContain('value="Dubai"');
    expect(markup).not.toContain('value="115936"');
  });

  it('restores a hotel selection with its city and escapes supplier text', () => {
    state.suggestions = [
      {
        id: '1000001',
        type: 'hotel',
        name: 'Palm & Sea <Hotel>',
        destinationId: '115936',
        destinationName: 'Dubai',
        countryCode: 'AE',
      },
    ];
    const markup = render({ destination: '115936', hotelId: '1000001' });
    expect(markup).toContain('Palm &amp; Sea &lt;Hotel&gt;, Dubai');
    expect(markup).not.toContain('<Hotel>');
  });

  it('keeps a typed country or city name visible without requiring a suggestion selection', () => {
    expect(render({ destination: 'tUrKeY' })).toContain('value="tUrKeY"');
    expect(render({ destination: 'istanbul' })).toContain('value="istanbul"');
  });

  it('restores a selected country instead of presenting it as a city', () => {
    state.suggestions = [
      {
        id: 'country:TR',
        type: 'country',
        name: 'Turkey',
        destinationId: 'country:TR',
        destinationName: 'Turkey',
        countryCode: 'TR',
        countryName: 'Turkey',
      },
    ];
    expect(render({ destination: 'country:TR' })).toContain('value="Turkey"');
  });
});
