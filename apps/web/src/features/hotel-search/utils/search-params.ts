import { type HotelSearchRequest, hotelSearchRequestSchema } from '@hotel/contracts';

export function searchStayOnly(request: HotelSearchRequest): HotelSearchRequest {
  return {
    destination: request.destination,
    checkIn: request.checkIn,
    checkOut: request.checkOut,
    nationality: request.nationality,
    currency: request.currency,
    rooms: request.rooms,
  };
}

export function serializeHotelSearch(request: HotelSearchRequest): string {
  const params = new URLSearchParams({
    destination: request.destination,
    checkIn: request.checkIn,
    checkOut: request.checkOut,
    nationality: request.nationality,
    currency: request.currency,
    rooms: JSON.stringify(request.rooms),
  });
  if (request.filters && Object.keys(request.filters).length)
    params.set('filters', JSON.stringify(request.filters));
  if (request.sort && request.sort !== 'recommended') params.set('sort', request.sort);
  if (request.page && request.page > 1) params.set('page', String(request.page));
  if (request.pageSize) params.set('pageSize', String(request.pageSize));
  return params.toString();
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
      ...(params.get('filters') ? { filters: JSON.parse(params.get('filters')!) as unknown } : {}),
      ...(params.get('sort') ? { sort: params.get('sort') } : {}),
      ...(params.get('page') ? { page: Number(params.get('page')) } : {}),
      ...(params.get('pageSize') ? { pageSize: Number(params.get('pageSize')) } : {}),
    });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Only used after the API explicitly reports mock inventory. */
export function defaultMockSearch(
  currency: HotelSearchRequest['currency'],
  now = new Date(),
): HotelSearchRequest {
  const checkIn = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30),
  );
  const checkOut = new Date(checkIn.getTime() + 7 * 86_400_000);
  return {
    destination: 'dubai',
    checkIn: checkIn.toISOString().slice(0, 10),
    checkOut: checkOut.toISOString().slice(0, 10),
    nationality: 'GB',
    currency,
    rooms: [{ adults: 2, childrenAges: [] }],
  };
}
