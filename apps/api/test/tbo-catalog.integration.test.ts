import { randomUUID } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Environment } from '../src/config/environment';
import { DatabaseService } from '../src/database/database.service';
import type { RedisService } from '../src/infrastructure/redis/redis.service';
import type { TboClient } from '../src/modules/tbo/tbo.client';
import { TboCatalogService } from '../src/modules/tbo/tbo-catalog.service';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.toLowerCase().includes('test')) {
  throw new Error('Catalogue integration tests require a dedicated TEST_DATABASE_URL.');
}
const runId = randomUUID();
const config = new ConfigService<Environment, true>({
  DATABASE_URL: url,
  TBO_BASE_URL: 'https://supplier.example.test/HotelAPI',
  TBO_USERNAME: `catalog-test-${runId}`,
  TBO_CATALOG_COUNTRIES: 'ES',
  TBO_CATALOG_WARM_CITIES: '',
  TBO_CATALOG_TTL_SECONDS: 86400,
  TBO_READS_ENABLED: true,
});
const database = new DatabaseService(config);
const read = vi.fn();
const redis = {
  client: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
};
const catalog = new TboCatalogService(
  database,
  { read } as unknown as TboClient,
  config,
  redis as unknown as RedisService,
);
const originalHotel = {
  HotelCode: '67890',
  HotelName: 'Málaga Grand',
  CityId: '12345',
  CountryCode: 'ES',
  HotelRating: 'FourStar',
  Images: ['https://example.test/hotel.jpg'],
  HotelFacilities: ['Pool'],
};
let hotelPayload = [originalHotel];

describe('PostgreSQL real supplier catalogue', () => {
  beforeAll(async () => {
    await database.$connect();
    read.mockImplementation(async (operation: string) => {
      switch (operation) {
        case 'CountryList':
          return { Status: { Code: 200 }, CountryList: [{ Code: 'ES', Name: 'Spain' }] };
        case 'CityList':
          return {
            Status: { Code: 200 },
            CityList: [
              { Code: '12345', Name: 'Málaga' },
              { Code: '12346', Name: 'Madrid' },
            ],
          };
        case 'TBOHotelCodeList':
          return { Status: { Code: 200 }, Hotels: hotelPayload };
        default:
          throw new Error('Unexpected operation');
      }
    });
    await catalog.syncDestinations(['ES']);
    await catalog.syncCity('12345');
  });
  afterAll(async () => {
    await database.tboHotel.deleteMany({ where: { scope: catalog.scope } });
    await database.tboDestination.deleteMany({ where: { scope: catalog.scope } });
    await database.tboCountry.deleteMany({ where: { scope: catalog.scope } });
    await database.$disconnect();
  });

  it('persists normalized real content idempotently and reuses a fresh city without supplier calls', async () => {
    const calls = read.mock.calls.length;
    const hotels = await catalog.getCityHotels('12345', '67890');
    expect(read).toHaveBeenCalledTimes(calls);
    expect(hotels).toEqual([
      expect.objectContaining({
        id: '67890',
        name: 'Málaga Grand',
        city: 'Málaga',
        countryCode: 'ES',
        source: 'live',
        facilities: ['Pool'],
      }),
    ]);
    expect(JSON.stringify(hotels)).not.toContain('HotelCode');
    await catalog.syncCity('12345', true);
    expect(await database.tboHotel.count({ where: { scope: catalog.scope } })).toBe(1);
  });

  it('uses accent-normalized queries, exact IDs and literal wildcards without supplier requests', async () => {
    const calls = read.mock.calls.length;
    const result = await catalog.getSuggestions({ query: 'malaga', limit: 10 });
    expect(result.suggestions.map((item) => item.type)).toEqual(['destination', 'hotel']);
    expect((await catalog.getSuggestions({ query: '67890', limit: 10 })).suggestions[0]?.id).toBe(
      '67890',
    );
    expect((await catalog.getSuggestions({ query: '%%', limit: 10 })).suggestions).toEqual([]);
    expect(read).toHaveBeenCalledTimes(calls);
  });

  it('isolates data for a different supplier account using the same database', async () => {
    const other = new TboCatalogService(
      database,
      { read } as unknown as TboClient,
      new ConfigService<Environment, true>({
        TBO_BASE_URL: 'https://supplier.example.test/HotelAPI',
        TBO_USERNAME: `other-${runId}`,
        TBO_CATALOG_TTL_SECONDS: 86400,
        TBO_READS_ENABLED: true,
      }),
      redis as unknown as RedisService,
    );
    expect((await other.getDestinations()).destinations).toEqual([]);
    expect((await other.getSuggestions({ query: 'malaga', limit: 10 })).suggestions).toEqual([]);
  });

  it('rolls back a conflicting hotel identity without partially hiding existing catalogue rows', async () => {
    const otherCity = await database.tboDestination.findUniqueOrThrow({
      where: { scope_id: { scope: catalog.scope, id: '12346' } },
    });
    await database.tboHotel.create({
      data: {
        scope: catalog.scope,
        id: '67891',
        destinationId: otherCity.id,
        name: 'Existing Madrid hotel',
        searchText: 'existing madrid hotel',
        content: {
          id: '67891',
          name: 'Existing Madrid hotel',
          images: [],
          facilities: [],
          source: 'live',
        },
        refreshedAt: new Date(),
      },
    });
    hotelPayload = [{ ...originalHotel, HotelCode: '67891', HotelName: 'Conflicting hotel' }];
    await expect(catalog.syncCity('12345', true)).rejects.toMatchObject({
      code: 'INVALID_SUPPLIER_RESPONSE',
    });
    expect(
      (
        await database.tboHotel.findUniqueOrThrow({
          where: { scope_id: { scope: catalog.scope, id: '67890' } },
        })
      ).active,
    ).toBe(true);
    expect(
      (
        await database.tboHotel.findUniqueOrThrow({
          where: { scope_id: { scope: catalog.scope, id: '67891' } },
        })
      ).destinationId,
    ).toBe('12346');
    hotelPayload = [originalHotel];
  });
});
