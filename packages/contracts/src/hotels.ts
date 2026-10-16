import { z } from 'zod';

import { amountSchema, currencySchema, priceBreakdownSchema } from './common';

export const DEFAULT_MAX_STAY_NIGHTS = 30;
export const dateOnlySchema = z.iso.date();
export const roomOccupancySchema = z
  .object({
    adults: z.number().int().min(1).max(4),
    childrenAges: z.array(z.number().int().min(0).max(17)).max(2),
  })
  .strict();
export type RoomOccupancy = z.infer<typeof roomOccupancySchema>;
export const hotelResultsFiltersSchema = z
  .object({
    name: z.string().max(100).optional(),
    minPrice: amountSchema.optional(),
    maxPrice: amountSchema.optional(),
    starRatings: z.array(z.number().int().min(1).max(5)).max(5).optional(),
    minReviewScore: z.number().min(0).max(10).optional(),
    facilities: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    mealTypes: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
    refundable: z.boolean().optional(),
    propertyTypes: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
    neighbourhoods: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    maxBeachDistance: z.number().int().min(0).max(100_000).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
    {
      message: 'Minimum price cannot exceed maximum price.',
      path: ['maxPrice'],
    },
  );
export type HotelResultsFilters = z.infer<typeof hotelResultsFiltersSchema>;
export const hotelSortSchema = z.enum([
  'recommended',
  'price-asc',
  'price-desc',
  'rating',
  'stars',
]);
export type HotelSort = z.infer<typeof hotelSortSchema>;
export const hotelSearchRequestSchema = z
  .object({
    destination: z.string().trim().min(1).max(100),
    checkIn: dateOnlySchema,
    checkOut: dateOnlySchema,
    nationality: z.string().regex(/^[A-Z]{2}$/),
    rooms: z.array(roomOccupancySchema).min(1).max(4),
    currency: currencySchema.default('USD'),
    filters: hotelResultsFiltersSchema.optional(),
    sort: hotelSortSchema.optional(),
    page: z.number().int().min(1).max(10_000).optional(),
    pageSize: z.number().int().min(1).max(50).optional(),
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
  images: z.array(
    z.union([z.url(), z.string().regex(/^\/images\/hotels\/[a-z0-9-]+\.(?:jpg|webp)$/)]),
  ),
  facilities: z.array(z.string()),
  source: z.enum(['mock', 'live']).optional(),
  reviewScore: z.number().min(0).max(10).optional(),
  reviewCount: z.number().int().nonnegative().optional(),
  neighbourhood: z.string().optional(),
  propertyType: z.string().optional(),
  beachDistanceMeters: z.number().int().nonnegative().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  badges: z.array(z.string()).optional(),
});
export type Hotel = z.infer<typeof hotelSchema>;

const cancellationPolicyBase = {
  /** Hotel-local wall clock; no UTC offset is supplied by the supplier. */
  from: z.iso
    .datetime({ local: true, precision: 0 })
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/),
  timeBasis: z.literal('property-local'),
  /** Zero-based room index; absent means the complete room combination. */
  roomIndex: z.number().int().min(0).optional(),
};
export const cancellationPolicySchema = z.discriminatedUnion('chargeType', [
  z.object({
    ...cancellationPolicyBase,
    chargeType: z.literal('fixed'),
    amount: amountSchema,
    currency: z.string().regex(/^[A-Z]{3}$/),
  }),
  z.object({
    ...cancellationPolicyBase,
    chargeType: z.literal('percentage'),
    percentageBasisPoints: z.number().int().min(0).max(10_000),
  }),
]);
export type CancellationPolicy = z.infer<typeof cancellationPolicySchema>;

export const hotelRateTermsSchema = z.object({
  roomNames: z.array(z.string()).min(1),
  inclusion: z.string().optional(),
  amenities: z.array(z.string()),
  promotions: z.array(z.string()),
  withTransfers: z.boolean().optional(),
  rateConditions: z.array(z.string()),
  supplements: z.array(
    z.object({
      roomIndex: z.number().int().min(0).optional(),
      payment: z.enum(['included', 'at-property']),
      description: z.string(),
      amount: amountSchema,
      currency: z.string().regex(/^[A-Z]{3}$/),
    }),
  ),
  /** Informational component of the supplier's aggregate fare, never added twice. */
  extraGuestAmount: amountSchema.optional(),
});
export type HotelRateTerms = z.infer<typeof hotelRateTermsSchema>;

export const hotelRateSchema = z.object({
  rateId: z.string(),
  roomName: z.string(),
  mealType: z.string().optional(),
  refundable: z.boolean(),
  price: priceBreakdownSchema,
  expiresAt: z.iso.datetime(),
  cancellationPolicies: z.array(cancellationPolicySchema).optional(),
  terms: hotelRateTermsSchema.optional(),
});
export type HotelRate = z.infer<typeof hotelRateSchema>;
export const hotelSearchResultSchema = z.object({
  hotel: hotelSchema,
  rates: z.array(hotelRateSchema),
});
export type HotelSearchResult = z.infer<typeof hotelSearchResultSchema>;
const textFacetSchema = z.object({ value: z.string(), count: z.number().int().nonnegative() });
const numericFacetSchema = z.object({ value: z.number(), count: z.number().int().nonnegative() });
export const hotelSearchMetadataSchema = z.object({
  source: z.enum(['mock', 'live']),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  destination: z.string(),
  facets: z.object({
    minPrice: amountSchema,
    maxPrice: amountSchema,
    starRatings: z.array(numericFacetSchema),
    reviewScores: z.array(numericFacetSchema),
    facilities: z.array(textFacetSchema),
    mealTypes: z.array(textFacetSchema),
    propertyTypes: z.array(textFacetSchema),
    neighbourhoods: z.array(textFacetSchema),
    refundableCount: z.number().int().nonnegative(),
  }),
});
export type HotelSearchMetadata = z.infer<typeof hotelSearchMetadataSchema>;
export const hotelSearchResponseSchema = z.object({
  hotels: z.array(hotelSearchResultSchema),
  metadata: hotelSearchMetadataSchema.optional(),
});
export type HotelSearchResponse = z.infer<typeof hotelSearchResponseSchema>;
export const hotelDestinationsResponseSchema = z.object({
  source: z.enum(['mock', 'live']),
  destinations: z.array(
    z.object({ id: z.string(), name: z.string(), countryCode: z.string().regex(/^[A-Z]{2}$/) }),
  ),
});
export type HotelDestinationsResponse = z.infer<typeof hotelDestinationsResponseSchema>;
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
  refundable: z.boolean().optional(),
  mealType: z.string().optional(),
  cancellationPolicies: z.array(cancellationPolicySchema).optional(),
  terms: hotelRateTermsSchema.optional(),
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
