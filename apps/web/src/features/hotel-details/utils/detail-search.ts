import type { Hotel, MockHotelSearchRequest } from '@hotel/contracts';

/** Result-list filters and pagination must never hide the selected hotel's rooms. */
export function hotelDetailsSearch(
  request: MockHotelSearchRequest | null,
  hotel: Hotel | undefined,
): MockHotelSearchRequest | null {
  if (!request || !hotel) return null;
  return {
    destination: request.destination,
    checkIn: request.checkIn,
    checkOut: request.checkOut,
    nationality: request.nationality,
    rooms: request.rooms,
    currency: request.currency,
    filters: { name: hotel.name.slice(0, 100) },
    page: 1,
    pageSize: 50,
  };
}
