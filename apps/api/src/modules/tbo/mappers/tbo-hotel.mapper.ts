import type { Hotel } from '@hotel/contracts';

import { DomainError } from '../../../common/errors/domain-error';
import type { SupplierRate } from '../../hotels/hotel-supplier';
import type { CurrencyService } from '../../pricing/currency.service';
import type { TboCatalogHotel, TboDetails, TboRoom } from '../dto/tbo.schemas';

export function mapCatalogHotel(hotel: TboCatalogHotel): Hotel {
  return {
    id: hotel.HotelCode,
    name: hotel.HotelName,
    ...(hotel.Address ? { address: hotel.Address } : {}),
    ...(hotel.CityName ? { city: hotel.CityName } : {}),
    ...(hotel.CountryCode ? { countryCode: hotel.CountryCode } : {}),
    images: [],
    facilities: [],
  };
}

export function mapHotelDetails(hotel: TboDetails): Hotel {
  return {
    ...mapCatalogHotel(hotel),
    ...(hotel.Description ? { description: hotel.Description.replace(/<[^>]*>/g, '').trim() } : {}),
    images: hotel.Images.filter((url) => {
      try {
        return new URL(url).protocol === 'https:';
      } catch {
        return false;
      }
    }),
    facilities: hotel.HotelFacilities,
  };
}

export function mapHotelRate(
  room: TboRoom,
  hotelId: string,
  currency: string,
  money: CurrencyService,
): SupplierRate {
  const totalAmount = money.toMinorUnits(room.TotalFare, currency);
  const taxAmount = money.toMinorUnits(room.TotalTax, currency);
  if (taxAmount > totalAmount) {
    throw new DomainError(
      'INVALID_SUPPLIER_PRICE',
      'The supplier returned inconsistent pricing.',
      502,
    );
  }
  return {
    hotelId,
    supplierRateId: room.BookingCode,
    roomName: room.Name.join(' + '),
    ...(room.MealType ? { mealType: room.MealType } : {}),
    refundable: room.IsRefundable ?? false,
    // Candidate contract: TotalFare is tax-inclusive. Certification must confirm this.
    price: { currency, baseAmount: totalAmount - taxAmount, taxAmount, feeAmount: 0 },
    // Policies and supplements must be certified before booking is implemented.
    cancellationPolicies: [],
  };
}
