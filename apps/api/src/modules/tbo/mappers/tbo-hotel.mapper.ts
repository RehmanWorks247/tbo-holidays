import type { CancellationPolicy, Hotel } from '@hotel/contracts';

import { DomainError } from '../../../common/errors/domain-error';
import type { SupplierRate } from '../../hotels/hotel-supplier';
import type { CurrencyService } from '../../pricing/currency.service';
import type { TboCatalogHotel, TboDetails, TboRoom } from '../dto/tbo.schemas';
import { tboPolicyLocalDate, tboRoomSchema } from '../dto/tbo.schemas';

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  copy: '©',
  reg: '®',
  trade: '™',
};

/** Public fields remain plain text; never return supplier markup for HTML rendering. */
function plainText(value: string): string {
  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    decoded = decoded.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity: string, code: string) => {
      if (!code.startsWith('#')) return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
      const point =
        code[1]?.toLowerCase() === 'x'
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point)
        : '';
    });
  }
  return decoded
    .replace(/<!--[\s\S]*?(?:-->|$)/g, ' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ')
    .replace(/<[^>]*(?:>|$)/g, ' ')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function imageUrls(images: string[]): string[] {
  return images.flatMap((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.username === '' && url.password === ''
        ? [url.href]
        : [];
    } catch {
      return [];
    }
  });
}

function requiredText(value: string): string {
  const normalized = plainText(value);
  if (!normalized) throw invalidResponse();
  return normalized;
}

function invalidResponse(): DomainError {
  return new DomainError(
    'INVALID_SUPPLIER_RESPONSE',
    'The supplier returned invalid hotel data.',
    502,
  );
}

const STAR_RATINGS = { OneStar: 1, TwoStar: 2, ThreeStar: 3, FourStar: 4, FiveStar: 5 } as const;

export function mapCatalogHotel(hotel: TboCatalogHotel): Hotel {
  const rating = hotel.HotelRating;
  return {
    id: hotel.HotelCode,
    name: requiredText(hotel.HotelName),
    ...(hotel.Description ? { description: plainText(hotel.Description) } : {}),
    ...(hotel.Address ? { address: plainText(hotel.Address) } : {}),
    ...(hotel.CityName ? { city: plainText(hotel.CityName) } : {}),
    ...(hotel.CountryCode ? { countryCode: hotel.CountryCode } : {}),
    ...(rating !== undefined
      ? { starRating: typeof rating === 'number' ? rating : STAR_RATINGS[rating] }
      : {}),
    images: imageUrls(hotel.Images ?? []),
    facilities: (hotel.HotelFacilities ?? []).map(plainText).filter(Boolean),
  };
}

export function mapHotelDetails(hotel: TboDetails): Hotel {
  return mapCatalogHotel(hotel);
}

export function mapHotelRate(
  room: TboRoom,
  hotelId: string,
  currency: string,
  money: CurrencyService,
  rateConditions: string[] = [],
): SupplierRate {
  const parsed = tboRoomSchema.safeParse(room);
  if (!parsed.success) throw invalidResponse();
  const source = parsed.data;
  const totalAmount = money.toMinorUnits(source.TotalFare, currency);
  const taxAmount = money.toMinorUnits(source.TotalTax, currency);
  const extraGuestAmount =
    source.ExtraGuestCharges === undefined
      ? undefined
      : money.toMinorUnits(source.ExtraGuestCharges, currency);
  if (
    taxAmount > totalAmount ||
    (extraGuestAmount !== undefined && extraGuestAmount > totalAmount)
  ) {
    throw new DomainError(
      'INVALID_SUPPLIER_PRICE',
      'The supplier returned inconsistent pricing.',
      502,
    );
  }
  const cancellationPolicies: CancellationPolicy[] = (source.CancelPolicies ?? []).map((policy) => {
    const from = tboPolicyLocalDate(policy.FromDate);
    if (!from) throw invalidResponse();
    const common = {
      from,
      timeBasis: 'property-local' as const,
      ...(policy.Index !== undefined ? { roomIndex: policy.Index - 1 } : {}),
    };
    if (policy.ChargeType === 'Fixed') {
      return {
        ...common,
        chargeType: 'fixed',
        amount: money.toMinorUnits(policy.CancellationCharge, currency),
        currency,
      };
    }
    // Percentages are represented exactly in hundredths of one percent.
    const [whole = '0', fraction = ''] = String(policy.CancellationCharge).split('.');
    return {
      ...common,
      chargeType: 'percentage',
      percentageBasisPoints: Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2)),
    };
  });
  const roomNames = source.Name.map(requiredText);
  return {
    hotelId,
    supplierRateId: source.BookingCode,
    roomName: roomNames.join(' + '),
    ...(source.MealType ? { mealType: plainText(source.MealType) } : {}),
    refundable: source.IsRefundable ?? false,
    // Candidate account contract: the combination fare already includes tax and extra guests.
    price: {
      currency,
      baseAmount: totalAmount - taxAmount,
      taxAmount,
      feeAmount: 0,
      ...(source.RecommendedSellingRate !== undefined
        ? {
            minimumSellingAmount: money.toMinorUnits(source.RecommendedSellingRate, currency, 'up'),
          }
        : {}),
    },
    cancellationPolicies,
    terms: {
      roomNames,
      ...(source.Inclusion !== undefined ? { inclusion: plainText(source.Inclusion) } : {}),
      amenities: (source.Amenities ?? []).map(plainText).filter(Boolean),
      promotions: (source.RoomPromotion ?? []).flat().map(plainText).filter(Boolean),
      ...(source.WithTransfers !== undefined ? { withTransfers: source.WithTransfers } : {}),
      rateConditions: rateConditions.map(plainText).filter(Boolean),
      supplements: (source.Supplements ?? []).flat().map((supplement) => ({
        ...(supplement.Index !== undefined ? { roomIndex: supplement.Index - 1 } : {}),
        payment: supplement.Type === 'Included' ? ('included' as const) : ('at-property' as const),
        description: plainText(supplement.Description),
        amount: money.toMinorUnits(supplement.Price, supplement.Currency),
        currency: supplement.Currency,
      })),
      ...(extraGuestAmount === undefined ? {} : { extraGuestAmount }),
    },
  };
}
