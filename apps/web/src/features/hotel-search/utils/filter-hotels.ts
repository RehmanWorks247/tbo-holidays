import type { HotelFilters, HotelSearchResult } from '@hotel/contracts';

// Display filters only. Every selected rate is rechecked by the API before checkout.
export function filterHotels(
  results: HotelSearchResult[],
  filters: HotelFilters,
): HotelSearchResult[] {
  return results.filter(({ hotel, rates }) => {
    if (filters.name && !hotel.name.toLowerCase().includes(filters.name.toLowerCase()))
      return false;
    if (filters.starRating && hotel.starRating !== filters.starRating) return false;
    if (filters.facilities?.some((facility) => !hotel.facilities.includes(facility))) return false;
    return rates.some(
      (rate) =>
        (filters.maxPrice === undefined || rate.price.totalAmount <= filters.maxPrice) &&
        (filters.refundable === undefined || rate.refundable === filters.refundable) &&
        (filters.mealType === undefined || rate.mealType === filters.mealType),
    );
  });
}
