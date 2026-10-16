import type { HotelResultsFilters } from '@hotel/contracts';
import { describe, expect, it } from 'vitest';

import { activeFilterChips, removeFilterChip } from './filter-chips';

const selection: HotelResultsFilters = {
  name: 'Palm',
  minPrice: 0,
  maxPrice: 123456,
  starRatings: [4, 5],
  facilities: ['Free WiFi', 'Swimming pool'],
  mealTypes: ['Breakfast included', 'All inclusive'],
  propertyTypes: ['Hotel', 'Resort'],
  neighbourhoods: ['Dubai Marina', 'Palm Jumeirah'],
  minReviewScore: 8,
  refundable: true,
  maxBeachDistance: 500,
};

describe('active hotel filter chips', () => {
  it('keeps budget cents visible instead of rounding the applied backend limit', () => {
    expect(
      activeFilterChips({ minPrice: 1234, maxPrice: 4567 }, 'USD', 'en-US').map(
        (chip) => chip.label,
      ),
    ).toEqual(['From $12.34', 'Up to $45.67']);
  });

  it('represents zero thresholds and explicit non-refundable filters as removable selections', () => {
    const filters: HotelResultsFilters = {
      minPrice: 0,
      maxPrice: 0,
      minReviewScore: 0,
      maxBeachDistance: 0,
      refundable: false,
    };
    const chips = activeFilterChips(filters, 'GBP', 'en-GB');
    expect(chips.map((chip) => chip.key)).toEqual([
      'minPrice',
      'maxPrice',
      'minReviewScore',
      'refundable',
      'maxBeachDistance',
    ]);
    expect(chips.find((chip) => chip.key === 'refundable')?.label).toBe('Non-refundable rates');
    for (const chip of chips) expect(removeFilterChip(filters, chip)).not.toHaveProperty(chip.key);
  });

  it.each(['starRatings', 'facilities', 'mealTypes', 'propertyTypes', 'neighbourhoods'] as const)(
    'removes only one %s selection and preserves unrelated criteria',
    (key) => {
      const original = structuredClone(selection);
      const chips = activeFilterChips(selection, 'GBP', 'en-GB');
      const target = chips.find((chip) => chip.key === key);
      expect(target).toBeDefined();
      const next = removeFilterChip(selection, target!);
      expect(next[key]).toEqual(selection[key]?.slice(1));
      const other = { ...next, [key]: selection[key] };
      expect(other).toEqual(original);
      expect(selection).toEqual(original);
    },
  );

  it('removes the final array item without leaving a visible active chip', () => {
    const filters: HotelResultsFilters = { facilities: ['Spa'], refundable: true };
    const chip = activeFilterChips(filters, 'USD', 'en-US').find(
      (item) => item.key === 'facilities',
    )!;
    const next = removeFilterChip(filters, chip);
    expect(activeFilterChips(next, 'USD', 'en-US').map((item) => item.key)).toEqual(['refundable']);
    expect(filters.facilities).toEqual(['Spa']);
  });
});
