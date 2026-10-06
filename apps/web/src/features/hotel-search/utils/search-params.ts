import { type HotelSearchRequest, hotelSearchRequestSchema } from '@hotel/contracts';

export function serializeHotelSearch(request: HotelSearchRequest): string {
  return new URLSearchParams({
    destination: request.destination,
    checkIn: request.checkIn,
    checkOut: request.checkOut,
    nationality: request.nationality,
    currency: request.currency,
    rooms: JSON.stringify(request.rooms),
  }).toString();
}

export function parseHotelSearch(params: Pick<URLSearchParams, 'get'>): HotelSearchRequest | null {
  try {
    const rooms: unknown = JSON.parse(params.get('rooms') ?? '[]');
    const parsed = hotelSearchRequestSchema.safeParse({
      destination: params.get('destination'),
      checkIn: params.get('checkIn'),
      checkOut: params.get('checkOut'),
      nationality: params.get('nationality'),
      currency: params.get('currency') ?? 'USD',
      rooms,
    });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
