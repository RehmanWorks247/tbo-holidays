import { createHash } from 'node:crypto';

import { type Hotel, type HotelSearchRequest, hotelSearchRequestSchema } from '@hotel/contracts';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { z } from 'zod';

import { DomainError } from '../../common/errors/domain-error';
import type { Environment } from '../../config/environment';
import type {
  HotelSupplier,
  SupplierBookingRequest,
  SupplierBookingResult,
  SupplierRate,
  SupplierSearchResult,
} from '../hotels/hotel-supplier';
import { CurrencyService } from '../pricing/currency.service';
import {
  tboHotelCodeSchema,
  tboPreBookResponseSchema,
  tboSearchResponseSchema,
} from './dto/tbo.schemas';
import { mapHotelRate } from './mappers/tbo-hotel.mapper';
import { TboClient } from './tbo.client';
import { TboCatalogService } from './tbo-catalog.service';

function parseResponse<T>(schema: z.ZodType<T>, response: unknown): T {
  const parsed = schema.safeParse(response);
  if (!parsed.success) {
    throw new DomainError(
      'INVALID_SUPPLIER_RESPONSE',
      'The supplier returned an unsupported response.',
      502,
    );
  }
  return parsed.data;
}

@Injectable()
export class TboService implements HotelSupplier {
  readonly name = 'TBO';
  readonly cacheScope: string;

  constructor(
    private readonly client: TboClient,
    private readonly money: CurrencyService,
    private readonly catalog: TboCatalogService,
    private readonly config: ConfigService<Environment, true>,
  ) {
    this.cacheScope = createHash('sha256')
      .update(
        JSON.stringify([
          config.get('TBO_BASE_URL', { infer: true }),
          config.get('TBO_USERNAME', { infer: true }),
        ]),
      )
      .digest('hex');
  }

  async searchHotels(input: HotelSearchRequest): Promise<SupplierSearchResult[]> {
    this.assertCriteria(input);
    const deadline = Date.now() + this.config.get('TBO_SEARCH_TIMEOUT_MS', { infer: true });
    const selectedCode = input.hotelId
      ? this.parseCode(input.hotelId, 'INVALID_HOTEL_ID')
      : undefined;
    const catalog = await this.catalog.getSearchHotels(input.destination, selectedCode, deadline);
    const hotels = new Map(catalog.map((hotel) => [hotel.id, hotel]));
    if (hotels.size !== catalog.length) throw this.invalidResponse();
    if (selectedCode && !hotels.has(selectedCode)) {
      throw new DomainError(
        'HOTEL_NOT_AVAILABLE',
        'This hotel is not available in the selected destination.',
        404,
      );
    }
    const codes = selectedCode ? [selectedCode] : [...hotels.keys()];
    const results: SupplierSearchResult[] = [];
    const seenRates = new Set<string>();
    // Bound concurrent requests; do not flood the supplier for a large destination.
    for (let offset = 0; offset < codes.length; offset += 300) {
      const batches: string[][] = [];
      for (let start = offset; start < Math.min(offset + 300, codes.length); start += 100) {
        batches.push(codes.slice(start, start + 100));
      }
      const responses = await Promise.all(
        batches.map((batch) => this.searchCodes(batch, input, deadline)),
      );
      for (const response of responses) {
        for (const hotel of response.HotelResult) {
          const details = hotels.get(hotel.HotelCode);
          if (!details) throw this.invalidResponse();
          if (hotel.Rooms.length === 0) continue;
          for (const room of hotel.Rooms) {
            if (seenRates.has(room.BookingCode)) throw this.invalidResponse();
            seenRates.add(room.BookingCode);
          }
          results.push({
            hotel: details,
            rates: hotel.Rooms.map((room) =>
              mapHotelRate(room, hotel.HotelCode, hotel.Currency, this.money, hotel.RateConditions),
            ),
          });
        }
      }
    }
    return results;
  }

  async getHotelDetails(hotelId: string): Promise<Hotel> {
    const code = this.parseCode(hotelId, 'INVALID_HOTEL_ID');
    return this.catalog.getHotelDetails(code);
  }

  async getAvailability(hotelId: string, input: HotelSearchRequest): Promise<SupplierRate[]> {
    this.assertCriteria(input);
    const code = this.parseCode(hotelId, 'INVALID_HOTEL_ID');
    const response = await this.searchCodes([code], input);
    const hotel = response.HotelResult.find((item) => item.HotelCode === code);
    return (
      hotel?.Rooms.map((room) =>
        mapHotelRate(room, hotel.HotelCode, hotel.Currency, this.money, hotel.RateConditions),
      ) ?? []
    );
  }

