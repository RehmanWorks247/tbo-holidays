import type { HotelSearchRequest, HotelSearchResponse, HotelSearchResult } from '@hotel/contracts';

function counts(values: string[][]): { value: string; count: number }[] {
  const totals = new Map<string, number>();
  for (const entries of values) {
    for (const value of new Set(entries)) totals.set(value, (totals.get(value) ?? 0) + 1);
  }
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => ({ value, count }));
}

// Each result's eligible rates are sorted once before hotel sorting.
const minimumPrice = (result: HotelSearchResult) => result.rates[0]?.price.totalAmount ?? Infinity;

/** All budgets refer to the complete stay and room combination, in minor units. */
export function browseHotelResults(
  inventory: HotelSearchResult[],
  input: Pick<HotelSearchRequest, 'filters' | 'sort' | 'page' | 'pageSize'>,
  source: 'mock' | 'live',
  destination: string,
): HotelSearchResponse {
  const available = inventory.filter((result) => result.rates.length > 0);
  let minPrice = Infinity;
  let maxPrice = 0;
  for (const { rates } of available) {
    for (const { price } of rates) {
      minPrice = Math.min(minPrice, price.totalAmount);
      maxPrice = Math.max(maxPrice, price.totalAmount);
    }
  }
  const filters = input.filters ?? {};
  const name = filters.name?.trim().toLocaleLowerCase('en');
  const hotels = available.flatMap((result) => {
    const { hotel } = result;
    if (name && !hotel.name.toLocaleLowerCase('en').includes(name)) return [];
    if (filters.starRatings?.length && !filters.starRatings.includes(hotel.starRating ?? 0))
      return [];
    if (filters.minReviewScore !== undefined && (hotel.reviewScore ?? 0) < filters.minReviewScore)
      return [];
    if (filters.facilities?.some((facility) => !hotel.facilities.includes(facility))) return [];
    if (filters.propertyTypes?.length && !filters.propertyTypes.includes(hotel.propertyType ?? ''))
      return [];
    if (
      filters.neighbourhoods?.length &&
      !filters.neighbourhoods.includes(hotel.neighbourhood ?? '')
    )
      return [];
    if (
      filters.maxBeachDistance !== undefined &&
      (hotel.beachDistanceMeters === undefined ||
        hotel.beachDistanceMeters > filters.maxBeachDistance)
    )
      return [];
    const rates = result.rates
      .filter(
        (rate) =>
          (filters.mealTypes?.length ? filters.mealTypes.includes(rate.mealType ?? '') : true) &&
          (filters.refundable === undefined || rate.refundable === filters.refundable) &&
          (filters.minPrice === undefined || rate.price.totalAmount >= filters.minPrice) &&
          (filters.maxPrice === undefined || rate.price.totalAmount <= filters.maxPrice),
      )
      .sort((a, b) => a.price.totalAmount - b.price.totalAmount);
    return rates.length ? [{ hotel, rates }] : [];
  });
  const sort = input.sort ?? 'recommended';
  hotels.sort((a, b) => {
    let comparison = 0;
    if (sort === 'price-asc') comparison = minimumPrice(a) - minimumPrice(b);
    if (sort === 'price-desc') comparison = minimumPrice(b) - minimumPrice(a);
    if (sort === 'rating') comparison = (b.hotel.reviewScore ?? 0) - (a.hotel.reviewScore ?? 0);
    if (sort === 'stars') comparison = (b.hotel.starRating ?? 0) - (a.hotel.starRating ?? 0);
    // Recommended preserves provider ranking, including deterministic fixture curation.
    return comparison || (sort === 'recommended' ? 0 : a.hotel.id.localeCompare(b.hotel.id));
  });
  const pageSize = input.pageSize ?? 12;
  const totalPages = Math.ceil(hotels.length / pageSize);
  const page = input.page ?? 1;
  return {
    hotels: hotels.slice((page - 1) * pageSize, page * pageSize),
    metadata: {
      source,
      total: hotels.length,
      page,
      pageSize,
      totalPages,
      destination,
      facets: {
        minPrice: Number.isFinite(minPrice) ? minPrice : 0,
        maxPrice,
        starRatings: [5, 4, 3, 2, 1]
          .map((value) => ({
            value,
            count: available.filter(({ hotel }) => hotel.starRating === value).length,
          }))
          .filter(({ count }) => count > 0),
        reviewScores: [9, 8, 7, 6].map((value) => ({
          value,
          count: available.filter(({ hotel }) => (hotel.reviewScore ?? 0) >= value).length,
        })),
        facilities: counts(available.map(({ hotel }) => hotel.facilities)),
        mealTypes: counts(
          available.map(({ rates }) =>
            rates.flatMap((rate) => (rate.mealType ? [rate.mealType] : [])),
          ),
        ),
        propertyTypes: counts(
          available.map(({ hotel }) => (hotel.propertyType ? [hotel.propertyType] : [])),
        ),
        neighbourhoods: counts(
          available.map(({ hotel }) => (hotel.neighbourhood ? [hotel.neighbourhood] : [])),
        ),
        refundableCount: available.filter(({ rates }) => rates.some((rate) => rate.refundable))
          .length,
      },
    },
  };
}
