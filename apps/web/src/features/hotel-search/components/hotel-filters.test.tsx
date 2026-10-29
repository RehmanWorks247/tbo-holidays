import type { HotelResultsFilters, HotelSearchMetadata } from '@hotel/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { SitePreferencesProvider } from '@/providers/site-preferences-provider';

import { HotelFilters } from './hotel-filters';

const facets: HotelSearchMetadata['facets'] = {
  minPrice: 10000,
  maxPrice: 50000,
  starRatings: [{ value: 4, count: 3 }],
  reviewScores: [
    { value: 7, count: 0 },
    { value: 8, count: 0 },
    { value: 9, count: 0 },
  ],
  facilities: [{ value: 'Private beach area', count: 2 }],
  mealTypes: [{ value: 'All_Inclusive_All_Meal', count: 1 }],
  propertyTypes: [],
  neighbourhoods: [],
  refundableCount: 2,
};

function render(
  value: HotelResultsFilters = {},
  source: 'live' | 'mock' = 'live',
  availableFacets = facets,
) {
  return renderToStaticMarkup(
    <SitePreferencesProvider initialLocale="en-GB">
      <HotelFilters value={value} onChange={vi.fn()} facets={availableFacets} source={source} />
    </SitePreferencesProvider>,
  );
}

describe('filters for supplier inventory', () => {
  it('offers popular shortcuts using exact supplier facet labels', () => {
    const html = render();
    expect(html).toContain('All_Inclusive_All_Meal');
    expect(html).toContain('Private beach area');
    expect(html).toContain('4-star hotel');
    expect(html).not.toContain('5-star hotel');
    expect(html).not.toContain('>All inclusive<');
    expect(html).not.toContain('>Beach<');
    expect(html).not.toContain('8+ guest rating');
  });

  it('omits unavailable review, property, neighbourhood and distance filters', () => {
    const html = render();
    expect(html).not.toContain('Guest rating');
    expect(html).not.toContain('Property type');
    expect(html).not.toContain('Neighbourhood');
    expect(html).not.toContain('Distance to the beach');
    expect(html).toContain('Cancellation options');
    expect(html).toContain('Board basis');
  });

  it('keeps selected absent facets visible so a saved URL can be cleared', () => {
    const html = render({
      propertyTypes: ['Villa'],
      neighbourhoods: ['Old Town'],
      minReviewScore: 8,
      maxBeachDistance: 500,
    });
    expect(html).toContain('Villa');
    expect(html).toContain('Old Town');
    expect(html).toContain('Any guest rating');
    expect(html).toContain('Any distance');
    expect(html).toContain('Beach distance is not supplied');
    expect(html).not.toContain('Within 500 m');
  });

  it('preserves mock beach distance choices and verified review facets', () => {
    const html = render({}, 'mock', {
      ...facets,
      reviewScores: [{ value: 8, count: 3 }],
      propertyTypes: [{ value: 'Resort', count: 2 }],
      neighbourhoods: [{ value: 'Marina', count: 1 }],
    });
    expect(html).toContain('Within 500 m');
    expect(html).toContain('8+ guest rating');
    expect(html).toContain('Excellent');
    expect(html).toContain('Resort');
    expect(html).toContain('Marina');
    expect(html).not.toContain('Exceptional');
  });

  it('does not show empty meal and facility sections', () => {
    const html = render({}, 'live', { ...facets, mealTypes: [], facilities: [] });
    expect(html).not.toContain('Board basis');
    expect(html).not.toContain('Hotel facilities');
  });
});
