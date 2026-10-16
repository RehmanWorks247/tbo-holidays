import type { HotelSearchRequest, HotelSearchResponse, QuoteResponse } from '@hotel/contracts';
import { Injectable } from '@nestjs/common';

import { MockHotelSupplier, rejectMockBooking } from '../hotels/mock-hotel.supplier';
import { browseHotelResults } from './hotel-results';
import type { SearchService } from './search.service';

/** Explicit read-only provider: reads PostgreSQL catalogue, never creates quotes or payments. */
@Injectable()
export class MockSearchService implements Pick<SearchService, 'searchHotels' | 'recheckHotelRate'> {
  constructor(private readonly supplier: MockHotelSupplier) {}

  async searchHotels(input: HotelSearchRequest): Promise<HotelSearchResponse> {
    const results = await this.supplier.searchHotels(input);
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
    return browseHotelResults(
      hotels,
      input,
      'mock',
      hotels[0]?.hotel.city ?? (await this.supplier.destinationName(input.destination)),
    );
  }

  async recheckHotelRate(): Promise<QuoteResponse> {
    return rejectMockBooking();
  }
}
