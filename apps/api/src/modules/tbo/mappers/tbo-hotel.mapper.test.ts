import { describe, expect, it } from 'vitest';

import { CurrencyService } from '../../pricing/currency.service';
import { tboRoomSchema } from '../dto/tbo.schemas';
import { mapHotelDetails, mapHotelRate } from './tbo-hotel.mapper';

describe('TBO boundary mapping', () => {
  it('normalizes tax-inclusive totals and strips unknown supplier fields', () => {
    const dto = tboRoomSchema.parse({
      Name: ['Double room'],
      BookingCode: 'supplier-private-rate',
      TotalFare: '110.00',
      TotalTax: '10.00',
      IsRefundable: true,
      MealType: 'Breakfast',
      PrivateField: 'not-domain-data',
    });
    const rate = mapHotelRate(dto, '123', 'USD', new CurrencyService());
    expect(rate.price).toEqual({
      currency: 'USD',
      baseAmount: 10000,
      taxAmount: 1000,
      feeAmount: 0,
    });
    expect(rate.roomName).toBe('Double room');
    expect(rate).not.toHaveProperty('PrivateField');
    expect(rate).not.toHaveProperty('BookingCode');
  });

  it('rejects contradictory supplier tax totals', () => {
    expect(() =>
      mapHotelRate(
        { Name: ['Room'], BookingCode: 'rate', TotalFare: 10, TotalTax: 11 },
        '123',
        'USD',
        new CurrencyService(),
      ),
    ).toThrow('inconsistent pricing');
  });

  it('removes HTML descriptions and unsafe image protocols', () => {
    expect(
      mapHotelDetails({
        HotelCode: '123',
        HotelName: 'Supplier name',
        Description: '<p>Description</p>',
        Images: ['https://example.com/hotel.jpg', 'javascript:alert(1)'],
        HotelFacilities: ['Pool'],
      }),
    ).toEqual({
      id: '123',
      name: 'Supplier name',
      description: 'Description',
      images: ['https://example.com/hotel.jpg'],
      facilities: ['Pool'],
    });
  });
});
