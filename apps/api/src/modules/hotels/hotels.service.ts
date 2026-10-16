import { Inject, Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error';
import { HOTEL_SUPPLIER, type HotelSupplier } from './hotel-supplier';
import { MockHotelSupplier } from './mock-hotel.supplier';

@Injectable()
export class HotelsService {
  constructor(@Inject(HOTEL_SUPPLIER) private readonly supplier: HotelSupplier) {}

  getDestinations() {
    return this.supplier instanceof MockHotelSupplier
      ? this.supplier.getDestinations()
      : { source: 'live' as const, destinations: [] };
  }

  getHotelDetails(hotelId: string) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(hotelId)) {
      throw new DomainError('INVALID_HOTEL_ID', 'The hotel identifier is invalid.', 400);
    }
    return this.supplier.getHotelDetails(hotelId);
  }
}
