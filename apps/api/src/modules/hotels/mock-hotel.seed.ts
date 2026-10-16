import { hotelSchema } from '@hotel/contracts';
import type { MockDestination, MockHotel, MockRate, PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { MOCK_DESTINATIONS, MOCK_HOTEL_INVENTORY } from './mock-hotel.inventory';

// Seed-only price ranges, not live exchange rates or runtime inventory.
const SEED_PRICE_FACTORS = { USD: 100, GBP: 78, EUR: 92, AED: 367, PKR: 27800, INR: 8350 } as const;
const seedHotelSchema = hotelSchema.extend({
  source: z.literal('mock'),
  description: z.string(),
  address: z.string(),
  starRating: z.number().int().min(1).max(5),
  reviewScore: z.number().min(0).max(10),
  reviewCount: z.number().int().nonnegative(),
  neighbourhood: z.string(),
  propertyType: z.string(),
});

export interface MockSeedOptions {
  nodeEnv: string | undefined;
  mode: string | undefined;
  databaseUrl: string | undefined;
  /** Integration tests use unique IDs and remove only their own records. */
  idPrefix?: string;
}

export function assertMockSeedAllowed(options: MockSeedOptions): void {
  if (!['development', 'test'].includes(options.nodeEnv ?? '') || options.mode !== 'mock')
    throw new Error('Seeding preview inventory requires explicit development/test and mock mode.');
  let target: URL;
  try {
    target = new URL(options.databaseUrl ?? '');
  } catch {
    throw new Error('A valid local PostgreSQL database is required for preview seeding.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(target.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    /(?:^|_)(?:prod|production)(?:_|$)/i.test(target.pathname.slice(1))
  )
    throw new Error('Preview seeding is limited to a local non-production PostgreSQL database.');
  if (options.idPrefix !== undefined && !/^test-[a-z0-9-]{1,45}-$/.test(options.idPrefix))
    throw new Error('Custom preview seed prefixes are reserved for isolated test records.');
}

export function buildMockSeedRecords(idPrefix = '') {
  const destinations: Omit<MockDestination, 'createdAt' | 'updatedAt'>[] = MOCK_DESTINATIONS.map(
    (destination, index) => ({
      ...destination,
      id: idPrefix + destination.id,
      sortOrder: index,
      aliases: (destination.id === 'dubai'
        ? ['100', '115936', 'dubai, united arab emirates']
        : []
      ).map((alias) => idPrefix + alias),
    }),
  );
  const hotels: Omit<MockHotel, 'createdAt' | 'updatedAt'>[] = [];
  const rates: Omit<MockRate, 'createdAt' | 'updatedAt'>[] = [];
  for (const [index, entry] of MOCK_HOTEL_INVENTORY.entries()) {
    const hotel = seedHotelSchema.parse(entry.hotel);
    const hotelId = idPrefix + hotel.id;
    hotels.push({
      id: hotelId,
      destinationId: idPrefix + entry.destination,
      name: hotel.name,
      description: hotel.description,
      address: hotel.address,
      starRating: hotel.starRating,
      reviewScore: hotel.reviewScore,
      reviewCount: hotel.reviewCount,
      neighbourhood: hotel.neighbourhood,
      propertyType: hotel.propertyType,
      beachDistanceMeters: hotel.beachDistanceMeters ?? null,
      latitude: hotel.latitude ?? null,
      longitude: hotel.longitude ?? null,
      images: hotel.images,
      facilities: hotel.facilities,
      badges: hotel.badges ?? [],
      sortOrder: index,
    });
    const variants = [
      { mealType: 'Room only', mealPercent: 100, refundable: false },
      { mealType: 'Breakfast included', mealPercent: 119, refundable: true },
      ...(entry.allInclusive
        ? [{ mealType: 'All inclusive', mealPercent: 148, refundable: true }]
        : []),
    ];
    for (const [currency, factor] of Object.entries(SEED_PRICE_FACTORS)) {
      for (const [variantIndex, variant] of variants.entries()) {
        rates.push({
          id: `${hotelId}-${currency.toLowerCase()}-${variantIndex}`,
          hotelId,
          currency,
          mealType: variant.mealType,
          roomName: hotel.starRating === 5 ? 'Deluxe double room' : 'Superior double room',
          nightlyBaseAmount: Math.round((entry.nightlyUsd * factor * variant.mealPercent) / 100),
          taxBasisPoints: 1000,
          refundable: variant.refundable,
          cancellationLeadDays: variant.refundable ? 3 : 0,
          sortOrder: variantIndex,
        });
      }
    }
  }
  return { destinations, hotels, rates };
}

/** Atomic repeatable upserts touch only the dedicated mock catalogue tables. */
export async function seedMockHotelInventory(database: PrismaClient, options: MockSeedOptions) {
  assertMockSeedAllowed(options);
  const records = buildMockSeedRecords(options.idPrefix);
  await database.$transaction(
    async (tx) => {
      for (const data of records.destinations)
        await tx.mockDestination.upsert({ where: { id: data.id }, create: data, update: data });
      for (const data of records.hotels)
        await tx.mockHotel.upsert({ where: { id: data.id }, create: data, update: data });
      for (const data of records.rates)
        await tx.mockRate.upsert({ where: { id: data.id }, create: data, update: data });
    },
    { timeout: 30_000 },
  );
  return {
    destinations: records.destinations.length,
    hotels: records.hotels.length,
    rates: records.rates.length,
  };
}

/** Validate the target before even starting the migration process. */
export async function prepareMockHotelInventory(
  database: PrismaClient,
  options: MockSeedOptions,
  deployMigrations: () => Promise<void>,
) {
  assertMockSeedAllowed(options);
  await deployMigrations();
  return seedMockHotelInventory(database, options);
}
