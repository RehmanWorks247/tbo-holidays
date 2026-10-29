import {
  type HotelSearchRequest,
  hotelSearchRequestSchema,
  type MockHotelSearchRequest,
  mockHotelSearchRequestSchema,
} from '@hotel/contracts';

export function searchStayOnly(request: HotelSearchRequest): HotelSearchRequest;
export function searchStayOnly(request: MockHotelSearchRequest): MockHotelSearchRequest;
export function searchStayOnly(request: MockHotelSearchRequest): MockHotelSearchRequest {
  return {
    destination: request.destination,
    ...(request.hotelId ? { hotelId: request.hotelId } : {}),
    checkIn: request.checkIn,
    checkOut: request.checkOut,
    nationality: request.nationality,
    currency: request.currency,
    rooms: request.rooms,
  };
}

export function serializeHotelSearch(request: MockHotelSearchRequest): string {
  const params = new URLSearchParams();
  for (const key of [
    'destination',
    'hotelId',
    'checkIn',
    'checkOut',
    'nationality',
    'currency',
  ] as const) {
    const value = request[key];
    if (value) params.set(key, value);
  }
  if (request.rooms) params.set('rooms', JSON.stringify(request.rooms));
  if (request.filters && Object.keys(request.filters).length)
    params.set('filters', JSON.stringify(request.filters));
  if (request.sort && request.sort !== 'recommended') params.set('sort', request.sort);
  if (request.page && request.page > 1) params.set('page', String(request.page));
  if (request.pageSize) params.set('pageSize', String(request.pageSize));
  return params.toString();
}

export function parseHotelSearch(params: Pick<URLSearchParams, 'get'>): HotelSearchRequest | null;
export function parseHotelSearch(
  params: Pick<URLSearchParams, 'get'>,
  mode: 'live',
): HotelSearchRequest | null;
export function parseHotelSearch(
  params: Pick<URLSearchParams, 'get'>,
  mode: 'mock',
  fallbackCurrency?: MockHotelSearchRequest['currency'],
): MockHotelSearchRequest | null;
export function parseHotelSearch(
  params: Pick<URLSearchParams, 'get'>,
  mode: 'mock' | 'live',
  fallbackCurrency?: MockHotelSearchRequest['currency'],
): MockHotelSearchRequest | null;
export function parseHotelSearch(
  params: Pick<URLSearchParams, 'get'>,
  mode: 'mock' | 'live' = 'live',
  fallbackCurrency: MockHotelSearchRequest['currency'] = 'USD',
): MockHotelSearchRequest | null {
  try {
    const rooms = params.get('rooms');
    const parsed = (
      mode === 'mock' ? mockHotelSearchRequestSchema : hotelSearchRequestSchema
    ).safeParse({
      destination: params.get('destination') ?? undefined,
      ...(params.get('hotelId') ? { hotelId: params.get('hotelId') } : {}),
      checkIn: params.get('checkIn') ?? undefined,
      checkOut: params.get('checkOut') ?? undefined,
      nationality: params.get('nationality') ?? undefined,
      currency: params.get('currency') ?? (mode === 'mock' ? fallbackCurrency : 'USD'),
      ...(rooms !== null ? { rooms: JSON.parse(rooms) as unknown } : {}),
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
