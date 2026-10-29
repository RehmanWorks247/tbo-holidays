import { createHash } from 'node:crypto';

import {
  type Hotel,
  type HotelCatalogQuery,
  type HotelCatalogResponse,
  hotelCatalogResponseSchema,
  hotelDestinationsResponseSchema,
  hotelSchema,
  type HotelSearchSuggestion,
  type HotelSearchSuggestionsResponse,
  hotelSearchSuggestionsResponseSchema,
  type HotelSuggestionsQuery,
} from '@hotel/contracts';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { z } from 'zod';

import { DomainError } from '../../common/errors/domain-error';
import type { Environment } from '../../config/environment';
import { DatabaseService } from '../../database/database.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import {
  tboCatalogResponseSchema,
  tboDetailsResponseSchema,
  tboHotelCodeSchema,
} from './dto/tbo.schemas';
import {
  catalogSearchPattern,
  catalogSearchText,
  tboCitiesResponseSchema,
  tboCountriesResponseSchema,
} from './dto/tbo-catalog.schemas';
import { mapCatalogHotel, mapHotelDetails } from './mappers/tbo-hotel.mapper';
import { TboClient } from './tbo.client';

function parseResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw invalidResponse();
  return parsed.data;
}

function invalidResponse() {
  return new DomainError(
    'INVALID_SUPPLIER_RESPONSE',
    'The supplier returned invalid hotel data.',
    502,
  );
}

function assertUnique(values: string[]): void {
  if (new Set(values).size !== values.length) throw invalidResponse();
}

function contentJson(hotel: Hotel): Prisma.InputJsonValue {
  // The public schema strips unknown fields, so raw supplier DTOs cannot be stored here.
  return hotelSchema.parse(hotel) as Prisma.InputJsonObject;
}

type CatalogTarget =
  | { type: 'country'; code: string; name: string; destinationsRefreshedAt: Date | null }
  | { type: 'destination'; id: string; name: string }
  | { type: 'hotel'; id: string; destinationId: string; name: string };
type BrowseRefresh = { pending: boolean; failedAt?: number; error?: DomainError };

function countrySearchNames(country: { code: string; name: string }): string[] {
  return [country.code, country.name, ...(country.code === 'TR' ? ['Turkey', 'Türkiye'] : [])].map(
    catalogSearchText,
  );
}

