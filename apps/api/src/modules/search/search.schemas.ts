import { hotelSchema, hotelSearchRequestSchema, hotelSearchResultSchema } from '@hotel/contracts';
import { z } from 'zod';

/** Query arrays travel as JSON so multi-room occupancy remains unambiguous. */
export const hotelSearchQuerySchema = z.preprocess((value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const query = { ...value } as Record<string, unknown>;
  for (const field of ['rooms', 'filters']) {
    if (typeof query[field] === 'string') {
      try {
        query[field] = JSON.parse(query[field]) as unknown;
      } catch {
        return value;
      }
    }
  }
  for (const field of ['page', 'pageSize']) {
    if (typeof query[field] === 'string' && /^\d+$/.test(query[field]))
      query[field] = Number(query[field]);
  }
  return query;
}, hotelSearchRequestSchema);

export const cachedRateSchema = z.object({
  supplier: z.string(),
  hotel: hotelSchema,
  criteria: hotelSearchRequestSchema,
  supplierRateId: z.string().min(1),
  roomName: z.string(),
  roomNames: z.array(z.string()).min(1).optional(),
  currency: z.string(),
  expiresAt: z.iso.datetime(),
});

export const cachedHotelInventorySchema = z.object({
  expiresAt: z.iso.datetime(),
  hotels: z.array(hotelSearchResultSchema),
});
