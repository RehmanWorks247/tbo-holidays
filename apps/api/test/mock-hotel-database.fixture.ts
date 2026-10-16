import { vi } from 'vitest';

import type { DatabaseService } from '../src/database/database.service';
import { buildMockSeedRecords } from '../src/modules/hotels/mock-hotel.seed';

/** Unit-test database boundary only. Runtime never imports fixture/seed arrays. */
export function createMockHotelDatabase() {
  const records = buildMockSeedRecords();
  const dates = { createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') };
  const destinations = records.destinations.map((entry) => ({ ...entry, ...dates }));
  const hotels = records.hotels.map((entry) => ({ ...entry, ...dates }));
  const rates = records.rates.map((entry) => ({ ...entry, ...dates }));
  const mockDestination = {
    findMany: vi.fn(async () => destinations),
    findFirst: vi.fn(
      async (input: { where: { OR: [{ id: string }, { aliases: { has: string } }] } }) =>
        destinations.find(
          (row) =>
            row.id === input.where.OR[0].id || row.aliases.includes(input.where.OR[1].aliases.has),
        ) ?? null,
    ),
    count: vi.fn(async () => destinations.length),
  };
  const withDestination = (hotel: (typeof hotels)[number]) => ({
    ...hotel,
    destination: destinations.find((row) => row.id === hotel.destinationId)!,
  });
  const mockHotel = {
    findMany: vi.fn(
      async (input: {
        where: { destinationId: string };
        include: { rates: { where: { currency: string } } };
      }) =>
        hotels
          .filter((row) => row.destinationId === input.where.destinationId)
          .map((hotel) => ({
            ...withDestination(hotel),
            rates: rates.filter(
              (row) =>
                row.hotelId === hotel.id && row.currency === input.include.rates.where.currency,
            ),
          })),
    ),
    findUnique: vi.fn(async (input: { where: { id: string } }) => {
      const row = hotels.find((hotel) => hotel.id === input.where.id);
      return row ? withDestination(row) : null;
    }),
  };
  return {
    database: { mockDestination, mockHotel } as unknown as DatabaseService,
    mockDestination,
    mockHotel,
    destinations,
    hotels,
    rates,
  };
}
