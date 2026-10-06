import { randomUUID } from 'node:crypto';

import {
  type HotelSearchRequest,
  type HotelSearchResponse,
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
import { cachedRateSchema } from './search.schemas';

const RATE_TTL_SECONDS = 15 * 60;

@Injectable()
export class SearchService {
  constructor(
    @Inject(HOTEL_SUPPLIER) private readonly supplier: HotelSupplier,
    private readonly pricing: PricingService,
    private readonly redis: RedisService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async searchHotels(input: HotelSearchRequest): Promise<HotelSearchResponse> {
    this.assertStay(input);
    const results = await this.supplier.searchHotels(input);
    const expiresAt = new Date(Date.now() + RATE_TTL_SECONDS * 1000).toISOString();
    const pipeline = this.redis.client.pipeline();
    const hotels = results.map(({ hotel, rates }) => ({
      hotel,
      rates: rates.map((rate) => {
        const rateId = randomUUID();
        // Only the opaque UUID crosses the API boundary; supplier references remain server-side.
        pipeline.set(
          `hotel-rate:${rateId}`,
          JSON.stringify({
            supplier: this.supplier.name,
            hotel,
            criteria: input,
            supplierRateId: rate.supplierRateId,
            roomName: rate.roomName,
            currency: rate.price.currency,
            expiresAt,
          }),
          'EX',
          RATE_TTL_SECONDS,
        );
        return {
          rateId,
          roomName: rate.roomName,
          ...(rate.mealType ? { mealType: rate.mealType } : {}),
          refundable: rate.refundable,
          price: this.pricing.calculateBookingTotal(rate.price),
          expiresAt,
        };
      }),
    }));
    if (hotels.some((hotel) => hotel.rates.length)) {
      const persisted = await pipeline.exec();
      if (!persisted || persisted.some(([error]) => error)) {
        throw new DomainError(
          'SEARCH_UNAVAILABLE',
          'Search could not be saved. Please try again.',
          503,
        );
      }
    }
    return { hotels };
  }

  async recheckHotelRate(rateId: string, userId: string): Promise<QuoteResponse> {
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
      rate.roomName !== cached.roomName
    ) {
      throw new DomainError(
        'HOTEL_RATE_CHANGED',
        'The selected room has changed. Please search again.',
        409,
      );
    }
    const quote = await this.pricing.createQuote({
      userId,
      supplier: this.supplier.name,
      rateId,
      rate,
      hotel: cached.hotel,
      criteria: cached.criteria,
    });
    return {
      id: quote.id,
      hotel: cached.hotel,
      checkIn: cached.criteria.checkIn,
      checkOut: cached.criteria.checkOut,
      rooms: cached.criteria.rooms,
      price: this.pricing.calculateBookingTotal(rate.price),
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
