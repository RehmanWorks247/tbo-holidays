import { describe, expect, it } from 'vitest';

import { CurrencyService } from '../../pricing/currency.service';
import { tboCatalogResponseSchema, tboRoomSchema } from '../dto/tbo.schemas';
import { mapCatalogHotel, mapHotelDetails, mapHotelRate } from './tbo-hotel.mapper';

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

  it('rejects an included extra-guest component larger than the aggregate fare', () => {
    expect(() =>
      mapHotelRate(
        {
          Name: ['Room'],
          BookingCode: 'synthetic-rate',
          TotalFare: '110.00',
          TotalTax: '10.00',
          ExtraGuestCharges: '120.00',
        },
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

  it('preserves combination terms, indexed hotel-local policies and each supplement currency', () => {
    const dto = tboRoomSchema.parse({
      Name: ['<b>Double</b>', 'Twin'],
      BookingCode: 'synthetic-combination',
      RoomID: ['1001', 0],
      TotalFare: '220.00',
      TotalTax: '20.00',
      ExtraGuestCharges: '5.50',
      RecommendedSellingRate: '240.001',
      Inclusion: 'Breakfast &amp; WiFi',
      Amenities: ['<b>Pool</b>'],
      RoomPromotion: [['Early booking'], ['Family offer']],
      WithTransfers: false,
      IsRefundable: true,
      CancelPolicies: [
        { FromDate: '29-02-2104 14:30:00', ChargeType: 'Fixed', CancellationCharge: '10.50' },
        {
          Index: '2',
          FromDate: '01-03-2104 12:00:00',
          ChargeType: 'Percentage',
          CancellationCharge: '12.50',
        },
      ],
      Supplements: [
        [
          {
            Index: 1,
            Type: 'Included',
            Description: 'Included breakfast',
            Price: '7.00',
            Currency: 'USD',
          },
        ],
        [
          {
            Index: 2,
            Type: 'AtProperty',
            Description: '<p>Local tax</p>',
            Price: '1.234',
            Currency: 'KWD',
          },
        ],
        { Type: 'AtProperty', Description: 'Combination levy', Price: '200', Currency: 'JPY' },
      ],
    });
    const rate = mapHotelRate(dto, '100', 'USD', new CurrencyService(), ['<b>No name changes</b>']);
    expect(rate.roomName).toBe('Double + Twin');
    expect(rate.price).toEqual({
      currency: 'USD',
      baseAmount: 20000,
      taxAmount: 2000,
      feeAmount: 0,
      minimumSellingAmount: 24001,
    });
    expect(rate.cancellationPolicies).toEqual([
      {
        from: '2104-02-29T14:30:00',
        timeBasis: 'property-local',
        chargeType: 'fixed',
        amount: 1050,
        currency: 'USD',
      },
      {
        from: '2104-03-01T12:00:00',
        timeBasis: 'property-local',
        roomIndex: 1,
        chargeType: 'percentage',
        percentageBasisPoints: 1250,
      },
    ]);
    expect(rate.terms).toEqual({
      roomNames: ['Double', 'Twin'],
      inclusion: 'Breakfast & WiFi',
      amenities: ['Pool'],
      promotions: ['Early booking', 'Family offer'],
      withTransfers: false,
      rateConditions: ['No name changes'],
      extraGuestAmount: 550,
      supplements: [
        {
          roomIndex: 0,
          payment: 'included',
          description: 'Included breakfast',
          amount: 700,
          currency: 'USD',
        },
        {
          roomIndex: 1,
          payment: 'at-property',
          description: 'Local tax',
          amount: 1234,
          currency: 'KWD',
        },
        { payment: 'at-property', description: 'Combination levy', amount: 200, currency: 'JPY' },
      ],
    });
    expect(rate).not.toHaveProperty('RoomID');
    expect(rate.cancellationPolicies[0]).not.toHaveProperty('roomIndex');
    expect(rate.terms?.supplements[2]).not.toHaveProperty('roomIndex');
  });

  it('defaults optional terms conservatively and does not invent cancellation policies', () => {
    const rate = mapHotelRate(
      { Name: ['Room'], BookingCode: 'synthetic-rate', TotalFare: 10, TotalTax: 0 },
      '100',
      'USD',
      new CurrencyService(),
    );
    expect(rate.refundable).toBe(false);
    expect(rate.cancellationPolicies).toEqual([]);
    expect(rate.terms).toEqual({
      roomNames: ['Room'],
      amenities: [],
      promotions: [],
      rateConditions: [],
      supplements: [],
    });
  });

  it('rejects unsupported supplement currency instead of losing a mandatory charge', () => {
    const dto = tboRoomSchema.parse({
      Name: ['Room'],
      BookingCode: 'synthetic-rate',
      TotalFare: 10,
      TotalTax: 0,
      Supplements: [{ Type: 'AtProperty', Description: 'Local tax', Price: 1, Currency: 'ZZZ' }],
    });
    expect(() => mapHotelRate(dto, '100', 'USD', new CurrencyService())).toThrow(
      'currency is not supported',
    );
  });

  it('rejects monetary overflow when converting to minor units', () => {
    expect(() =>
      mapHotelRate(
        { Name: ['Room'], BookingCode: 'synthetic-rate', TotalFare: '2000000000', TotalTax: 0 },
        '100',
        'USD',
        new CurrencyService(),
      ),
    ).toThrow('outside the supported range');
  });

  it('cleans all hotel content and maps catalog ratings, images and facilities', () => {
    const dto = tboCatalogResponseSchema.parse({
      Status: { Code: 200 },
      Hotels: [
        {
          HotelCode: 100,
          HotelName: '<b>Example &amp; Hotel</b>',
          HotelRating: 'FourStar',
          Description: '&lt;script&gt;doNotDisplay()&lt;/script&gt;<p>Comfort &amp; calm</p>',
          Address: '<p>Street 1</p>',
          CityName: '<b>City</b>',
          CountryCode: 'AE',
          HotelFacilities: ['<b>Pool</b>', '<script>hidden()</script>'],
          Images: [
            'https://example.com/hotel.jpg',
            'http://example.com/insecure.jpg',
            'https://user:password@example.com/private.jpg',
            'javascript:alert(1)',
            'not a url',
          ],
        },
      ],
    }).Hotels[0];
    if (!dto) throw new Error('Synthetic fixture missing.');
    expect(mapCatalogHotel(dto)).toEqual({
      id: '100',
      name: 'Example & Hotel',
      description: 'Comfort & calm',
      address: 'Street 1',
      city: 'City',
      countryCode: 'AE',
      starRating: 4,
      images: ['https://example.com/hotel.jpg'],
      facilities: ['Pool'],
    });
    expect(
      mapHotelDetails({ HotelCode: '100', HotelName: 'Hotel', HotelRating: 0 }).starRating,
    ).toBe(0);
  });

  it('rejects names that become empty after supplier markup is removed', () => {
    expect(() =>
      mapHotelRate(
        {
          Name: ['<script>hidden()</script>'],
          BookingCode: 'synthetic-rate',
          TotalFare: 10,
          TotalTax: 0,
        },
        '100',
        'USD',
        new CurrencyService(),
      ),
    ).toThrow('invalid hotel data');
  });
});
