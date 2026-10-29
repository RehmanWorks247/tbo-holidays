import {
  type HotelCatalogQuery,
  type HotelSearchSuggestionsResponse,
  type HotelSuggestionsQuery,
} from '@hotel/contracts';
import { Inject, Injectable, Optional } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error';
import { TboCatalogService } from '../tbo/tbo-catalog.service';
import { HOTEL_SUPPLIER, type HotelSupplier } from './hotel-supplier';
import { MockHotelSupplier } from './mock-hotel.supplier';

@Injectable()
export class HotelsService {
  constructor(
    @Inject(HOTEL_SUPPLIER) private readonly supplier: HotelSupplier,
    @Optional() private readonly catalog?: TboCatalogService,
  ) {}

  getDestinations() {
    return this.supplier instanceof MockHotelSupplier
      ? this.supplier.getDestinations()
      : this.requireCatalog().getDestinations();
  }

  async getSuggestions(query: HotelSuggestionsQuery): Promise<HotelSearchSuggestionsResponse> {
    if (!(this.supplier instanceof MockHotelSupplier))
      return this.requireCatalog().getSuggestions(query);
    const result = await this.supplier.getDestinations();
    const search = query.query.trim().toLocaleLowerCase();
    return {
      source: 'mock',
      suggestions:
        search.length < 2
          ? []
          : result.destinations
              .filter((destination) =>
                `${destination.name} ${destination.countryCode}`
                  .toLocaleLowerCase()
                  .includes(search),
              )
              .slice(0, query.limit)
              .map((destination) => ({
                ...destination,
                type: 'destination',
                destinationId: destination.id,
                destinationName: destination.name,
              })),
    };
  }

  private requireCatalog(): TboCatalogService {
    if (!this.catalog)
      throw new DomainError(
        'SUPPLIER_NOT_CONFIGURED',
        'Hotel discovery is unavailable until the supplier catalogue is configured.',
        503,
      );
    return this.catalog;
  }

  browseHotels(query: HotelCatalogQuery) {
    return this.requireCatalog().browseHotels(query);
  }

  getHotelDetails(hotelId: string) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(hotelId)) {
      throw new DomainError('INVALID_HOTEL_ID', 'The hotel identifier is invalid.', 400);
    }
    return this.supplier.getHotelDetails(hotelId);
  }
}
