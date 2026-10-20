import {
  type HotelPreviewStay,
  type HotelSearchResponse,
  type MockHotelSearchRequest,
  type QuoteResponse,
  validateStay,
} from '@hotel/contracts';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DomainError } from '../../common/errors/domain-error';
import type { Environment } from '../../config/environment';
import { MockHotelSupplier, rejectMockBooking } from '../hotels/mock-hotel.supplier';
import { browseHotelResults } from './hotel-results';
import type { SearchService } from './search.service';

/** Explicit read-only provider: reads PostgreSQL catalogue, never creates quotes or payments. */
@Injectable()
export class MockSearchService implements Pick<SearchService, 'searchHotels' | 'recheckHotelRate'> {
  constructor(
    private readonly supplier: MockHotelSupplier,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async searchHotels(input: MockHotelSearchRequest): Promise<HotelSearchResponse> {
    const previewStay = this.resolvePreviewStay(input);
    const destinations = input.destination
      ? [input.destination]
      : (await this.supplier.getDestinations()).destinations.map(({ id }) => id);
    const results = (
      await Promise.all(
        destinations.map((destination) =>
          this.supplier.searchHotels({ ...input, ...previewStay, destination }),
        ),
      )
    ).flat();
    const expiresAt = new Date(Date.now() + 900_000).toISOString();
    const hotels = results.map(({ hotel, rates }) => ({
      hotel,
      rates: rates.map((rate) => ({
        rateId: rate.supplierRateId,
        roomName: rate.roomName,
        mealType: rate.mealType,
        refundable: rate.refundable,
        cancellationPolicies: rate.cancellationPolicies,
        terms: rate.terms,
        price: {
          currency: input.currency,
          baseAmount: rate.price.baseAmount,
          taxAmount: rate.price.taxAmount,
          feeAmount: rate.price.feeAmount,
          markupAmount: 0,
          discountAmount: 0,
          totalAmount: rate.price.baseAmount + rate.price.taxAmount + rate.price.feeAmount,
        },
        expiresAt,
      })),
    }));
    const response = browseHotelResults(
      hotels,
      { ...input, pageSize: input.pageSize ?? 50 },
      'mock',
      input.destination
        ? (hotels[0]?.hotel.city ?? (await this.supplier.destinationName(input.destination)))
        : 'All destinations',
    );
    if (response.metadata) response.metadata.previewStay = previewStay;
    return response;
  }

  private resolvePreviewStay(input: MockHotelSearchRequest): HotelPreviewStay {
    const maximumNights = this.config.get('MAX_STAY_NIGHTS', { infer: true });
    const defaultNights = Math.min(7, maximumNights);
    const today = new Date().toISOString().slice(0, 10);
    const offsetDate = (date: string, days: number) =>
      new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);
    // A check-out-only search uses the preceding week, shortened to avoid past nights.
    const inferredCheckIn = input.checkOut
      ? offsetDate(input.checkOut, -defaultNights)
      : offsetDate(today, 30);
    const checkIn = input.checkIn ?? (inferredCheckIn < today ? today : inferredCheckIn);
    const checkOut = input.checkOut ?? offsetDate(checkIn, defaultNights);
    const error = validateStay(checkIn, checkOut, maximumNights);
    if (error) throw new DomainError('INVALID_STAY', error, 400);
    return {
      checkIn,
      checkOut,
      nationality: input.nationality ?? 'GB',
      rooms: input.rooms ?? [{ adults: 2, childrenAges: [] }],
      currency: input.currency,
    };
  }

  async recheckHotelRate(): Promise<QuoteResponse> {
    return rejectMockBooking();
  }
}
