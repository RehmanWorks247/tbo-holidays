import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../common/errors/domain-error';
import type { Environment } from '../../config/environment';
import type { DatabaseService } from '../../database/database.service';
import type { RedisService } from '../../infrastructure/redis/redis.service';
import type { TboClient } from './tbo.client';
import { TboCatalogService } from './tbo-catalog.service';

const hotel = {
  id: '100',
  name: 'Real supplier hotel',
  images: [],
  facilities: [],
  source: 'live' as const,
};
const destination = {
  id: '123',
  name: 'Destination',
  countryCode: 'SA',
  active: true,
  hotelsRefreshedAt: null,
};
const details = {
  Status: { Code: 200 },
  HotelDetails: [{ HotelCode: '100', HotelName: hotel.name }],
};

function setup(settings: Partial<Environment> = {}) {
  const database = {
    tboCountry: { findMany: vi.fn().mockResolvedValue([]) },
    tboDestination: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(destination),
      count: vi.fn().mockResolvedValue(1),
    },
    tboHotel: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockResolvedValue(undefined),
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
  const read = vi.fn<TboClient['read']>();
  const cache = { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') };
  const service = new TboCatalogService(
    database as unknown as DatabaseService,
    { read } as unknown as TboClient,
    new ConfigService<Environment, true>({
      TBO_BASE_URL: 'https://supplier.example.test/HotelAPI/',
      TBO_USERNAME: 'test-account',
      TBO_CATALOG_TTL_SECONDS: 86400,
      TBO_CATALOG_COUNTRIES: 'SA,AE',
      TBO_CATALOG_WARM_CITIES: '',
      TBO_READS_ENABLED: true,
      ...settings,
    }),
    { client: cache } as unknown as RedisService,
  );
  return { service, database, read, cache };
}

describe('persistent TBO catalogue', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('serves fresh validated hotel details from the account-scoped database without supplier calls', async () => {
    const { service, database, read } = setup();
    database.tboHotel.findUnique.mockResolvedValue({
      content: hotel,
      detailsRefreshedAt: new Date(),
    });
    await expect(service.getHotelDetails('100')).resolves.toEqual(hotel);
    expect(database.tboHotel.findUnique).toHaveBeenCalledExactlyOnceWith({
      where: { scope_id: { scope: service.scope, id: '100' } },
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects malformed persisted content instead of returning unvalidated public data', async () => {
    const { service, database } = setup();
    database.tboHotel.findUnique.mockResolvedValue({
      content: { id: '100' },
      detailsRefreshedAt: new Date(),
    });
    await expect(service.getHotelDetails('100')).rejects.toMatchObject({
      code: 'INVALID_SUPPLIER_RESPONSE',
    });
  });

  it.each([
    {
      label: 'wrong hotel',
      HotelDetails: [{ HotelCode: '101', HotelName: 'Other' }],
      code: 'INVALID_SUPPLIER_RESPONSE',
    },
    {
      label: 'multiple hotels',
      HotelDetails: [
        { HotelCode: '100', HotelName: 'Hotel' },
        { HotelCode: '101', HotelName: 'Other' },
      ],
      code: 'INVALID_SUPPLIER_RESPONSE',
    },
    {
      label: 'missing name',
      HotelDetails: [{ HotelCode: '100' }],
      code: 'INVALID_SUPPLIER_RESPONSE',
    },
    { label: 'empty result', HotelDetails: [], code: 'HOTEL_NOT_AVAILABLE' },
  ])('rejects $label without saving invalid details', async ({ HotelDetails, code }) => {
    const { service, database, read } = setup();
    read.mockResolvedValue({ Status: { Code: 200 }, HotelDetails });
    await expect(service.getHotelDetails('100')).rejects.toMatchObject({ code });
    expect(database.tboHotel.update).not.toHaveBeenCalled();
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('coalesces concurrent detail reads and uses exact documented request casing', async () => {
    const { service, read } = setup();
    let release: (value: unknown) => void = () => undefined;
    read.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const first = service.getHotelDetails('100');
    const second = service.getHotelDetails('100');
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    release(details);
    const results = await Promise.all([first, second]);
    expect(results[0]).toEqual(results[1]);
    expect(read).toHaveBeenCalledExactlyOnceWith('HotelDetails', {
      Hotelcodes: '100',
      Language: 'EN',
    });
  });

  it('clears failed in-flight details so a later request can retry', async () => {
    const { service, read } = setup();
    read
      .mockRejectedValueOnce(new DomainError('SUPPLIER_UNAVAILABLE', 'Unavailable', 503))
      .mockResolvedValueOnce(details);
    await expect(service.getHotelDetails('100')).rejects.toMatchObject({
      code: 'SUPPLIER_UNAVAILABLE',
    });
    await expect(service.getHotelDetails('100')).resolves.toMatchObject({
      id: '100',
      source: 'live',
    });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('saves only normalized content and preserves destination content when enriching a known hotel', async () => {
    const { service, database, read } = setup();
    database.tboHotel.findUnique.mockResolvedValue({
      content: { ...hotel, city: 'Destination', countryCode: 'SA' },
      detailsRefreshedAt: null,
    });
    read.mockResolvedValue({
      ...details,
      HotelDetails: [
        {
          ...details.HotelDetails[0],
          Description: '<script>private()</script><p>Nice hotel</p>',
          BookingCode: 'private-token',
        },
      ],
    });
    await expect(service.getHotelDetails('100')).resolves.toMatchObject({
      city: 'Destination',
      countryCode: 'SA',
      description: 'Nice hotel',
    });
    expect(database.tboHotel.update).toHaveBeenCalledWith({
      where: { scope_id: { scope: service.scope, id: '100' } },
      data: expect.objectContaining({
        content: expect.objectContaining({ description: 'Nice hotel', city: 'Destination' }),
      }),
    });
    expect(JSON.stringify(database.tboHotel.update.mock.calls)).not.toContain('private-token');
  });

  it('keeps account and endpoint catalogues in different persistent/cache scopes', () => {
    const scope = setup().service.scope;
    expect(scope).toMatch(/^[a-f0-9]{64}$/);
    expect(scope).toBe(setup().service.scope);
    expect(scope).not.toBe(setup({ TBO_USERNAME: 'another' }).service.scope);
    expect(scope).not.toBe(setup({ TBO_BASE_URL: 'https://live.example.test/' }).service.scope);
  });

  it('reads a fresh selected hotel catalogue without supplier traffic and scopes every query', async () => {
    const { service, database, read } = setup();
    database.tboDestination.findUnique.mockResolvedValue({
      ...destination,
      hotelsRefreshedAt: new Date(),
    });
    database.tboHotel.findMany.mockResolvedValue([{ content: hotel }]);
    await expect(service.getCityHotels('123', '100')).resolves.toEqual([hotel]);
    expect(database.tboHotel.findMany).toHaveBeenCalledWith({
      where: { scope: service.scope, destinationId: '123', active: true, id: '100' },
      select: { content: true },
      orderBy: { id: 'asc' },
    });
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'duplicate hotels',
      Hotels: [
        { HotelCode: '100', HotelName: 'Hotel' },
        { HotelCode: '100', HotelName: 'Again' },
      ],
    },
    { label: 'wrong city', Hotels: [{ HotelCode: '100', HotelName: 'Hotel', CityId: '999' }] },
    {
      label: 'wrong country',
      Hotels: [{ HotelCode: '100', HotelName: 'Hotel', CountryCode: 'AE' }],
    },
    { label: 'missing name', Hotels: [{ HotelCode: '100' }] },
  ])('does not replace catalogue on $label', async ({ Hotels }) => {
    const { service, database, read } = setup();
    read.mockResolvedValue({ Status: { Code: 200 }, Hotels });
    await expect(service.syncCity('123')).rejects.toMatchObject({
      code: 'INVALID_SUPPLIER_RESPONSE',
    });
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('coalesces concurrent catalogue refreshes before writes', async () => {
    const { service, database, read } = setup();
    let release: (value: unknown) => void = () => undefined;
    read.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const first = service.syncCity('123');
    const second = service.syncCity('123');
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    release({ Status: { Code: 200 }, Hotels: [] });
    await expect(Promise.all([first, second])).resolves.toEqual([0, 0]);
    expect(database.$transaction).toHaveBeenCalledTimes(1);
  });

  it('serves last good static catalogue only for transient unavailability and logs a safe code', async () => {
    const { service, database, read } = setup();
    database.tboDestination.findUnique.mockResolvedValue({
      ...destination,
      hotelsRefreshedAt: new Date(0),
    });
    read.mockRejectedValue(new DomainError('SUPPLIER_UNAVAILABLE', 'upstream-secret', 503));
    await expect(service.syncCity('123')).resolves.toBe(1);
    expect(database.$transaction).not.toHaveBeenCalled();
    expect(Logger.prototype.warn).toHaveBeenCalledWith({
      supplier: 'TBO',
      operation: 'catalog-city-stale',
      code: 'SUPPLIER_UNAVAILABLE',
    });
    expect(JSON.stringify(vi.mocked(Logger.prototype.warn).mock.calls)).not.toContain(
      'upstream-secret',
    );
  });

  it.each(['SUPPLIER_AUTHENTICATION_FAILED', 'INVALID_SUPPLIER_RESPONSE'])(
    'does not conceal %s behind a stale catalogue',
    async (code) => {
      const { service, database, read } = setup();
      database.tboDestination.findUnique.mockResolvedValue({
        ...destination,
        hotelsRefreshedAt: new Date(0),
      });
      read.mockRejectedValue(new DomainError(code, 'Failure', 503));
      await expect(service.syncCity('123')).rejects.toMatchObject({ code });
    },
  );

  it('keeps disabled integration startup network-free', () => {
    const { service, read } = setup({ TBO_READS_ENABLED: false });
    service.onModuleInit();
    service.onModuleDestroy();
    expect(read).not.toHaveBeenCalled();
  });

  it('does not coalesce destination imports for different country sets', async () => {
    const { service, read } = setup();
    read.mockImplementation(async (operation, body) =>
      operation === 'CountryList'
        ? {
            Status: { Code: 200 },
            CountryList: [
              { Code: 'SA', Name: 'Saudi Arabia' },
              { Code: 'AE', Name: 'United Arab Emirates' },
            ],
          }
        : {
            Status: { Code: 200 },
            CityList: [{ Code: body.CountryCode === 'SA' ? '123' : '456', Name: 'City' }],
          },
    );
    await expect(
      Promise.all([service.syncDestinations(['SA']), service.syncDestinations(['AE'])]),
    ).resolves.toEqual([
      { countries: 1, destinations: 1 },
      { countries: 1, destinations: 1 },
    ]);
    expect(read).toHaveBeenCalledWith('CityList', { CountryCode: 'SA' });
    expect(read).toHaveBeenCalledWith('CityList', { CountryCode: 'AE' });
  });

  it('imports worldwide country names while fetching city lists only for requested countries', async () => {
    const { service, database, read } = setup();
    read.mockImplementation(async (operation) =>
      operation === 'CountryList'
        ? {
            Status: { Code: 200 },
            CountryList: [
              { Code: 'TR', Name: 'Türkiye' },
              { Code: 'FR', Name: 'France' },
            ],
          }
        : { Status: { Code: 200 }, CityList: [] },
    );
    await service.syncDestinations(['TR']);
    expect(JSON.stringify(database.$executeRaw.mock.calls)).toContain('France');
    expect(read).toHaveBeenCalledWith('CityList', { CountryCode: 'TR' });
    expect(read).not.toHaveBeenCalledWith('CityList', { CountryCode: 'FR' });
  });
});

describe('catalogue suggestions', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('avoids all database and supplier reads for less than two normalized characters', async () => {
    const { service, database, read, cache } = setup();
    await expect(service.getSuggestions({ query: ' A ', limit: 8 })).resolves.toEqual({
      source: 'live',
      suggestions: [],
    });
    expect(database.tboDestination.findMany).not.toHaveBeenCalled();
    expect(cache.get).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it('reads cached normalized suggestions without querying the supplier or database', async () => {
    const { service, database, read, cache } = setup();
    const result = {
      source: 'live',
      suggestions: [
        {
          id: '123',
          type: 'destination',
          name: 'Riyadh',
          destinationId: '123',
          destinationName: 'Riyadh',
          countryCode: 'SA',
          countryName: 'Saudi Arabia',
        },
      ],
    };
    cache.get.mockResolvedValue(JSON.stringify(result));
    await expect(service.getSuggestions({ query: 'RIYADH', limit: 8 })).resolves.toEqual(result);
    expect(database.tboDestination.findMany).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expect(cache.get).toHaveBeenCalledWith(expect.stringContaining(service.scope));
  });

  it('escapes SQL wildcards, bounds both indexed queries, and never calls suppliers on a cache miss', async () => {
    const { service, database, read, cache } = setup();
    await service.getSuggestions({ query: '100%_', limit: 8 });
    expect(database.tboDestination.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          scope: service.scope,
          active: true,
          searchText: { contains: '100\\%\\_' },
        },
        take: 8,
      }),
    );
    expect(database.tboHotel.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 8 }));
    expect(cache.set).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it('uses prefix matching for two-letter queries and ranks exact hotel names ahead of partial destinations', async () => {
    const { service, database, read, cache } = setup();
    database.tboDestination.findMany.mockResolvedValue([
      { id: '123', name: 'Ab City', countryCode: 'SA', country: { name: 'Saudi Arabia' } },
    ]);
    database.tboHotel.findMany.mockResolvedValue([
      {
        id: '100',
        name: 'Ab',
        destination: {
          id: '123',
          name: 'Ab City',
          countryCode: 'SA',
          country: { name: 'Saudi Arabia' },
        },
      },
    ]);
    const result = await service.getSuggestions({ query: 'AB', limit: 1 });
    expect(result.suggestions.map((item) => item.id)).toEqual(['100']);
    expect(database.tboDestination.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ searchText: { startsWith: 'ab' } }),
      }),
    );
    expect(cache.set).toHaveBeenCalledWith(expect.any(String), JSON.stringify(result), 'EX', 300);
    expect(read).not.toHaveBeenCalled();
  });

  it('falls back to database on corrupt cache while logging safely', async () => {
    const { service, database, cache } = setup();
    cache.get.mockResolvedValue('private-invalid-json');
    await expect(service.getSuggestions({ query: 'Riyadh', limit: 8 })).resolves.toEqual({
      source: 'live',
      suggestions: [],
    });
    expect(database.tboDestination.findMany).toHaveBeenCalledTimes(2);
    expect(Logger.prototype.warn).toHaveBeenCalledWith({
      supplier: 'TBO',
      operation: 'catalog-suggestion-cache-read',
      code: 'CATALOG_UNAVAILABLE',
    });
  });

  it('propagates database failure instead of claiming there are no matches', async () => {
    const { service, database } = setup();
    const unavailable = new Error('database unavailable');
    database.tboDestination.findMany.mockRejectedValue(unavailable);
    await expect(service.getSuggestions({ query: 'Riyadh', limit: 8 })).rejects.toBe(unavailable);
  });

  it('retains exact prefix matches when alphabetical substring results fill the query limit', async () => {
    const { service, database } = setup();
    const country = { name: 'United Kingdom' };
    database.tboDestination.findMany.mockImplementation(
      async (query: { where: { searchText?: { startsWith?: string } } }) =>
        query.where.searchText?.startsWith
          ? [{ id: '123', name: 'York', countryCode: 'GB', country }]
          : Array.from({ length: 12 }, (_, index) => ({
              id: String(200 + index),
              name: `New York ${index}`,
              countryCode: 'GB',
              country,
            })),
    );
    const result = await service.getSuggestions({ query: 'York', limit: 12 });
    expect(result.suggestions).toHaveLength(12);
    expect(result.suggestions[0]).toMatchObject({ id: '123', name: 'York' });
  });

  it('looks up numeric identifiers directly without broad substring matches', async () => {
    const { service, database } = setup();
    await service.getSuggestions({ query: '123', limit: 8 });
    expect(database.tboDestination.findMany).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        where: { scope: service.scope, active: true, id: '123' },
        take: 8,
      }),
    );
    expect(database.tboHotel.findMany).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        where: { scope: service.scope, active: true, destination: { active: true }, id: '123' },
        take: 8,
      }),
    );
  });

  it.each(['Turkey', 'TURKEY', 'türkiye', 'Tr', 'country:TR'])(
    'suggests the complete country for %s without supplier traffic',
    async (query) => {
      const { service, database, read } = setup();
      database.tboCountry.findMany.mockResolvedValue([{ code: 'TR', name: 'Türkiye' }]);
      const result = await service.getSuggestions({ query, limit: 10 });
      expect(result.suggestions[0]).toMatchObject({
        type: 'country',
        id: 'country:TR',
        destinationId: 'country:TR',
        countryCode: 'TR',
      });
      expect(read).not.toHaveBeenCalled();
    },
  );

  it('explains disabled supplier reads rather than returning a misleading empty catalogue', async () => {
    const { service, read, database } = setup({ TBO_READS_ENABLED: false });
    await expect(service.getSuggestions({ query: 'Turkey', limit: 10 })).rejects.toMatchObject({
      code: 'SUPPLIER_NOT_CONFIGURED',
    });
    await expect(service.browseHotels({ query: '', page: 1, pageSize: 20 })).rejects.toMatchObject({
      code: 'SUPPLIER_NOT_CONFIGURED',
    });
    expect(read).not.toHaveBeenCalled();
    expect(database.tboHotel.findMany).not.toHaveBeenCalled();
  });
});

