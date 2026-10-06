import type { Hotel, HotelSearchRequest } from '@hotel/contracts';
import { Injectable } from '@nestjs/common';
import type { z } from 'zod';

import { DomainError } from '../../common/errors/domain-error';
import type {
  HotelSupplier,
  SupplierBookingRequest,
  SupplierBookingResult,
  SupplierRate,
  SupplierSearchResult,
} from '../hotels/hotel-supplier';
import { CurrencyService } from '../pricing/currency.service';
import {
  tboCatalogResponseSchema,
  tboDetailsResponseSchema,
  tboSearchResponseSchema,
} from './dto/tbo.schemas';
import { mapCatalogHotel, mapHotelDetails, mapHotelRate } from './mappers/tbo-hotel.mapper';
import { TboClient } from './tbo.client';

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

  constructor(
    private readonly client: TboClient,
    private readonly money: CurrencyService,
  ) {}

  async searchHotels(input: HotelSearchRequest): Promise<SupplierSearchResult[]> {
    const catalog = parseResponse(
      tboCatalogResponseSchema,
      await this.client.read('TBOHotelCodeList', {
        CityCode: input.destination,
        IsDetailedResponse: true,
      }),
    );
    const hotels = new Map(
      catalog.Hotels.map((hotel) => [hotel.HotelCode, mapCatalogHotel(hotel)]),
    );
    const codes = [...hotels.keys()];
    const results: SupplierSearchResult[] = [];
    // Bound concurrent requests; do not flood the supplier for a large destination.
    for (let offset = 0; offset < codes.length; offset += 300) {
      const batches: string[][] = [];
      for (let start = offset; start < Math.min(offset + 300, codes.length); start += 100) {
        batches.push(codes.slice(start, start + 100));
      }
      const responses = await Promise.all(batches.map((batch) => this.searchCodes(batch, input)));
      for (const response of responses) {
        for (const hotel of response.HotelResult) {
          const details = hotels.get(hotel.HotelCode);
          if (!details)
            throw new DomainError(
              'INVALID_SUPPLIER_RESPONSE',
              'Unknown hotel returned by supplier.',
              502,
            );
          // Currency mismatches must never be displayed as the requested currency.
          if (hotel.Currency !== input.currency) continue;
          results.push({
            hotel: details,
            rates: hotel.Rooms.map((room) =>
              mapHotelRate(room, hotel.HotelCode, hotel.Currency, this.money),
            ),
          });
        }
      }
    }
    return results;
  }

  async getHotelDetails(hotelId: string): Promise<Hotel> {
    const result = parseResponse(
      tboDetailsResponseSchema,
      await this.client.read('Hoteldetails', {
        Hotelcodes: hotelId,
        Language: 'EN',
        IsRoomDetailRequired: true,
      }),
    );
    const hotel = result.HotelDetails.find((item) => item.HotelCode === hotelId);
    if (!hotel) throw new DomainError('HOTEL_NOT_AVAILABLE', 'This hotel is not available.', 404);
    return mapHotelDetails(hotel);
  }

  async getAvailability(hotelId: string, input: HotelSearchRequest): Promise<SupplierRate[]> {
    const response = await this.searchCodes([hotelId], input);
    const hotel = response.HotelResult.find(
      (item) => item.HotelCode === hotelId && item.Currency === input.currency,
    );
    return (
      hotel?.Rooms.map((room) => mapHotelRate(room, hotel.HotelCode, hotel.Currency, this.money)) ??
      []
    );
  }

  async recheckPrice(supplierRateId: string): Promise<SupplierRate> {
    const result = parseResponse(
      tboSearchResponseSchema,
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
    return mapHotelRate(
      candidates[0].room,
      candidates[0].hotel.HotelCode,
      candidates[0].hotel.Currency,
      this.money,
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

  private async searchCodes(codes: string[], input: HotelSearchRequest) {
    return parseResponse(
      tboSearchResponseSchema,
      await this.client.read('Search', {
        CheckIn: input.checkIn,
        CheckOut: input.checkOut,
        HotelCodes: codes.join(','),
        GuestNationality: input.nationality,
        PreferredCurrencyCode: input.currency,
        PaxRooms: input.rooms.map((room) => ({
          Adults: room.adults,
          Children: room.childrenAges.length,
          ChildrenAges: room.childrenAges.length ? room.childrenAges : null,
        })),
        ResponseTime: 23,
        IsDetailedResponse: true,
        Filters: { NoOfRooms: input.rooms.length, MealType: 'All' },
      }),
    );
  }
}
