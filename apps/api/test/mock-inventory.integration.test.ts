import { randomUUID } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Environment } from '../src/config/environment';
import { DatabaseService } from '../src/database/database.service';
import {
  buildMockSeedRecords,
  seedMockHotelInventory,
} from '../src/modules/hotels/mock-hotel.seed';
import { MockHotelSupplier } from '../src/modules/hotels/mock-hotel.supplier';
import { MockSearchService } from '../src/modules/search/mock-search.service';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.toLowerCase().includes('test')) {
  throw new Error(
    'Mock inventory integration tests require an explicit dedicated TEST_DATABASE_URL.',
  );
}
const runId = randomUUID();
const prefix = `test-${runId}-`;
const options = { nodeEnv: 'test', mode: 'mock', databaseUrl: url, idPrefix: prefix };
const records = buildMockSeedRecords(prefix);
const database = new DatabaseService(new ConfigService<Environment, true>({ DATABASE_URL: url }));
const config = new ConfigService<Environment, true>({
  HOTEL_DATA_MODE: 'mock',
  NODE_ENV: 'test',
  MAX_STAY_NIGHTS: 30,
});
const supplier = new MockHotelSupplier(config, database);
const service = new MockSearchService(supplier, config);

describe('PostgreSQL preview inventory', () => {
  beforeAll(async () => {
    await database.$connect();
    await database.user.create({ data: { id: runId, clerkId: `mock-seed-isolation-${runId}` } });
    await seedMockHotelInventory(database, options);
  });
  afterAll(async () => {
    // Only this suite's uniquely prefixed records are removed; no reset or truncation.
    await database.mockRate.deleteMany({ where: { hotelId: { startsWith: prefix } } });
    await database.mockHotel.deleteMany({ where: { id: { startsWith: prefix } } });
    await database.mockDestination.deleteMany({ where: { id: { startsWith: prefix } } });
    await database.user.deleteMany({ where: { id: runId } });
    await database.$disconnect();
  });

  it('seeds repeatedly without duplicates, updates seeded rows and preserves real-domain records', async () => {
    const hotel = records.hotels[0]!;
    await database.mockHotel.update({
      where: { id: hotel.id },
      data: { name: 'Temporary suite edit' },
    });
    const first = await seedMockHotelInventory(database, options);
    const second = await seedMockHotelInventory(database, options);
    expect(first).toEqual(second);
    expect(await database.mockDestination.count({ where: { id: { startsWith: prefix } } })).toBe(4);
    expect(await database.mockHotel.count({ where: { id: { startsWith: prefix } } })).toBe(45);
    expect(await database.mockRate.count({ where: { hotelId: { startsWith: prefix } } })).toBe(
      records.rates.length,
    );
    expect((await database.mockHotel.findUniqueOrThrow({ where: { id: hotel.id } })).name).toBe(
      hotel.name,
    );
    expect(await database.user.count({ where: { id: runId } })).toBe(1);
  });

  it('serves actual database edits and persisted prices on later requests and a reopened connection', async () => {
    const criteria = {
      destination: `${prefix}dubai`,
      checkIn: '2100-01-01',
      checkOut: '2100-01-08',
      nationality: 'GB',
      currency: 'GBP' as const,
      rooms: [{ adults: 2, childrenAges: [] }],
      pageSize: 50,
    };
    const before = await service.searchHotels(criteria);
    const hotelId = records.hotels[0]!.id;
    const storedRate = records.rates.find(
      (rate) =>
        rate.hotelId === hotelId && rate.currency === 'GBP' && rate.mealType === 'Room only',
    )!;
    const beforePrice = before.hotels
      .find(({ hotel }) => hotel.id === hotelId)!
      .rates.find(({ mealType }) => mealType === 'Room only')!.price.totalAmount;
    await database.mockHotel.update({
      where: { id: hotelId },
      data: { name: 'Persisted database hotel name' },
    });
    await database.mockRate.update({
      where: { id: storedRate.id },
      data: { nightlyBaseAmount: storedRate.nightlyBaseAmount + 10000 },
    });
    await database.$disconnect();
    await database.$connect();
    const after = await service.searchHotels({
      ...criteria,
      filters: { name: 'Persisted database' },
    });
    expect(after.hotels).toHaveLength(1);
    expect(after.hotels[0]?.hotel).toMatchObject({
      id: hotelId,
      name: 'Persisted database hotel name',
      source: 'mock',
    });
    expect(
      after.hotels[0]!.rates.find(({ mealType }) => mealType === 'Room only')!.price.totalAmount,
    ).toBeGreaterThan(beforePrice);
    expect((await supplier.getHotelDetails(hotelId)).name).toBe('Persisted database hotel name');
    expect(
      (await supplier.getDestinations()).destinations.some(({ id }) => id === criteria.destination),
    ).toBe(true);
    await expect(service.recheckHotelRate()).rejects.toMatchObject({
      code: 'MOCK_BOOKING_DISABLED',
    });
  });

  it('browses the persisted catalogue without location or stay fields and paginates globally', async () => {
    const first = await service.searchHotels({ currency: 'USD', sort: 'price-asc' });
    expect(first.metadata).toMatchObject({
      destination: 'All destinations',
      total: await database.mockHotel.count(),
      pageSize: 50,
    });
    const results = [...first.hotels];
    for (let page = 2; page <= first.metadata!.totalPages; page += 1) {
      results.push(
        ...(await service.searchHotels({ currency: 'USD', sort: 'price-asc', page })).hotels,
      );
    }
    const ownHotels = results.filter(({ hotel }) => hotel.id.startsWith(prefix));
    expect(ownHotels).toHaveLength(45);
    expect(new Set(ownHotels.map(({ hotel }) => hotel.city)).size).toBe(4);
    expect(new Set(results.map(({ hotel }) => hotel.id)).size).toBe(results.length);
    const totals = results.map(({ rates }) => rates[0]!.price.totalAmount);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
  });

  it('enforces database foreign keys, currency amounts and one offer per hotel/currency/meal plan', async () => {
    const firstRate = records.rates[0]!;
    await expect(
      database.mockRate.create({
        data: { ...firstRate, id: `${prefix}invalid-parent`, hotelId: `${prefix}missing-hotel` },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      database.mockRate.create({ data: { ...firstRate, id: `${prefix}duplicate-offer` } }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(
      database.mockRate.update({ where: { id: firstRate.id }, data: { nightlyBaseAmount: -1 } }),
    ).rejects.toThrow();
    await expect(
      database.mockRate.update({ where: { id: firstRate.id }, data: { currency: 'XXX' } }),
    ).rejects.toThrow();
    expect(
      (await database.mockRate.findUniqueOrThrow({ where: { id: firstRate.id } }))
        .nightlyBaseAmount,
    ).toBeGreaterThanOrEqual(0);
  });
});