describe('real catalogue name resolution and browsing', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function knownCatalog() {
    const result = setup();
    result.database.tboCountry.findMany.mockResolvedValue([
      { code: 'TR', name: 'Türkiye', destinationsRefreshedAt: new Date() },
    ]);
    return result;
  }

  it.each(['Turkey', 'TURKEY', 'türkiye', 'Tr', 'country:TR'])(
    'resolves %s across every country city rather than the first suggestion',
    async (destinationName) => {
      const { service, database } = knownCatalog();
      database.tboDestination.findMany.mockResolvedValue([{ id: '123' }, { id: '456' }]);
      const load = vi
        .spyOn(service, 'getCityHotels')
        .mockImplementation(async (id) => [{ ...hotel, id: id === '123' ? '100' : '200' }]);
      expect((await service.getSearchHotels(destinationName)).map((item) => item.id)).toEqual([
        '100',
        '200',
      ]);
      expect(load).toHaveBeenCalledTimes(2);
      expect(database.tboDestination.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { scope: service.scope, active: true, countryCode: 'TR' },
        }),
      );
    },
  );

  it('resolves a mixed-case city name and preserves selected hotel ownership filtering', async () => {
    const { service, database } = knownCatalog();
    database.tboDestination.findMany.mockResolvedValue([{ id: '123', name: 'İstanbul' }]);
    const load = vi.spyOn(service, 'getCityHotels').mockResolvedValue([hotel]);
    await expect(service.getSearchHotels('  ISTANBUL  ', '100')).resolves.toEqual([hotel]);
    expect(load).toHaveBeenCalledExactlyOnceWith('123', '100', undefined);
  });

  it('resolves an exact hotel name before broader partial hotel names', async () => {
    const { service, database } = knownCatalog();
    database.tboHotel.findMany.mockResolvedValue([
      { id: '100', name: 'Grand Hotel', destinationId: '123' },
    ]);
    const load = vi.spyOn(service, 'getCityHotels').mockResolvedValue([hotel]);
    await service.getSearchHotels('GRAND HOTEL');
    expect(load).toHaveBeenCalledExactlyOnceWith('123', '100', undefined);
    expect(database.tboHotel.findMany).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ where: expect.objectContaining({ searchText: 'grand hotel' }) }),
    );
  });

  it('requires a specific suggestion for ambiguous city names', async () => {
    const { service, database } = knownCatalog();
    database.tboDestination.findMany.mockResolvedValue([
      { id: '123', name: 'York' },
      { id: '456', name: 'York' },
    ]);
    const load = vi.spyOn(service, 'getCityHotels');
    await expect(service.getSearchHotels('yOrK')).rejects.toMatchObject({
      code: 'AMBIGUOUS_DESTINATION',
    });
    expect(load).not.toHaveBeenCalled();
  });

  it('never returns a partial country when one city fails', async () => {
    const { service, database } = knownCatalog();
    database.tboDestination.findMany.mockResolvedValue([{ id: '123' }, { id: '456' }]);
    vi.spyOn(service, 'getCityHotels').mockImplementation(async (id) => {
      if (id === '456') throw new DomainError('SUPPLIER_UNAVAILABLE', 'Unavailable', 503);
      return [hotel];
    });
    await expect(service.getSearchHotels('Turkey')).rejects.toMatchObject({
      code: 'SUPPLIER_UNAVAILABLE',
    });
  });

  it('stops scheduling country cities after the first failure while settling in-flight reads', async () => {
    const { service, database } = knownCatalog();
    database.tboDestination.findMany.mockResolvedValue(
      Array.from({ length: 100 }, (_, i) => ({ id: String(i + 1) })),
    );
    const failure = new DomainError('SUPPLIER_AUTHENTICATION_FAILED', 'Unavailable', 503);
    const load = vi.spyOn(service, 'getCityHotels').mockImplementation(async (id) => {
      if (id === '1') throw failure;
      await new Promise<void>((resolve) => setTimeout(resolve, 1));
      return [];
    });
    await expect(service.getSearchHotels('Turkey')).rejects.toBe(failure);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('bounds country catalogue concurrency to three reads and enforces an already expired deadline', async () => {
    const { service, database } = knownCatalog();
    database.tboDestination.findMany.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => ({ id: String(i + 1) })),
    );
    let active = 0;
    let maximum = 0;
    const load = vi.spyOn(service, 'getCityHotels').mockImplementation(async (id) => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise<void>((resolve) => setTimeout(resolve, 1));
      active--;
      return [{ ...hotel, id }];
    });
    expect(await service.getSearchHotels('Turkey')).toHaveLength(7);
    expect(maximum).toBe(3);
    load.mockClear();
    await expect(
      service.getSearchHotels('Turkey', undefined, Date.now() - 1),
    ).rejects.toMatchObject({ code: 'SUPPLIER_SEARCH_TIMEOUT' });
    expect(load).not.toHaveBeenCalled();
  });

  it('paginates a country catalogue without prices or invented availability', async () => {
    const { service, database, read } = knownCatalog();
    database.tboDestination.findMany.mockResolvedValue([
      { id: '123', hotelsRefreshedAt: new Date() },
    ]);
    database.tboHotel.findMany.mockResolvedValue([{ content: hotel }]);
    database.tboHotel.count.mockResolvedValue(41);
    const result = await service.browseHotels({ query: 'TURKEY', page: 2, pageSize: 20 });
    expect(result).toMatchObject({
      source: 'live',
      hotels: [hotel],
      total: 41,
      page: 2,
      totalPages: 3,
      syncing: false,
    });
    expect(database.tboHotel.findMany).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        where: expect.objectContaining({ destination: { active: true, countryCode: 'TR' } }),
        skip: 20,
        take: 20,
      }),
    );
    expect(result.hotels[0]).not.toHaveProperty('rates');
    expect(read).not.toHaveBeenCalled();
  });

  it('uses the same normalized literal substring for hotel and city browsing', async () => {
    const { service, database } = knownCatalog();
    database.tboDestination.findMany.mockResolvedValue([
      { id: '123', hotelsRefreshedAt: new Date() },
    ]);
    await service.browseHotels({ query: 'MÁLAGA%_', page: 1, pageSize: 20 });
    expect(database.tboHotel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { searchText: { contains: 'malaga\\%\\_' } },
            { destination: { searchText: { contains: 'malaga\\%\\_' } } },
          ],
        }),
      }),
    );
  });

  it('coalesces country imports while returning existing database hotels and exposes later failures', async () => {
    const { service, database } = knownCatalog();
    database.tboDestination.findMany.mockResolvedValue([{ id: '123', hotelsRefreshedAt: null }]);
    database.tboHotel.findMany.mockResolvedValue([{ content: hotel }]);
    let rejectImport: (error: unknown) => void = () => undefined;
    const sync = vi.spyOn(service, 'syncCity').mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectImport = reject;
        }),
    );
    const input = { query: 'Turkey', page: 1, pageSize: 20 };
    expect(await service.browseHotels(input)).toMatchObject({ hotels: [hotel], syncing: true });
    expect(await service.browseHotels({ ...input, query: 'TÜRKİYE' })).toMatchObject({
      syncing: true,
    });
    expect(sync).toHaveBeenCalledTimes(1);
    rejectImport(
      new DomainError('SUPPLIER_AUTHENTICATION_FAILED', 'Account needs configuration', 503),
    );
    await vi.waitFor(async () => {
      await expect(service.browseHotels(input)).rejects.toMatchObject({
        code: 'SUPPLIER_AUTHENTICATION_FAILED',
      });
    });
  });

  it('does not wait on a background city refresh past the caller deadline', async () => {
    const { service, read } = knownCatalog();
    let release: (value: unknown) => void = () => undefined;
    read.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const background = service.syncCity('123');
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    await expect(service.getCityHotels('123', undefined, Date.now() + 5)).rejects.toMatchObject({
      code: 'SUPPLIER_SEARCH_TIMEOUT',
    });
    release({ Status: { Code: 200 }, Hotels: [] });
    await background;
  });

  it('loads an unpopulated worldwide country directory before resolving its complete inventory', async () => {
    const { service, database } = knownCatalog();
    database.tboCountry.findMany.mockResolvedValue([
      { code: 'FR', name: 'France', destinationsRefreshedAt: null },
    ]);
    const directory = vi
      .spyOn(service, 'syncDestinations')
      .mockResolvedValue({ countries: 1, destinations: 1 });
    database.tboDestination.findMany.mockResolvedValue([{ id: '999', hotelsRefreshedAt: null }]);
    const load = vi.spyOn(service, 'getCityHotels').mockResolvedValue([hotel]);
    const deadline = Date.now() + 1000;
    expect(await service.getSearchHotels('FRANCE', undefined, deadline)).toEqual([hotel]);
    expect(directory).toHaveBeenCalledExactlyOnceWith(['FR'], false, deadline);
    expect(load).toHaveBeenCalledExactlyOnceWith('999', undefined, deadline);
  });

  it('imports a newly selected country and its hotels in the background while browsing', async () => {
    const { service, database } = knownCatalog();
    database.tboCountry.findMany.mockResolvedValue([
      { code: 'FR', name: 'France', destinationsRefreshedAt: null },
    ]);
    database.tboDestination.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ id: '999', hotelsRefreshedAt: null }]);
    const directory = vi
      .spyOn(service, 'syncDestinations')
      .mockResolvedValue({ countries: 1, destinations: 1 });
    const sync = vi.spyOn(service, 'syncCity').mockResolvedValue(1);
    expect(await service.browseHotels({ query: 'France', page: 1, pageSize: 20 })).toMatchObject({
      syncing: true,
    });
    await vi.waitFor(() => expect(sync).toHaveBeenCalledWith('999'));
    expect(directory).toHaveBeenCalledExactlyOnceWith(['FR']);
  });
});