  async recheckPrice(supplierRateId: string): Promise<SupplierRate> {
    if (!supplierRateId || supplierRateId.length > 4096)
      throw new DomainError('RATE_EXPIRED', 'Please search again to refresh this room.', 409);
    const result = parseResponse(
      tboPreBookResponseSchema,
      await this.client.read('PreBook', { BookingCode: supplierRateId, PaymentMode: 'Limit' }),
    );
    const candidates = result.HotelResult.flatMap((hotel) =>
      hotel.Rooms.map((room) => ({ hotel, room })),
    );
    // Never silently substitute a different room if a response is ambiguous.
    if (candidates.length !== 1 || !candidates[0]) {
      throw new DomainError(
        'HOTEL_NOT_AVAILABLE',
        'Please search again to select an available room.',
        409,
      );
    }
    // The supplied specification does not establish token rotation at PreBook.
    // Never accept a different unit just because it is the only result.
    if (candidates[0].room.BookingCode !== supplierRateId)
      throw new DomainError(
        'HOTEL_RATE_CHANGED',
        'The selected room has changed. Please search again.',
        409,
      );
    return mapHotelRate(
      candidates[0].room,
      candidates[0].hotel.HotelCode,
      candidates[0].hotel.Currency,
      this.money,
      candidates[0].hotel.RateConditions,
    );
  }

  createBooking(_input: SupplierBookingRequest): Promise<SupplierBookingResult> {
    return Promise.reject(this.uncertified());
  }

  getBooking(_reference: {
    clientReference: string;
    supplierBookingId?: string;
  }): Promise<SupplierBookingResult> {
    return Promise.reject(this.uncertified());
  }

  cancelBooking(_input: {
    clientReference: string;
    supplierBookingId: string;
  }): Promise<{ status: 'cancelled' | 'pending' }> {
    return Promise.reject(this.uncertified());
  }

  private uncertified(): DomainError {
    return new DomainError(
      'SUPPLIER_INTEGRATION_REQUIRED',
      'Booking operations require a certified supplier integration.',
      503,
    );
  }

  private async searchCodes(codes: string[], input: HotelSearchRequest, deadline?: number) {
    const result = parseResponse(
      tboSearchResponseSchema,
      await this.client.read(
        'Search',
        {
          CheckIn: input.checkIn,
          CheckOut: input.checkOut,
          HotelCodes: codes.join(','),
          GuestNationality: input.nationality,
          PaxRooms: input.rooms.map((room) => ({
            Adults: room.adults,
            Children: room.childrenAges.length,
            ChildrenAges: room.childrenAges,
          })),
          ResponseTime: 23,
          IsDetailedResponse: false,
          Filters: { MealType: 'All' },
        },
        deadline,
      ),
    );
    const seenHotels = new Set<string>();
    const seenRates = new Set<string>();
    for (const hotel of result.HotelResult) {
      if (!codes.includes(hotel.HotelCode) || seenHotels.has(hotel.HotelCode))
        throw this.invalidResponse();
      seenHotels.add(hotel.HotelCode);
      if (hotel.Currency !== input.currency) {
        throw new DomainError(
          'SUPPLIER_CURRENCY_MISMATCH',
          'The supplier account does not return the requested currency.',
          422,
        );
      }
      for (const room of hotel.Rooms) {
        if (room.Name.length !== input.rooms.length || seenRates.has(room.BookingCode))
          throw this.invalidResponse();
        seenRates.add(room.BookingCode);
      }
    }
    return result;
  }

  private assertCriteria(input: HotelSearchRequest): void {
    if (!hotelSearchRequestSchema.safeParse(input).success)
      throw new DomainError('INVALID_SEARCH', 'The hotel search criteria are invalid.', 400);
  }

  private parseCode(value: string, errorCode: string): string {
    const parsed = tboHotelCodeSchema.safeParse(value);
    if (!parsed.success)
      throw new DomainError(
        errorCode,
        'A valid supplier destination or hotel code is required.',
        400,
      );
    return parsed.data;
  }

  private invalidResponse(): DomainError {
    return new DomainError(
      'INVALID_SUPPLIER_RESPONSE',
      'The supplier returned an unsupported response.',
      502,
    );
  }
}
