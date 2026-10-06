import { z } from 'zod';

import { currencySchema, priceBreakdownSchema } from './common';

export const DEFAULT_MAX_STAY_NIGHTS = 30;
export const dateOnlySchema = z.iso.date();
export const roomOccupancySchema = z
  .object({
    adults: z.number().int().min(1).max(4),
    childrenAges: z.array(z.number().int().min(0).max(17)).max(2),
  })
  .strict();
export type RoomOccupancy = z.infer<typeof roomOccupancySchema>;
export const hotelSearchRequestSchema = z
  .object({
    destination: z.string().trim().min(1).max(100),
    checkIn: dateOnlySchema,
    checkOut: dateOnlySchema,
    nationality: z.string().regex(/^[A-Z]{2}$/),
    rooms: z.array(roomOccupancySchema).min(1).max(4),
    currency: currencySchema.default('USD'),
  })
  .strict()
  .refine((value) => value.checkOut > value.checkIn, {
    message: 'Check-out must be after check-in.',
    path: ['checkOut'],
  });
export type HotelSearchRequest = z.infer<typeof hotelSearchRequestSchema>;

/** UTC date-only comparison is consistent across browsers and the API. */
export function validateStay(
  checkIn: string,
  checkOut: string,
  maximumNights = DEFAULT_MAX_STAY_NIGHTS,
  now = new Date(),
): string | undefined {
  if (!dateOnlySchema.safeParse(checkIn).success || !dateOnlySchema.safeParse(checkOut).success)
    return 'Enter valid stay dates.';
  if (checkIn < now.toISOString().slice(0, 10)) return 'Check-in cannot be in the past.';
  const nights = (Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000;
  if (nights <= 0) return 'Check-out must be after check-in.';
  if (nights > maximumNights) return `Stays may not exceed ${maximumNights} nights.`;
  return undefined;
}

export const hotelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  countryCode: z.string().optional(),
  starRating: z.number().min(0).max(5).optional(),
  images: z.array(z.url()),
  facilities: z.array(z.string()),
});
export type Hotel = z.infer<typeof hotelSchema>;
export const hotelRateSchema = z.object({
  rateId: z.string(),
  roomName: z.string(),
  mealType: z.string().optional(),
  refundable: z.boolean(),
  price: priceBreakdownSchema,
  expiresAt: z.iso.datetime(),
});
export type HotelRate = z.infer<typeof hotelRateSchema>;
export const hotelSearchResultSchema = z.object({
  hotel: hotelSchema,
  rates: z.array(hotelRateSchema),
});
export type HotelSearchResult = z.infer<typeof hotelSearchResultSchema>;
export const hotelSearchResponseSchema = z.object({ hotels: z.array(hotelSearchResultSchema) });
export type HotelSearchResponse = z.infer<typeof hotelSearchResponseSchema>;
export const recheckRequestSchema = z.object({ rateId: z.string().min(1).max(500) }).strict();
export type RecheckRequest = z.infer<typeof recheckRequestSchema>;
export const quoteResponseSchema = z.object({
  id: z.uuid(),
  hotel: hotelSchema,
  checkIn: dateOnlySchema,
  checkOut: dateOnlySchema,
  rooms: z.array(roomOccupancySchema),
  price: priceBreakdownSchema,
  expiresAt: z.iso.datetime(),
});
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;
export const hotelFiltersSchema = z.object({
  name: z.string().optional(),
  maxPrice: z.number().nonnegative().optional(),
  starRating: z.number().int().min(1).max(5).optional(),
  facilities: z.array(z.string()).optional(),
  mealType: z.string().optional(),
  refundable: z.boolean().optional(),
});
export type HotelFilters = z.infer<typeof hotelFiltersSchema>;