describe('unfiltered worldwide catalogue browsing', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function worldwideCatalog() {
    const result = setup({ TBO_CATALOG_COUNTRIES: 'TR', TBO_CATALOG_WARM_CITIES: '123' });
    const countries = [
      { code: 'TR', name: 'Turkey', destinationsRefreshedAt: new Date() as Date | null },
      { code: 'FR', name: 'France', destinationsRefreshedAt: null as Date | null },
    ];
    const cities = Array.from({ length: 7 }, (_, index) => ({
      id: String(1000 + index),
      name: `Supplier city ${index}`,
      countryCode: index < 3 ? 'TR' : 'FR',
      hotelsRefreshedAt: null as Date | null,
    }));
    const hotels = cities.map((city, index) => ({
      ...hotel,
      id: String(2000 + index),
      city: city.name,
      countryCode: city.countryCode,
    }));
    result.database.tboCountry.findMany.mockResolvedValue(countries);
    result.database.tboDestination.findMany.mockImplementation(
      async (query: { where?: { countryCode?: string; searchText?: { contains: string } } }) =>
        cities.filter(
          (city) =>
            (!query.where?.countryCode || city.countryCode === query.where.countryCode) &&
            (!query.where?.searchText ||
              city.name.toLowerCase().includes(query.where.searchText.contains)),
        ),
    );
    result.database.tboHotel.findMany.mockImplementation(
      async (query: { skip?: number; take?: number }) =>
        hotels
          .slice(query.skip ?? 0, (query.skip ?? 0) + (query.take ?? hotels.length))
          .map((content) => ({ content })),
    );
    result.database.tboHotel.count.mockResolvedValue(hotels.length);
    const directory = vi
      .spyOn(result.service, 'syncDestinations')
      .mockImplementation(async (codes) => {
        for (const country of countries)
          if (codes.includes(country.code)) country.destinationsRefreshedAt = new Date();
        return { countries: codes.length, destinations: cities.length };
      });
    return { ...result, countries, cities, hotels, directory };
  }

  it('imports all country city catalogues beyond configured preferred destinations while paginating every indexed hotel', async () => {
    const { service, database, directory, cities, hotels } = worldwideCatalog();
    const sync = vi.spyOn(service, 'syncCity').mockImplementation(async (id) => {
      const city = cities.find((item) => item.id === id);
      if (city) city.hotelsRefreshedAt = new Date();
      return 1;
    });
    const first = await service.browseHotels({ query: '', page: 1, pageSize: 2 });
    expect(first).toMatchObject({
      hotels: hotels.slice(0, 2),
      total: 7,
      totalPages: 4,
      syncing: true,
    });
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(cities.length));
    await vi.waitFor(async () => {
      expect(await service.browseHotels({ query: '', page: 2, pageSize: 2 })).toMatchObject({
        hotels: hotels.slice(2, 4),
        total: 7,
        totalPages: 4,
        syncing: false,
      });
    });
    expect(directory).toHaveBeenCalledWith(['FR']);
    expect(sync.mock.calls.map(([id]) => id).sort()).toEqual(cities.map((city) => city.id).sort());
    for (const countryCode of ['TR', 'FR'])
      expect(database.tboDestination.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { scope: service.scope, active: true, countryCode } }),
      );
    expect(database.tboHotel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { scope: service.scope, active: true, destination: { active: true } },
        skip: 2,
        take: 2,
      }),
    );
  });

  it('coalesces a pending global import across repeated empty searches and pages, then reuses the completed import', async () => {
    const { service, cities, directory } = worldwideCatalog();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let active = 0;
    let maximum = 0;
    const sync = vi.spyOn(service, 'syncCity').mockImplementation(async (id) => {
      active++;
      maximum = Math.max(maximum, active);
      await gate;
      active--;
      const city = cities.find((item) => item.id === id);
      if (city) city.hotelsRefreshedAt = new Date();
      return 1;
    });
    expect(await service.browseHotels({ query: '', page: 1, pageSize: 2 })).toMatchObject({
      syncing: true,
    });
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(3));
    expect(await service.browseHotels({ query: '', page: 2, pageSize: 2 })).toMatchObject({
      syncing: true,
    });
    expect(await service.browseHotels({ query: '  ', page: 3, pageSize: 2 })).toMatchObject({
      syncing: true,
    });
    expect(sync).toHaveBeenCalledTimes(3);
    expect(directory).toHaveBeenCalledTimes(1);
    release();
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(7));
    await vi.waitFor(async () => {
      expect(await service.browseHotels({ query: '', page: 1, pageSize: 2 })).toMatchObject({
        syncing: false,
      });
    });
    const completedDirectoryCalls = directory.mock.calls.length;
    await service.browseHotels({ query: '', page: 4, pageSize: 2 });
    expect(directory).toHaveBeenCalledTimes(completedDirectoryCalls);
    expect(sync).toHaveBeenCalledTimes(7);
    expect(maximum).toBe(3);
  });

  it('reports a failed global import instead of claiming a partially imported world catalogue is complete', async () => {
    const { service } = worldwideCatalog();
    const failure = new DomainError(
      'SUPPLIER_AUTHENTICATION_FAILED',
      'Account needs configuration',
      503,
    );
    vi.spyOn(service, 'syncCity').mockRejectedValue(failure);
    expect(await service.browseHotels({ query: '', page: 1, pageSize: 2 })).toMatchObject({
      syncing: true,
    });
    await vi.waitFor(async () => {
      await expect(service.browseHotels({ query: '', page: 2, pageSize: 2 })).rejects.toBe(failure);
    });
  });

  it.each(['', 'hIlToN'])(
    'keeps hotel-name browsing pending through a shared global import started by "%s"',
    async (initialQuery) => {
      const { service, database, cities, directory } = worldwideCatalog();
      const importedHotel = { ...hotel, name: 'Hilton supplier hotel' };
      let loaded = false;
      database.tboHotel.findMany.mockImplementation(async () =>
        loaded ? [{ content: importedHotel }] : [],
      );
      database.tboHotel.count.mockImplementation(async () => (loaded ? 1 : 0));
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const sync = vi.spyOn(service, 'syncCity').mockImplementation(async (id) => {
        await gate;
        const city = cities.find((item) => item.id === id);
        if (city) city.hotelsRefreshedAt = new Date();
        loaded = true;
        return 1;
      });
      expect(
        await service.browseHotels({ query: initialQuery, page: 1, pageSize: 20 }),
      ).toMatchObject({ total: 0, hotels: [], syncing: true });
      await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(3));
      const request = { query: 'HILTON', page: 1, pageSize: 20 };
      expect(await service.browseHotels(request)).toMatchObject({ total: 0, syncing: true });
      expect(await service.browseHotels({ ...request, page: 2 })).toMatchObject({ syncing: true });
      expect(directory).toHaveBeenCalledTimes(1);
      expect(sync).toHaveBeenCalledTimes(3);
      release();
      await vi.waitFor(async () => {
        expect(await service.browseHotels(request)).toMatchObject({
          hotels: [importedHotel],
          total: 1,
          syncing: false,
        });
      });
      expect(sync).toHaveBeenCalledTimes(cities.length);
      const completedDirectoryCalls = directory.mock.calls.length;
      await service.browseHotels(request);
      expect(directory).toHaveBeenCalledTimes(completedDirectoryCalls);
      expect(sync).toHaveBeenCalledTimes(cities.length);
    },
  );

  it('discovers a city outside startup countries when its name is submitted directly', async () => {
    const { service, database, cities, directory, hotels } = worldwideCatalog();
    const paris = cities.find((city) => city.countryCode === 'FR')!;
    paris.name = 'Paris';
    const importedHotel = { ...hotels[3]!, city: 'Paris' };
    let cityDiscovered = false;
    let loaded = false;
    database.tboDestination.findMany.mockImplementation(
      async (query: { where?: { countryCode?: string; searchText?: { contains: string } } }) => {
        if (query.where?.searchText) return cityDiscovered ? [paris] : [];
        return cities.filter((city) => city.countryCode === query.where?.countryCode);
      },
    );
    directory.mockImplementation(async (codes) => {
      if (codes.includes('FR')) cityDiscovered = true;
      return { countries: codes.length, destinations: cities.length };
    });
    database.tboHotel.findMany.mockImplementation(async () =>
      loaded ? [{ content: importedHotel }] : [],
    );
    database.tboHotel.count.mockImplementation(async () => (loaded ? 1 : 0));
    const sync = vi.spyOn(service, 'syncCity').mockImplementation(async (id) => {
      const city = cities.find((item) => item.id === id);
      if (city) city.hotelsRefreshedAt = new Date();
      if (id === paris.id) loaded = true;
      return 1;
    });
    const request = { query: 'pArIs', page: 1, pageSize: 20 };
    expect(await service.browseHotels(request)).toMatchObject({ syncing: true });
    await vi.waitFor(async () => {
      expect(await service.browseHotels(request)).toMatchObject({
        hotels: [importedHotel],
        total: 1,
        syncing: false,
      });
    });
    expect(directory).toHaveBeenCalledWith(['FR']);
    expect(sync).toHaveBeenCalledWith(paris.id);
  });

  it('exposes a failed global import to hotel-name browsing without restarting it on every poll', async () => {
    const { service, directory } = worldwideCatalog();
    const failure = new DomainError('SUPPLIER_UNAVAILABLE', 'Supplier unavailable', 503);
    vi.spyOn(service, 'syncCity').mockRejectedValue(failure);
    expect(await service.browseHotels({ query: '', page: 1, pageSize: 20 })).toMatchObject({
      syncing: true,
    });
    await vi.waitFor(async () => {
      await expect(service.browseHotels({ query: 'Hilton', page: 1, pageSize: 20 })).rejects.toBe(
        failure,
      );
    });
    expect(directory).toHaveBeenCalledTimes(1);
  });

  it('does not import the world for a known city or explicit hotel identifier', async () => {
    const { service, database, directory } = worldwideCatalog();
    database.tboDestination.findMany.mockResolvedValue([
      { id: '1000', hotelsRefreshedAt: new Date() },
    ]);
    const sync = vi.spyOn(service, 'syncCity');
    expect(
      await service.browseHotels({ query: 'Supplier city 0', page: 1, pageSize: 20 }),
    ).toMatchObject({ syncing: false });
    database.tboDestination.findMany.mockResolvedValue([]);
    expect(await service.browseHotels({ query: '2000', page: 1, pageSize: 20 })).toMatchObject({
      syncing: false,
    });
    expect(directory).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });

  it('discovers every supplier country on a cold unfiltered browse before loading all hotel catalogues', async () => {
    const { service, database, countries, cities, hotels, directory } = worldwideCatalog();
    let discovered = false;
    const loaded: typeof hotels = [];
    database.tboCountry.findMany.mockImplementation(async () => (discovered ? countries : []));
    database.tboHotel.count.mockImplementation(async () => loaded.length);
    database.tboHotel.findMany.mockImplementation(async (query: { skip?: number; take?: number }) =>
      loaded
        .slice(query.skip ?? 0, (query.skip ?? 0) + (query.take ?? loaded.length))
        .map((content) => ({ content })),
    );
    directory.mockImplementation(async (codes) => {
      discovered = true;
      for (const country of countries)
        if (codes.includes(country.code)) country.destinationsRefreshedAt = new Date();
      return { countries: codes.length, destinations: cities.length };
    });
    const sync = vi.spyOn(service, 'syncCity').mockImplementation(async (id) => {
      const index = cities.findIndex((city) => city.id === id);
      if (index >= 0) {
        cities[index]!.hotelsRefreshedAt = new Date();
        loaded.push(hotels[index]!);
      }
      return 1;
    });
    expect(await service.browseHotels({ query: '', page: 1, pageSize: 20 })).toMatchObject({
      syncing: true,
    });
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(7));
    await vi.waitFor(async () => {
      expect(await service.browseHotels({ query: '', page: 1, pageSize: 20 })).toMatchObject({
        total: 7,
        syncing: false,
      });
    });
    expect(directory).toHaveBeenCalledWith(['FR']);
    expect(new Set(loaded.map((item) => item.countryCode))).toEqual(new Set(['TR', 'FR']));
  });
});
