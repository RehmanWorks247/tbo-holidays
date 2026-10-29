import { z } from 'zod';

import { tboHotelCodeSchema } from './tbo.schemas';

const successStatus = z.object({ Code: z.literal(200), Description: z.string().optional() });
const name = z.string().trim().min(1).max(250);
export const tboCountriesResponseSchema = z.object({
  Status: successStatus,
  CountryList: z
    .array(z.object({ Code: z.string().regex(/^[A-Z]{2}$/), Name: name.max(150) }))
    .max(300),
});
export const tboCitiesResponseSchema = z.object({
  Status: successStatus,
  CityList: z.array(z.object({ Code: tboHotelCodeSchema, Name: name })).max(100_000),
});

/** Shared by indexing and queries so accents/casing never depend on DB collation. */
export function catalogSearchText(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Prisma contains uses LIKE: escape user wildcards rather than broadening a query. */
export function catalogSearchPattern(value: string): string {
  return catalogSearchText(value).replace(/[\\%_]/g, '\\$&');
}
