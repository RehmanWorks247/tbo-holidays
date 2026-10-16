import type { HotelResultsFilters } from '@hotel/contracts';

export type FilterChip = { key: keyof HotelResultsFilters; value?: string | number; label: string };

export function activeFilterChips(
  filters: HotelResultsFilters,
  currency: string,
  locale: string,
): FilterChip[] {
  const chips: FilterChip[] = [];
  const money = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount / 100);
  if (filters.name) chips.push({ key: 'name', label: `Hotel: ${filters.name}` });
  if (filters.minPrice !== undefined)
    chips.push({ key: 'minPrice', label: `From ${money(filters.minPrice)}` });
  if (filters.maxPrice !== undefined)
    chips.push({ key: 'maxPrice', label: `Up to ${money(filters.maxPrice)}` });
  for (const value of filters.starRatings ?? [])
    chips.push({ key: 'starRatings', value, label: `${value} stars` });
  if (filters.minReviewScore !== undefined)
    chips.push({ key: 'minReviewScore', label: `Guest rating ${filters.minReviewScore}+` });
  for (const key of ['facilities', 'mealTypes', 'propertyTypes', 'neighbourhoods'] as const) {
    for (const value of filters[key] ?? []) chips.push({ key, value, label: value });
  }
  if (filters.refundable !== undefined)
    chips.push({
      key: 'refundable',
      label: filters.refundable ? 'Refundable rates' : 'Non-refundable rates',
    });
  if (filters.maxBeachDistance !== undefined)
    chips.push({
      key: 'maxBeachDistance',
      label: `Beach within ${filters.maxBeachDistance >= 1000 ? `${filters.maxBeachDistance / 1000} km` : `${filters.maxBeachDistance} m`}`,
    });
  return chips;
}

export function removeFilterChip(
  filters: HotelResultsFilters,
  chip: FilterChip,
): HotelResultsFilters {
  const next = { ...filters };
  if (chip.value === undefined) {
    delete next[chip.key];
    return next;
  }
  if (chip.key === 'starRatings')
    next.starRatings = next.starRatings?.filter((value) => value !== chip.value);
  else if (
    chip.key === 'facilities' ||
    chip.key === 'mealTypes' ||
    chip.key === 'propertyTypes' ||
    chip.key === 'neighbourhoods'
  ) {
    next[chip.key] = next[chip.key]?.filter((value) => value !== chip.value);
  }
  return next;
}
