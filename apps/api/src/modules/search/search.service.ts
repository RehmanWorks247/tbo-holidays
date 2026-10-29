import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import {
  type HotelSearchRequest,
  type HotelSearchResponse,
  type HotelSearchResult,
  type QuoteResponse,
  validateStay,
} from '@hotel/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DomainError } from '../../common/errors/domain-error';
import type { Environment } from '../../config/environment';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { HOTEL_SUPPLIER, type HotelSupplier } from '../hotels/hotel-supplier';
import { PricingService } from '../pricing/pricing.service';
import { browseHotelResults } from './hotel-results';
import { cachedHotelInventorySchema, cachedRateSchema } from './search.schemas';

const RATE_TTL_SECONDS = 15 * 60;
const INVENTORY_TTL_SECONDS = 30;
const RATE_WRITE_BATCH_SIZE = 500;

function searchText(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function destinationLabel(destination: string, hotels: HotelSearchResult[]): string {
  const country = /^(?:country:)?([a-z]{2})$/i.exec(destination);
  if (country?.[1])
    return (
      new Intl.DisplayNames(['en'], { type: 'region' }).of(country[1].toUpperCase()) ?? destination
    );
  if (/^\d+$/.test(destination)) return hotels[0]?.hotel.city ?? destination;
  const city = hotels[0]?.hotel.city;
  return city && searchText(city) === searchText(destination) ? city : destination;
}

@Injectable()
export class SearchService {
  private readonly pendingInventory = new Map<string, Promise<HotelSearchResult[]>>();

  constructor(
    @Inject(HOTEL_SUPPLIER) private readonly supplier: HotelSupplier,
    private readonly pricing: PricingService,
    private readonly redis: RedisService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async searchHotels(input: HotelSearchRequest): Promise<HotelSearchResponse> {
    this.assertStay(input);
    const criteria: HotelSearchRequest = {
      destination: input.destination,
      ...(input.hotelId ? { hotelId: input.hotelId } : {}),
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nationality: input.nationality,
      rooms: input.rooms,
      currency: input.currency,
    };
    const key = `hotel-inventory:v3:${createHash('sha256')
      .update(
        JSON.stringify({
          supplier: this.supplier.name,
          scope: this.supplier.cacheScope,
          markup: this.config.get('MARKUP_BASIS_POINTS', { infer: true }),
          criteria: { ...criteria, destination: searchText(criteria.destination) },
        }),
      )
      .digest('hex')}`;
    const cached = await this.readInventory(key, criteria.currency);
    let hotels = cached;
    if (!hotels) {
      let pending = this.pendingInventory.get(key);
      if (!pending) {
        pending = this.loadInventory(criteria, key);
        this.pendingInventory.set(key, pending);
      }
      try {
        hotels = await pending;
      } finally {
        if (this.pendingInventory.get(key) === pending) this.pendingInventory.delete(key);
      }
    }
    return browseHotelResults(hotels, input, 'live', destinationLabel(input.destination, hotels));
  }

  private async readInventory(
    key: string,
    currency: string,
  ): Promise<HotelSearchResult[] | undefined> {
    let raw: string | null;
    try {
      raw = await this.redis.client.get(key);
    } catch {
      throw new DomainError(
        'SEARCH_UNAVAILABLE',
        'Search is temporarily unavailable. Please try again.',
        503,
      );
    }
    if (!raw) return undefined;
    // Invalid or stale short-lived inventory is deliberately refreshed, never reused.
    let payload: unknown;
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
    const parsed = cachedHotelInventorySchema.safeParse(payload);
    if (
      !parsed.success ||
      Date.parse(parsed.data.expiresAt) <= Date.now() ||
      parsed.data.hotels.some(({ rates }) =>
        rates.some(
          (rate) => Date.parse(rate.expiresAt) <= Date.now() || rate.price.currency !== currency,
        ),
      )
    )
      return undefined;
    return parsed.data.hotels;
  }

  private async loadInventory(
    input: HotelSearchRequest,
    inventoryKey: string,
  ): Promise<HotelSearchResult[]> {
    // Anchor the lifetime before supplier I/O: a large city may require several search batches.
    // Finishing later must not extend the lifetime of the earliest returned supplier token.
    const expiresAt = new Date(Date.now() + RATE_TTL_SECONDS * 1000).toISOString();
    const results = await this.supplier.searchHotels(input);
    if (Date.parse(expiresAt) <= Date.now())
      throw new DomainError('RATE_EXPIRED', 'Please search again to refresh these rooms.', 409);
    let pipeline = this.redis.client.pipeline();
    let pendingWrites = 0;
    const persistRates = async () => {
      if (!pendingWrites) return;
      try {
        const persisted = await pipeline.exec();
        if (
          !persisted ||
          persisted.length !== pendingWrites ||
          persisted.some(([error, result]) => error || result !== 'OK')
        )
          throw new Error('Search reference persistence failed.');
      } catch {
        throw new DomainError(
          'SEARCH_UNAVAILABLE',
          'Search could not be saved. Please try again.',
          503,
        );
      }
      pipeline = this.redis.client.pipeline();
      pendingWrites = 0;
    };
    const hotels = results.map(({ hotel, rates }) => ({
      hotel,
      rates: rates.map((rate) => {
        const rateId = randomUUID();
        return {
          rateId,
          roomName: rate.roomName,
          ...(rate.mealType ? { mealType: rate.mealType } : {}),
          refundable: rate.refundable,
          cancellationPolicies: rate.cancellationPolicies,
          ...(rate.terms ? { terms: rate.terms } : {}),
          price: this.pricing.calculateBookingTotal(rate.price),
          expiresAt,
        };
      }),
    }));
    for (let hotelIndex = 0; hotelIndex < results.length; hotelIndex++) {
      const result = results[hotelIndex]!;
      for (let rateIndex = 0; rateIndex < result.rates.length; rateIndex++) {
        const rate = result.rates[rateIndex]!;
        const rateId = hotels[hotelIndex]!.rates[rateIndex]!.rateId;
        // Only the opaque UUID crosses the API boundary; supplier references remain server-side.
        pipeline.set(
          `hotel-rate:${rateId}`,
          JSON.stringify({
            supplier: this.supplier.name,
            ...(this.supplier.cacheScope ? { supplierScope: this.supplier.cacheScope } : {}),
            hotel: result.hotel,
            criteria: input,
            supplierRateId: rate.supplierRateId,
            roomName: rate.roomName,
            ...(rate.terms ? { roomNames: rate.terms.roomNames } : {}),
            currency: rate.price.currency,
            expiresAt,
          }),
          'PXAT',
          Date.parse(expiresAt),
        );
        pendingWrites++;
        // Bound Redis command buffers for destinations with thousands of room offers.
        if (pendingWrites === RATE_WRITE_BATCH_SIZE) await persistRates();
      }
    }
    await persistRates();
    if (Date.parse(expiresAt) <= Date.now())
      throw new DomainError('RATE_EXPIRED', 'Please search again to refresh these rooms.', 409);
    // Save inventory only after every opaque rate reference has been persisted.
    // A cache hit reuses those references and their original expiry without extending either.
    try {
      const saved = await this.redis.client.set(
        inventoryKey,
        JSON.stringify({
          hotels,
          expiresAt: new Date(
            Math.min(Date.now() + INVENTORY_TTL_SECONDS * 1000, Date.parse(expiresAt)),
          ).toISOString(),
        }),
        'EX',
        INVENTORY_TTL_SECONDS,
      );
      if (saved !== 'OK') throw new Error('Search inventory persistence failed.');
    } catch {
      throw new DomainError(
        'SEARCH_UNAVAILABLE',
        'Search could not be saved. Please try again.',
        503,
      );
    }
    return hotels;
  }

  async recheckHotelRate(rateId: string, userId: string): Promise<QuoteResponse> {
    if (rateId.startsWith('mock:'))
      throw new DomainError(
        'MOCK_BOOKING_DISABLED',
        'Preview hotels cannot be booked or paid for.',
        409,
      );
    const raw = await this.redis.client.get(`hotel-rate:${rateId}`);
    if (!raw)
      throw new DomainError('RATE_EXPIRED', 'Please search again to refresh this room.', 409);
    let payload: unknown;
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      throw new DomainError('RATE_EXPIRED', 'Please search again to refresh this room.', 409);
    }
    const parsed = cachedRateSchema.safeParse(payload);
    if (
      !parsed.success ||
      parsed.data.supplier !== this.supplier.name ||
      parsed.data.supplierScope !== this.supplier.cacheScope ||
      Date.parse(parsed.data.expiresAt) <= Date.now()
    ) {
      throw new DomainError('RATE_EXPIRED', 'Please search again to refresh this room.', 409);
    }
    const cached = parsed.data;
    this.assertStay(cached.criteria);
    const rate = await this.supplier.recheckPrice(cached.supplierRateId);
    if (
      rate.hotelId !== cached.hotel.id ||
      rate.price.currency !== cached.currency ||
      rate.roomName !== cached.roomName ||
      (cached.roomNames && !isDeepStrictEqual(rate.terms?.roomNames, cached.roomNames)) ||
      (rate.terms && rate.terms.roomNames.length !== cached.criteria.rooms.length)
    ) {
      throw new DomainError(
        'HOTEL_RATE_CHANGED',
        'The selected room has changed. Please search again.',
        409,
      );
    }
    if (Date.parse(cached.expiresAt) <= Date.now())
      throw new DomainError('RATE_EXPIRED', 'Please search again to refresh this room.', 409);
    const quote = await this.pricing.createQuote({
      userId,
      supplier: this.supplier.name,
      rateId,
      rate,
      hotel: cached.hotel,
      criteria: cached.criteria,
      expiresAt: new Date(cached.expiresAt),
    });
    return {
      id: quote.id,
      hotel: cached.hotel,
      checkIn: cached.criteria.checkIn,
      checkOut: cached.criteria.checkOut,
      rooms: cached.criteria.rooms,
      price: this.pricing.calculateBookingTotal(rate.price),
      refundable: rate.refundable,
      ...(rate.mealType ? { mealType: rate.mealType } : {}),
      cancellationPolicies: rate.cancellationPolicies,
      ...(rate.terms ? { terms: rate.terms } : {}),
      expiresAt: quote.expiresAt.toISOString(),
    };
  }

  private assertStay(input: HotelSearchRequest): void {
    const error = validateStay(
      input.checkIn,
      input.checkOut,
      this.config.get('MAX_STAY_NIGHTS', { infer: true }),
    );
    if (error) throw new DomainError('INVALID_STAY', error, 400);
  }
}
