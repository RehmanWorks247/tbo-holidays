import { hotelSchema, hotelSearchRequestSchema } from '@hotel/contracts';
import { z } from 'zod';

/** Query arrays travel as JSON so multi-room occupancy remains unambiguous. */
export const hotelSearchQuerySchema = z.preprocess((value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const query = { ...value } as Record<string, unknown>;
  if (typeof query.rooms === 'string') {
    try {
      query.rooms = JSON.parse(query.rooms) as unknown;
    } catch {
      return value;
    }
  }
  return query;
}, hotelSearchRequestSchema);

export const cachedRateSchema = z.object({
  supplier: z.string(),
  hotel: hotelSchema,
  criteria: hotelSearchRequestSchema,
  supplierRateId: z.string().min(1),
  roomName: z.string(),
  currency: z.string(),
  expiresAt: z.iso.datetime(),
});