@Injectable()
export class TboCatalogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TboCatalogService.name);
  readonly scope: string;
  private readonly cityRefreshes = new Map<string, Promise<number>>();
  private readonly detailRefreshes = new Map<string, Promise<Hotel>>();
  private readonly destinationRefreshes = new Map<
    string,
    Promise<{ countries: number; destinations: number }>
  >();
  private readonly browseRefreshes = new Map<string, BrowseRefresh>();
  private countryDirectoryRefreshedAt: Date | null = null;
  private allHotelsRefreshedAt: Date | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly database: DatabaseService,
    private readonly client: TboClient,
    private readonly config: ConfigService<Environment, true>,
    private readonly redis: RedisService,
  ) {
    this.scope = createHash('sha256')
      .update(
        JSON.stringify([
          config.get('TBO_BASE_URL', { infer: true }),
          config.get('TBO_USERNAME', { infer: true }),
        ]),
      )
      .digest('hex');
  }

  onModuleInit(): void {
    if (!this.config.get('TBO_READS_ENABLED', { infer: true })) return;
    // No supplier request lies on the typeahead path or blocks application startup.
    const refresh = () => {
      void this.refreshConfiguredCatalog().catch((error: unknown) => {
        this.warn('catalog-background-refresh', error);
      });
    };
    refresh();
    this.refreshTimer = setInterval(
      refresh,
      this.config.get('TBO_CATALOG_TTL_SECONDS', { infer: true }) * 1000,
    );
    this.refreshTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  private async refreshConfiguredCatalog(): Promise<void> {
    await this.syncDestinations(this.configuredCountries());
    const cities = this.config
      .get('TBO_CATALOG_WARM_CITIES', { infer: true })
      .split(',')
      .filter(Boolean);
    for (const city of cities) {
      try {
        await this.syncCity(city);
      } catch (error: unknown) {
        this.warn('catalog-warm-city', error);
      }
    }
  }

  configuredCountries(): string[] {
    return this.config
      .get('TBO_CATALOG_COUNTRIES', { infer: true })
      .split(',')
      .map((value) => value.trim());
  }

  async getDestinations() {
    const destinations = await this.database.tboDestination.findMany({
      where: { scope: this.scope, active: true },
      select: { id: true, name: true, countryCode: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    return hotelDestinationsResponseSchema.parse({ source: 'live', destinations });
  }

  async getSuggestions(input: HotelSuggestionsQuery): Promise<HotelSearchSuggestionsResponse> {
    this.assertEnabled();
    const query = catalogSearchText(input.query);
    if (query.length < 2) return { source: 'live', suggestions: [] };
    const cacheKey = `tbo:suggestions:v2:${this.scope}:${createHash('sha256').update(`${query}:${input.limit}`).digest('hex')}`;
    try {
      const cached = await this.redis.client.get(cacheKey);
      if (cached)
        return parseResponse(hotelSearchSuggestionsResponseSchema, JSON.parse(cached) as unknown);
    } catch (error: unknown) {
      this.warn('catalog-suggestion-cache-read', error);
    }
    const pattern = catalogSearchPattern(query);
    const numericId = /^\d{1,16}$/.test(query) ? query : undefined;
    const loadMatches = (textFilter: Prisma.StringFilter) =>
      Promise.all([
        this.database.tboDestination.findMany({
          where: {
            scope: this.scope,
            active: true,
            ...(numericId ? { id: numericId } : { searchText: textFilter }),
          },
          include: { country: { select: { name: true } } },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          take: input.limit,
        }),
        this.database.tboHotel.findMany({
          where: {
            scope: this.scope,
            active: true,
            destination: { active: true },
            ...(numericId ? { id: numericId } : { searchText: textFilter }),
          },
          select: {
            id: true,
            name: true,
            destination: {
              select: {
                id: true,
                name: true,
                countryCode: true,
                country: { select: { name: true } },
              },
            },
          },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          take: input.limit,
        }),
      ]);
    // Fetch prefix matches independently: alphabetical substring limits must not
    // discard York behind many New York properties before ranking is applied.
    const [prefix, substring, countries] = await Promise.all([
      loadMatches({ startsWith: pattern }),
      query.length >= 3 && !numericId
        ? loadMatches({ contains: pattern })
        : Promise.resolve(undefined),
      this.database.tboCountry.findMany({
        where: { scope: this.scope },
        select: { code: true, name: true },
        take: 300,
      }),
    ]);
    const destinations = [
      ...new Map([...prefix[0], ...(substring?.[0] ?? [])].map((city) => [city.id, city])).values(),
    ];
    const hotels = [
      ...new Map(
        [...prefix[1], ...(substring?.[1] ?? [])].map((hotel) => [hotel.id, hotel]),
      ).values(),
    ];
    const candidates: HotelSearchSuggestion[] = [
      ...countries
        .filter((country) =>
          countrySearchNames(country).some((name) =>
            query.startsWith('country:')
              ? `country:${country.code.toLowerCase()}` === query
              : name.includes(query),
          ),
        )
        .map((country) => ({
          id: `country:${country.code}`,
          type: 'country' as const,
          name: country.name,
          destinationId: `country:${country.code}`,
          destinationName: country.name,
          countryCode: country.code,
          countryName: country.name,
        })),
      ...destinations.map((city) => ({
        id: city.id,
        type: 'destination' as const,
        name: city.name,
        destinationId: city.id,
        destinationName: city.name,
        countryCode: city.countryCode,
        countryName: city.country.name,
      })),
      ...hotels.map((hotel) => ({
        id: hotel.id,
        type: 'hotel' as const,
        name: hotel.name,
        destinationId: hotel.destination.id,
        destinationName: hotel.destination.name,
        countryCode: hotel.destination.countryCode,
        countryName: hotel.destination.country.name,
      })),
    ];
    const score = (item: HotelSearchSuggestion) =>
      item.id === numericId
        ? 0
        : item.type === 'country' &&
            countrySearchNames({ code: item.countryCode, name: item.name }).includes(query)
          ? 1
          : catalogSearchText(item.name) === query
            ? 1
            : catalogSearchText(item.name).startsWith(query)
              ? 2
              : 3;
    candidates.sort(
      (a, b) =>
        score(a) - score(b) ||
        { country: 0, destination: 1, hotel: 2 }[a.type] -
          { country: 0, destination: 1, hotel: 2 }[b.type] ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
    const result = hotelSearchSuggestionsResponseSchema.parse({
      source: 'live',
      suggestions: candidates.slice(0, input.limit),
    });
    try {
      // Do not cache a cold catalogue miss while a background import is running.
      if (result.suggestions.length)
        await this.redis.client.set(cacheKey, JSON.stringify(result), 'EX', 300);
    } catch (error: unknown) {
      this.warn('catalog-suggestion-cache-write', error);
    }
    return result;
  }

  /** Static content can be browsed without inventing dates, availability or prices. */
  async browseHotels(input: HotelCatalogQuery): Promise<HotelCatalogResponse> {
    this.assertEnabled();
    const query = catalogSearchText(input.query);
    const countries = await this.database.tboCountry.findMany({
      where: { scope: this.scope },
      select: { code: true, name: true, destinationsRefreshedAt: true },
      take: 300,
    });
    let syncing = false;
    if (!query) {
      syncing = this.refreshAllHotelsForBrowse();
    } else if (!countries.length) {
      syncing = this.refreshForBrowse('directory', async () => {
        await this.syncDestinations(this.configuredCountries());
      });
    }
    const country = countries.find((item) =>
      query.startsWith('country:')
        ? query === `country:${item.code.toLowerCase()}`
        : countrySearchNames(item).includes(query),
    );
    if (query.startsWith('country:') && countries.length && !country)
      throw this.unknownDestination();
    const pattern = catalogSearchPattern(query);
    const numeric = /^\d{1,16}$/.test(query);
    const where: Prisma.TboHotelWhereInput = {
      scope: this.scope,
      active: true,
      destination: { active: true, ...(country ? { countryCode: country.code } : {}) },
      ...(country || !query
        ? {}
        : numeric
          ? { OR: [{ id: query }, { destinationId: query }] }
          : {
              OR: [
                { searchText: { contains: pattern } },
                { destination: { searchText: { contains: pattern } } },
              ],
            }),
    };
    if (countries.length && query) {
      const cities = await this.database.tboDestination.findMany({
        where: {
          scope: this.scope,
          active: true,
          ...(country
            ? { countryCode: country.code }
            : numeric
              ? { id: query }
              : { searchText: { contains: pattern } }),
        },
        select: { id: true, hotelsRefreshedAt: true },
        orderBy: { id: 'asc' },
      });
      const stale = cities.filter((city) => !this.fresh(city.hotelsRefreshedAt));
      if (stale.length || (country && !this.fresh(country.destinationsRefreshedAt))) {
        syncing =
          this.refreshForBrowse(`browse:${country?.code ?? query}`, async () => {
            if (country && !this.fresh(country.destinationsRefreshedAt)) {
              await this.syncDestinations([country.code]);
              const imported = await this.database.tboDestination.findMany({
                where: { scope: this.scope, active: true, countryCode: country.code },
                select: { id: true, hotelsRefreshedAt: true },
                orderBy: { id: 'asc' },
              });
              await this.forEachCity(
                imported
                  .filter((city) => !this.fresh(city.hotelsRefreshedAt))
                  .map((city) => city.id),
                (id) => this.syncCity(id),
              );
              return;
            }
            await this.forEachCity(
              stale.map((city) => city.id),
              (id) => this.syncCity(id),
            );
          }) || syncing;
      } else {
        syncing = this.browseState(`browse:${country?.code ?? query}`) || syncing;
      }
      // A hotel name or an undiscovered city cannot be declared absent from a
      // partially imported catalogue. Share the worldwide import, including its
      // pending/error state, so direct name searches keep polling as matches arrive.
      // Known cities, countries and explicit identifiers retain their scoped reads.
      if (!country && !numeric && cities.length === 0)
        syncing = this.refreshAllHotelsForBrowse() || syncing;
      syncing = this.browseState('directory') || syncing;
    }
    const [rows, total] = await Promise.all([
      this.database.tboHotel.findMany({
        where,
        select: { content: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.database.tboHotel.count({ where }),
    ]);
    return hotelCatalogResponseSchema.parse({
      source: 'live',
      hotels: rows.map((row) => parseResponse(hotelSchema, row.content)),
      total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.ceil(total / input.pageSize),
      syncing,
    });
  }

  private refreshAllHotelsForBrowse(): boolean {
    return this.fresh(this.allHotelsRefreshedAt)
      ? this.browseState('all-hotels')
      : this.refreshForBrowse('all-hotels', () => this.warmAllHotels());
  }

  private async warmAllHotels(): Promise<void> {
    const startedAt = new Date();
    await this.syncDestinations(this.configuredCountries());
    const countries = await this.database.tboCountry.findMany({
      where: { scope: this.scope },
      select: { code: true, destinationsRefreshedAt: true },
      orderBy: { code: 'asc' },
    });
    // One coalesced worldwide import. Country directories are loaded in sequence;
    // city content uses at most three concurrent reads and becomes browsable as
    // it commits. Configured startup markets never restrict an unfiltered browse.
    for (const country of countries) {
      if (!this.fresh(country.destinationsRefreshedAt)) await this.syncDestinations([country.code]);
      const cities = await this.database.tboDestination.findMany({
        where: { scope: this.scope, active: true, countryCode: country.code },
        select: { id: true, hotelsRefreshedAt: true },
        orderBy: { id: 'asc' },
      });
      await this.forEachCity(
        cities.filter((city) => !this.fresh(city.hotelsRefreshedAt)).map((city) => city.id),
        (id) => this.syncCity(id),
      );
    }
    // Anchor freshness before the import; a long run cannot extend old content's TTL.
    this.allHotelsRefreshedAt = startedAt;
  }

  private browseState(key: string): boolean {
    const state = this.browseRefreshes.get(key);
    if (state?.error && Date.now() - (state.failedAt ?? 0) < 30_000) throw state.error;
    return state?.pending ?? false;
  }

  private refreshForBrowse(key: string, refresh: () => Promise<void>): boolean {
    if (this.browseState(key)) return true;
    const state: BrowseRefresh = { pending: true };
    this.browseRefreshes.set(key, state);
    void refresh().then(
      () => {
        state.pending = false;
        if (this.browseRefreshes.get(key) === state) this.browseRefreshes.delete(key);
      },
      (error: unknown) => {
        state.pending = false;
        state.failedAt = Date.now();
        state.error =
          error instanceof DomainError
            ? error
            : new DomainError(
                'CATALOG_UNAVAILABLE',
                'Hotel discovery is temporarily unavailable. Please try again.',
                503,
              );
        this.warn('catalog-browse-refresh', error);
      },
    );
    return true;
  }

  /** Resolve display names at the backend; selections are never trusted supplier identities. */
  async getSearchHotels(
    destination: string,
    hotelId?: string,
    deadline?: number,
  ): Promise<Hotel[]> {
    this.assertEnabled();
    this.assertDeadline(deadline);
    const target = await this.resolveDestination(destination, deadline);
    if (target.type === 'hotel') {
      if (hotelId && hotelId !== target.id) throw this.unknownDestination();
      return this.getCityHotels(target.destinationId, target.id, deadline);
    }
    if (target.type === 'destination') return this.getCityHotels(target.id, hotelId, deadline);
    if (!this.fresh(target.destinationsRefreshedAt))
      await this.syncDestinations([target.code], false, deadline);
    const cities = await this.database.tboDestination.findMany({
      where: { scope: this.scope, active: true, countryCode: target.code },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    const result: Hotel[] = [];
    await this.forEachCity(
      cities.map((city) => city.id),
      async (id) => {
        result.push(...(await this.getCityHotels(id, hotelId, deadline)));
      },
      deadline,
    );
    result.sort((a, b) => a.id.localeCompare(b.id));
    assertUnique(result.map((hotel) => hotel.id));
    return result;
  }

  private async resolveDestination(value: string, deadline?: number): Promise<CatalogTarget> {
    const query = catalogSearchText(value);
    if (!query) throw this.unknownDestination();
    let countries = await this.database.tboCountry.findMany({
      where: { scope: this.scope },
      select: { code: true, name: true, destinationsRefreshedAt: true },
      take: 300,
    });
    if (!countries.length) {
      await this.syncDestinations(this.configuredCountries(), false, deadline);
      countries = await this.database.tboCountry.findMany({
        where: { scope: this.scope },
        select: { code: true, name: true, destinationsRefreshedAt: true },
        take: 300,
      });
    }
    const country = countries.find((item) =>
      query.startsWith('country:')
        ? query === `country:${item.code.toLowerCase()}`
        : countrySearchNames(item).includes(query),
    );
    if (country) return { type: 'country', ...country };
    if (query.startsWith('country:')) throw this.unknownDestination();
    if (/^\d{1,16}$/.test(query)) {
      const city = await this.database.tboDestination.findUnique({
        where: { scope_id: { scope: this.scope, id: query } },
      });
      if (city?.active) return { type: 'destination', id: city.id, name: city.name };
    }
    const cities = await this.database.tboDestination.findMany({
      where: {
        scope: this.scope,
        active: true,
        searchText: { startsWith: catalogSearchPattern(query) },
      },
      select: { id: true, name: true },
    });
    const exact = cities.filter((city) => catalogSearchText(city.name) === query);
    if (exact.length > 1) throw this.ambiguousDestination();
    if (exact[0]) return { type: 'destination', ...exact[0] };
    const hotelWhere: Prisma.TboHotelWhereInput = {
      scope: this.scope,
      active: true,
      destination: { active: true },
      ...(/^\d{1,16}$/.test(query) ? { id: query } : { searchText: query }),
    };
    let hotels = await this.database.tboHotel.findMany({
      where: {
        ...hotelWhere,
      },
      select: { id: true, destinationId: true, name: true },
      take: 2,
    });
    if (!hotels.length && !/^\d{1,16}$/.test(query))
      hotels = await this.database.tboHotel.findMany({
        where: { ...hotelWhere, searchText: { contains: catalogSearchPattern(query) } },
        select: { id: true, destinationId: true, name: true },
        take: 2,
      });
    if (hotels.length > 1) throw this.ambiguousDestination();
    if (hotels[0]) return { type: 'hotel', ...hotels[0] };
    if (cities.length > 1) throw this.ambiguousDestination();
    if (cities[0]) return { type: 'destination', ...cities[0] };
    throw this.unknownDestination();
  }

  private async forEachCity(
    ids: string[],
    task: (id: string) => Promise<unknown>,
    deadline?: number,
  ): Promise<void> {
    let next = 0;
    let failure: { error: unknown } | undefined;
    const workers = Array.from({ length: Math.min(3, ids.length) }, async () => {
      while (!failure && next < ids.length) {
        try {
          this.assertDeadline(deadline);
          const id = ids[next++];
          if (id) await task(id);
        } catch (error: unknown) {
          failure ??= { error };
        }
      }
    });
    // Let already dispatched reads settle, but stop consuming cities as soon as
    // any worker fails. A large country must not keep sending doomed requests.
    await Promise.all(workers);
    if (failure) throw failure.error;
    this.assertDeadline(deadline);
  }

  private assertEnabled(): void {
    if (!this.config.get('TBO_READS_ENABLED', { infer: true }))
      throw new DomainError(
        'SUPPLIER_NOT_CONFIGURED',
        'Real hotel search is unavailable until the TBO connection is enabled and verified.',
        503,
      );
  }

  private assertDeadline(deadline?: number): void {
    if (deadline !== undefined && Date.now() >= deadline)
      throw new DomainError(
        'SUPPLIER_SEARCH_TIMEOUT',
        'The search took too long. Please try a more specific destination or hotel.',
        504,
      );
  }

  private async beforeDeadline<T>(pending: Promise<T>, deadline?: number): Promise<T> {
    if (deadline === undefined) return pending;
    this.assertDeadline(deadline);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        pending,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new DomainError(
                  'SUPPLIER_SEARCH_TIMEOUT',
                  'The search took too long. Please try a more specific destination or hotel.',
                  504,
                ),
              ),
            Math.max(0, deadline - Date.now()),
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private unknownDestination(): DomainError {
    return new DomainError(
      'INVALID_DESTINATION',
      'Choose an available country, city or hotel from search suggestions.',
      400,
    );
  }

  private ambiguousDestination(): DomainError {
    return new DomainError(
      'AMBIGUOUS_DESTINATION',
      'Several places or hotels match this name. Choose a specific search suggestion.',
      400,
    );
  }

  async getCityHotels(cityCode: string, hotelId?: string, deadline?: number): Promise<Hotel[]> {
    this.assertDeadline(deadline);
    const code = parseResponse(tboHotelCodeSchema, cityCode);
    const hotelCode =
      hotelId === undefined ? undefined : parseResponse(tboHotelCodeSchema, hotelId);
    await this.syncCity(code, false, deadline);
    const hotels = await this.database.tboHotel.findMany({
      where: {
        scope: this.scope,
        destinationId: code,
        active: true,
        ...(hotelCode ? { id: hotelCode } : {}),
      },
      select: { content: true },
      orderBy: { id: 'asc' },
    });
    return hotels.map((row) => parseResponse(hotelSchema, row.content));
  }

  async syncCity(cityCode: string, force = false, deadline?: number): Promise<number> {
    this.assertDeadline(deadline);
    const code = parseResponse(tboHotelCodeSchema, cityCode);
    const existing = this.cityRefreshes.get(code);
    if (existing) return this.beforeDeadline(existing, deadline);
    const pending = this.refreshCity(code, force, deadline).finally(() => {
      if (this.cityRefreshes.get(code) === pending) this.cityRefreshes.delete(code);
    });
    this.cityRefreshes.set(code, pending);
    return this.beforeDeadline(pending, deadline);
  }

  private async refreshCity(code: string, force: boolean, deadline?: number): Promise<number> {
    let destination = await this.database.tboDestination.findUnique({
      where: { scope_id: { scope: this.scope, id: code } },
    });
    if (!destination) {
      await this.syncDestinations(this.configuredCountries(), false, deadline);
      destination = await this.database.tboDestination.findUnique({
        where: { scope_id: { scope: this.scope, id: code } },
      });
    }
    if (!destination?.active)
      throw new DomainError(
        'INVALID_DESTINATION',
        'Choose an available destination from search suggestions.',
        400,
      );
    if (!force && this.fresh(destination.hotelsRefreshedAt)) {
      return this.database.tboHotel.count({
        where: { scope: this.scope, destinationId: code, active: true },
      });
    }
    let hotels: Hotel[];
    try {
      const payload = parseResponse(
        tboCatalogResponseSchema,
        await this.client.read(
          'TBOHotelCodeList',
          { CityCode: code, IsDetailedResponse: true },
          ...(deadline === undefined ? [] : [deadline]),
        ),
      );
      assertUnique(payload.Hotels.map((hotel) => hotel.HotelCode));
      hotels = payload.Hotels.map((hotel) => {
        if (hotel.CountryCode && hotel.CountryCode !== destination.countryCode)
          throw invalidResponse();
        if (hotel.CityId && hotel.CityId !== code) throw invalidResponse();
        const mapped = hotelSchema.parse({
          ...mapCatalogHotel(hotel),
          city: destination.name,
          countryCode: destination.countryCode,
          source: 'live',
        });
        if (mapped.name.length > 500) throw invalidResponse();
        return mapped;
      });
    } catch (error: unknown) {
      if (
        !force &&
        destination.hotelsRefreshedAt &&
        error instanceof DomainError &&
        error.code === 'SUPPLIER_UNAVAILABLE'
      ) {
        this.warn('catalog-city-stale', error);
        return this.database.tboHotel.count({
          where: { scope: this.scope, destinationId: code, active: true },
        });
      }
      throw error;
    }
    const refreshedAt = new Date();
    // One replacement transaction: partial supplier responses or failed writes cannot
    // hide the previous city catalogue. Financial tables are never touched.
    await this.database.$transaction(
      async (tx) => {
        await tx.tboHotel.updateMany({
          where: { scope: this.scope, destinationId: code, active: true },
          data: { active: false },
        });
        for (let offset = 0; offset < hotels.length; offset += 200) {
          const batch = hotels.slice(offset, offset + 200).map((hotel) => ({
            id: hotel.id,
            name: hotel.name,
            searchText: catalogSearchText(hotel.name),
            content: contentJson(hotel),
          }));
          // Parameterized bulk upsert avoids one database round-trip per hotel.
          const written = await tx.$executeRaw`
          INSERT INTO "TboHotel" ("scope", "id", "destinationId", "name", "searchText", "content", "active", "refreshedAt", "updatedAt")
          SELECT ${this.scope}, h.id, ${code}, h.name, h."searchText", h.content, true, ${refreshedAt}, ${refreshedAt}
          FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS h(id text, name text, "searchText" text, content jsonb)
          ON CONFLICT ("scope", "id") DO UPDATE SET
            "destinationId" = EXCLUDED."destinationId", "name" = EXCLUDED."name", "searchText" = EXCLUDED."searchText",
            "content" = EXCLUDED."content", "active" = true, "refreshedAt" = EXCLUDED."refreshedAt",
            "detailsRefreshedAt" = NULL, "updatedAt" = EXCLUDED."updatedAt"
          WHERE "TboHotel"."destinationId" = EXCLUDED."destinationId"
        `;
          if (written !== batch.length) throw invalidResponse();
        }
        await tx.tboDestination.update({
          where: { scope_id: { scope: this.scope, id: code } },
          data: { hotelsRefreshedAt: refreshedAt },
        });
      },
      { timeout: 60_000 },
    );
    return hotels.length;
  }

  async getHotelDetails(hotelId: string): Promise<Hotel> {
    const code = parseResponse(tboHotelCodeSchema, hotelId);
    const row = await this.database.tboHotel.findUnique({
      where: { scope_id: { scope: this.scope, id: code } },
    });
    if (row && this.fresh(row.detailsRefreshedAt)) return parseResponse(hotelSchema, row.content);
    const existing = this.detailRefreshes.get(code);
    if (existing) return existing;
    const pending = this.refreshDetails(code);
    this.detailRefreshes.set(code, pending);
    try {
      return await pending;
    } finally {
      this.detailRefreshes.delete(code);
    }
  }

  private async refreshDetails(code: string): Promise<Hotel> {
    const result = parseResponse(
      tboDetailsResponseSchema,
      await this.client.read('HotelDetails', { Hotelcodes: code, Language: 'EN' }),
    );
    const item = result.HotelDetails[0];
    if (!item) throw new DomainError('HOTEL_NOT_AVAILABLE', 'This hotel is not available.', 404);
    if (result.HotelDetails.length !== 1 || item.HotelCode !== code) throw invalidResponse();
    const hotel = hotelSchema.parse({ ...mapHotelDetails(item), source: 'live' });
    if (hotel.name.length > 500) throw invalidResponse();
    const row = await this.database.tboHotel.findUnique({
      where: { scope_id: { scope: this.scope, id: code } },
    });
    if (row) {
      const existing = parseResponse(hotelSchema, row.content);
      if (item.CityId && item.CityId !== row.destinationId) throw invalidResponse();
      if (hotel.countryCode && existing.countryCode && hotel.countryCode !== existing.countryCode)
        throw invalidResponse();
      const merged = hotelSchema.parse({ ...existing, ...hotel });
      await this.database.tboHotel.update({
        where: { scope_id: { scope: this.scope, id: code } },
        data: {
          name: merged.name,
          searchText: catalogSearchText(merged.name),
          content: contentJson(merged),
          detailsRefreshedAt: new Date(),
        },
      });
      return merged;
    }
    // Direct detail URLs can resolve real hotels outside the configured catalogue.
    // Do not invent a destination relationship when the supplier does not provide one.
    return hotel;
  }

  async syncDestinations(
    countryCodes: string[],
    force = false,
    deadline?: number,
  ): Promise<{ countries: number; destinations: number }> {
    this.assertDeadline(deadline);
    const key = `${[...new Set(countryCodes)].sort().join(',')}:${force}`;
    const existing = this.destinationRefreshes.get(key);
    if (existing) return this.beforeDeadline(existing, deadline);
    const pending = this.refreshDestinations(countryCodes, force, deadline).finally(() => {
      if (this.destinationRefreshes.get(key) === pending) this.destinationRefreshes.delete(key);
    });
    this.destinationRefreshes.set(key, pending);
    return this.beforeDeadline(pending, deadline);
  }

  private async refreshDestinations(countryCodes: string[], force: boolean, deadline?: number) {
    if (
      countryCodes.length === 0 ||
      countryCodes.length > 300 ||
      countryCodes.some((code) => !/^[A-Z]{2}$/.test(code))
    ) {
      throw new DomainError(
        'INVALID_CATALOG_COUNTRIES',
        'Use ISO country codes for catalogue synchronization.',
        400,
      );
    }
    const selected = [...new Set(countryCodes)];
    const stored = await this.database.tboCountry.findMany({
      where: { scope: this.scope, code: { in: selected } },
    });
    if (
      !force &&
      this.fresh(this.countryDirectoryRefreshedAt) &&
      stored.length === selected.length &&
      stored.every((country) => this.fresh(country.destinationsRefreshedAt))
    )
      return {
        countries: selected.length,
        destinations: await this.database.tboDestination.count({
          where: { scope: this.scope, countryCode: { in: selected }, active: true },
        }),
      };
    let countries: { Code: string; Name: string }[];
    if (
      !force &&
      this.fresh(this.countryDirectoryRefreshedAt) &&
      stored.length === selected.length
    ) {
      countries = stored.map((country) => ({ Code: country.code, Name: country.name }));
    } else {
      const response = parseResponse(
        tboCountriesResponseSchema,
        await this.client.read('CountryList', {}, ...(deadline === undefined ? [] : [deadline])),
      );
      assertUnique(response.CountryList.map((country) => country.Code));
      // Import every country name cheaply; only requested countries need CityList calls.
      // Preserve destination refresh timestamps so worldwide discovery does not trigger
      // a worldwide city/hotel import on application startup.
      const directory = response.CountryList.map((country) => ({
        code: country.Code,
        name: country.Name,
      }));
      await this.database.$executeRaw`
      INSERT INTO "TboCountry" ("scope", "code", "name", "updatedAt")
      SELECT ${this.scope}, c.code, c.name, ${new Date()}
      FROM jsonb_to_recordset(${JSON.stringify(directory)}::jsonb) AS c(code text, name text)
      ON CONFLICT ("scope", "code") DO UPDATE SET "name" = EXCLUDED."name", "updatedAt" = EXCLUDED."updatedAt"
    `;
      this.countryDirectoryRefreshedAt = new Date();
      countries = response.CountryList.filter((country) => selected.includes(country.Code));
    }
    if (countries.length !== selected.length)
      throw new DomainError(
        'INVALID_CATALOG_COUNTRIES',
        'A configured country is unavailable from the supplier catalogue.',
        400,
      );
    let total = 0;
    // Sequential country refresh deliberately bounds supplier traffic independent of
    // the number of cities; hotel lists are loaded only by explicit warmup or search.
    for (const country of countries) {
      this.assertDeadline(deadline);
      const previous = stored.find((row) => row.code === country.Code);
      if (!force && previous && this.fresh(previous.destinationsRefreshedAt)) {
        total += await this.database.tboDestination.count({
          where: { scope: this.scope, countryCode: country.Code, active: true },
        });
        continue;
      }
      const cities = parseResponse(
        tboCitiesResponseSchema,
        await this.client.read(
          'CityList',
          { CountryCode: country.Code },
          ...(deadline === undefined ? [] : [deadline]),
        ),
      );
      assertUnique(cities.CityList.map((city) => city.Code));
      await this.database.$transaction(
        async (tx) => {
          await tx.tboCountry.upsert({
            where: { scope_code: { scope: this.scope, code: country.Code } },
            create: { scope: this.scope, code: country.Code, name: country.Name },
            update: { name: country.Name },
          });
          await tx.tboDestination.updateMany({
            where: { scope: this.scope, countryCode: country.Code },
            data: { active: false },
          });
          for (let offset = 0; offset < cities.CityList.length; offset += 500) {
            const batch = cities.CityList.slice(offset, offset + 500).map((city) => ({
              id: city.Code,
              name: city.Name,
              searchText: catalogSearchText(`${city.Name} ${country.Name} ${country.Code}`),
            }));
            const written = await tx.$executeRaw`
            INSERT INTO "TboDestination" ("scope", "id", "name", "countryCode", "searchText", "active", "updatedAt")
            SELECT ${this.scope}, c.id, c.name, ${country.Code}, c."searchText", true, ${new Date()}
            FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS c(id text, name text, "searchText" text)
            ON CONFLICT ("scope", "id") DO UPDATE SET
              "name" = EXCLUDED."name", "countryCode" = EXCLUDED."countryCode", "searchText" = EXCLUDED."searchText",
              "active" = true, "updatedAt" = EXCLUDED."updatedAt"
            WHERE "TboDestination"."countryCode" = EXCLUDED."countryCode"
          `;
            if (written !== batch.length) throw invalidResponse();
          }
          await tx.tboCountry.update({
            where: { scope_code: { scope: this.scope, code: country.Code } },
            data: { destinationsRefreshedAt: new Date() },
          });
        },
        { timeout: 60_000 },
      );
      total += cities.CityList.length;
    }
    return { countries: countries.length, destinations: total };
  }

  private fresh(value: Date | null | undefined): boolean {
    return (
      value != null &&
      value.getTime() >
        Date.now() - this.config.get('TBO_CATALOG_TTL_SECONDS', { infer: true }) * 1000
    );
  }

  private warn(operation: string, error: unknown): void {
    this.logger.warn({
      supplier: 'TBO',
      operation,
      code: error instanceof DomainError ? error.code : 'CATALOG_UNAVAILABLE',
    });
  }
}
