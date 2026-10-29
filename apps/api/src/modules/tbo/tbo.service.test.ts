import type { HotelSearchRequest } from '@hotel/contracts';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../common/errors/domain-error';
import type { Environment } from '../../config/environment';
import { CurrencyService } from '../pricing/currency.service';
import type { TboClient } from './tbo.client';
import { TboService } from './tbo.service';
import type { TboCatalogService } from './tbo-catalog.service';

const criteria: HotelSearchRequest = {
  destination: '12345',
  checkIn: '2100-01-01',
  checkOut: '2100-01-03',
  nationality: 'PK',
  currency: 'USD',
  rooms: [{ adults: 2, childrenAges: [] }],
};

function room(bookingCode = 'rate-100', names = ['Double room']) {
  return { Name: names, BookingCode: bookingCode, TotalFare: '110.00', TotalTax: '10.00' };
}

function hotelResult(code = '100', rooms: readonly unknown[] = [room(`rate-${code}`)]) {
  return { HotelCode: code, Currency: 'USD', Rooms: rooms };
}

function searchResult(hotels: readonly unknown[] = [hotelResult()]) {
  return { Status: { Code: 200 }, HotelResult: hotels };
}

function catalog(codes = ['100']) {
  return codes.map((id) => ({ id, name: `Hotel ${id}`, images: [], facilities: [] }));
}

function preBookRoom(bookingCode = 'rate-100') {
  return {
    ...room(bookingCode),
    IsRefundable: true,
    CancelPolicies: [
      {
        FromDate: '01-01-2100 00:00:00',
        ChargeType: 'Fixed',
        CancellationCharge: '10.00',
      },
    ],
    Supplements: [
      [{ Index: 1, Type: 'AtProperty', Description: 'City fee', Price: '2.00', Currency: 'USD' }],
    ],
  };
}

function setup(settings: Partial<Environment> = {}) {
  const read = vi.fn<TboClient['read']>();
  const getCityHotels = vi.fn<TboCatalogService['getSearchHotels']>().mockResolvedValue(catalog());
  const getHotelDetails = vi.fn<TboCatalogService['getHotelDetails']>();
  const service = new TboService(
    { read } as unknown as TboClient,
    new CurrencyService(),
    { getSearchHotels: getCityHotels, getHotelDetails } as unknown as TboCatalogService,
    new ConfigService<Environment, true>({
      TBO_BASE_URL: 'https://supplier.example.test/HotelAPI/',
      TBO_USERNAME: 'test-account',
      TBO_SEARCH_TIMEOUT_MS: 90000,
      ...settings,
    }),
  );
  return { read, service, getCityHotels, getHotelDetails };
}

describe('TBO read service', () => {
  it('builds the documented Search request from nationality and each room occupancy', async () => {
    const { read, service, getCityHotels } = setup();
    read.mockResolvedValueOnce({ Status: { Code: 201 } });
    const input = {
      ...criteria,
      rooms: [
        { adults: 2, childrenAges: [] },
        { adults: 1, childrenAges: [7] },
      ],
    };

    await expect(service.searchHotels(input)).resolves.toEqual([]);

    expect(getCityHotels).toHaveBeenCalledExactlyOnceWith('12345', undefined, expect.any(Number));
    expect(read).toHaveBeenCalledExactlyOnceWith(
      'Search',
      {
        CheckIn: '2100-01-01',
        CheckOut: '2100-01-03',
        HotelCodes: '100',
        GuestNationality: 'PK',
        PaxRooms: [
          { Adults: 2, Children: 0, ChildrenAges: [] },
          { Adults: 1, Children: 1, ChildrenAges: [7] },
        ],
        ResponseTime: 23,
        IsDetailedResponse: false,
        Filters: { MealType: 'All' },
      },
      expect.any(Number),
    );
  });

  it('batches 100 codes with at most three concurrent reads and retains available batches', async () => {
    const { read, service, getCityHotels } = setup();
    const codes = Array.from({ length: 351 }, (_, index) => String(index + 1));
    getCityHotels.mockResolvedValue(catalog(codes));
    const pending: (() => void)[] = [];
    let active = 0;
    let maximumActive = 0;
    read.mockImplementation(async (_operation, body) => {
      const batch = String(body.HotelCodes).split(',');
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise<void>((resolve) => pending.push(resolve));
      active -= 1;
      return batch[0] === '101' ? { Status: { Code: 201 } } : searchResult([hotelResult(batch[0])]);
    });

    const result = service.searchHotels(criteria);
    await vi.waitFor(() => expect(pending).toHaveLength(3));
    pending.splice(0).forEach((release) => release());
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    pending.splice(0).forEach((release) => release());

    expect((await result).map((entry) => entry.hotel.id)).toEqual(['1', '201', '301']);
    expect(maximumActive).toBe(3);
    expect(
      read.mock.calls
        .filter(([operation]) => operation === 'Search')
        .map(([, body]) => String(body.HotelCodes).split(',').length),
    ).toEqual([100, 100, 100, 51]);
  });

  it('does not issue Search for an empty catalog', async () => {
    const { read, service, getCityHotels } = setup();
    getCityHotels.mockResolvedValue(catalog([]));
    await expect(service.searchHotels(criteria)).resolves.toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });

  it.each(['Dubai', 'Turkey', 'country:TR', 'istanbul'])(
    'resolves the location name %s through the supplier catalogue',
    async (destination) => {
      const { read, service, getCityHotels } = setup();
      read.mockResolvedValueOnce({ Status: { Code: 201 } });
      await expect(service.searchHotels({ ...criteria, destination })).resolves.toEqual([]);
      expect(getCityHotels).toHaveBeenCalledExactlyOnceWith(
        destination,
        undefined,
        expect.any(Number),
      );
    },
  );

  it('rejects invalid occupancy before supplier access', async () => {
    const { read, service } = setup();
    await expect(
      service.searchHotels({ ...criteria, rooms: [{ adults: 0, childrenAges: [] }] }),
    ).rejects.toMatchObject({
      code: 'INVALID_SEARCH',
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects a hotel returned for a different batch even when it belongs to the catalog', async () => {
    const { read, service, getCityHotels } = setup();
    const codes = Array.from({ length: 101 }, (_, index) => String(index + 1));
    getCityHotels.mockResolvedValue(catalog(codes));
    read.mockImplementation(async (_operation, body) => {
      return String(body.HotelCodes).startsWith('1,')
        ? searchResult([hotelResult('101')])
        : { Status: { Code: 201 } };
    });
    await expect(service.searchHotels(criteria)).rejects.toMatchObject({
      code: 'INVALID_SUPPLIER_RESPONSE',
      status: 502,
    });
  });

  it('rejects duplicate catalog identities before availability requests', async () => {
    const { read, service, getCityHotels } = setup();
    getCityHotels.mockResolvedValue(catalog(['100', '100']));
    await expect(service.searchHotels(criteria)).rejects.toMatchObject({
      code: 'INVALID_SUPPLIER_RESPONSE',
    });
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'hotel results', hotels: [hotelResult(), hotelResult()] },
    { label: 'units within one hotel', hotels: [hotelResult('100', [room(), room()])] },
    {
      label: 'units across hotels',
      hotels: [hotelResult('100', [room()]), hotelResult('101', [room()])],
    },
  ])('rejects duplicate $label', async ({ hotels }) => {
    const { read, service, getCityHotels } = setup();
    getCityHotels.mockResolvedValue(catalog(['100', '101']));
    read.mockResolvedValueOnce(searchResult(hotels));
    await expect(service.searchHotels(criteria)).rejects.toMatchObject({
      code: 'INVALID_SUPPLIER_RESPONSE',
    });
  });

  it('rejects a supplier token repeated across separate code batches', async () => {
    const { read, service, getCityHotels } = setup();
    const codes = Array.from({ length: 101 }, (_, index) => String(index + 1));
    getCityHotels.mockResolvedValue(catalog(codes));
    read.mockImplementation(async (_operation, body) => {
      const firstCode = String(body.HotelCodes).split(',')[0];
      return searchResult([hotelResult(firstCode, [room('same-unit')])]);
    });
    await expect(service.searchHotels(criteria)).rejects.toMatchObject({
      code: 'INVALID_SUPPLIER_RESPONSE',
    });
  });

  it('rejects a room combination that does not match requested occupancy', async () => {
    const { read, service } = setup();
    read.mockResolvedValue(
      searchResult([hotelResult('100', [room('rate-100', ['Double', 'Twin'])])]),
    );
    await expect(service.getAvailability('100', criteria)).rejects.toMatchObject({
      code: 'INVALID_SUPPLIER_RESPONSE',
    });
  });

  it('retains a matching multi-room combination as one bookable unit', async () => {
    const { read, service } = setup();
    read.mockResolvedValue(
      searchResult([hotelResult('100', [room('combined-unit', ['Double', 'Twin'])])]),
    );
    const result = await service.getAvailability('100', {
      ...criteria,
      rooms: [
        { adults: 2, childrenAges: [] },
        { adults: 1, childrenAges: [7] },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.supplierRateId).toBe('combined-unit');
  });

  it('reports a supplier currency mismatch instead of hiding inventory or relabeling prices', async () => {
    const { read, service } = setup();
    read.mockResolvedValue(searchResult([{ ...hotelResult(), Currency: 'EUR' }]));
    await expect(service.getAvailability('100', criteria)).rejects.toMatchObject({
      code: 'SUPPLIER_CURRENCY_MISMATCH',
      status: 422,
    });
  });

  it.each([
    { label: 'success without inventory field', payload: { Status: { Code: 200 } } },
    {
      label: 'no availability with inventory',
      payload: { Status: { Code: 201 }, HotelResult: [hotelResult()] },
    },
    {
      label: 'missing required price',
      payload: {
        Status: { Code: 200 },
        HotelResult: [
          {
            ...hotelResult(),
            Rooms: [{ Name: ['Double'], BookingCode: 'rate-100', TotalFare: '110' }],
          },
        ],
      },
    },
  ])('rejects $label', async ({ payload }) => {
    const { read, service } = setup();
    read.mockResolvedValue(payload);
    await expect(service.getAvailability('100', criteria)).rejects.toMatchObject({
      code: 'INVALID_SUPPLIER_RESPONSE',
    });
  });

  it('delegates hotel content to the persistent catalogue cache', async () => {
    const { read, service, getHotelDetails } = setup();
    getHotelDetails.mockResolvedValue({ id: '100', name: 'Hotel 100', images: [], facilities: [] });
    await expect(service.getHotelDetails('100')).resolves.toMatchObject({
      id: '100',
      name: 'Hotel 100',
    });
    expect(getHotelDetails).toHaveBeenCalledExactlyOnceWith('100');
    expect(read).not.toHaveBeenCalled();
  });

  it('preserves the catalogue unavailable error without fabricating content', async () => {
    const { service, getHotelDetails } = setup();
    getHotelDetails.mockRejectedValue(new DomainError('HOTEL_NOT_AVAILABLE', 'Unavailable', 404));
    await expect(service.getHotelDetails('100')).rejects.toMatchObject({
      code: 'HOTEL_NOT_AVAILABLE',
      status: 404,
    });
  });

  it('searches only the selected hotel after verifying destination membership', async () => {
    const { read, service, getCityHotels } = setup();
    getCityHotels.mockResolvedValue(catalog(['100', '101']));
    read.mockResolvedValue(searchResult([hotelResult('101')]));
    const results = await service.searchHotels({ ...criteria, hotelId: '101' });
    expect(results.map((entry) => entry.hotel.id)).toEqual(['101']);
    expect(read).toHaveBeenCalledExactlyOnceWith(
      'Search',
      expect.objectContaining({ HotelCodes: '101' }),
      expect.any(Number),
    );
  });

  it('rejects a selected hotel outside the destination without requesting availability', async () => {
    const { read, service } = setup();
    await expect(service.searchHotels({ ...criteria, hotelId: '999' })).rejects.toMatchObject({
      code: 'HOTEL_NOT_AVAILABLE',
      status: 404,
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('separates inventory cache scopes by supplier endpoint and account without exposing them', () => {
    const scope = setup().service.cacheScope;
    expect(scope).toMatch(/^[a-f0-9]{64}$/);
    expect(scope).toBe(setup().service.cacheScope);
    expect(scope).not.toBe(setup({ TBO_USERNAME: 'other-account' }).service.cacheScope);
    expect(scope).not.toBe(
      setup({ TBO_BASE_URL: 'https://live.example.test/HotelAPI/' }).service.cacheScope,
    );
  });

  it('validates hotel codes before requesting details or availability', async () => {
    const { read, service } = setup();
    await expect(service.getHotelDetails('100,101')).rejects.toMatchObject({
      code: 'INVALID_HOTEL_ID',
    });
    await expect(service.getAvailability('../Search', criteria)).rejects.toMatchObject({
      code: 'INVALID_HOTEL_ID',
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('rechecks the selected token and retains its final policies and terms', async () => {
    const { read, service } = setup();
    read.mockResolvedValue(
      searchResult([
        {
          ...hotelResult('100', [preBookRoom()]),
          RateConditions: ['Government ID required at check-in'],
        },
      ]),
    );

    const result = await service.recheckPrice('rate-100');

    expect(read).toHaveBeenCalledExactlyOnceWith('PreBook', {
      BookingCode: 'rate-100',
      PaymentMode: 'Limit',
    });
    expect(result.supplierRateId).toBe('rate-100');
    expect(result.cancellationPolicies).toHaveLength(1);
    expect(result.terms?.rateConditions).toEqual(['Government ID required at check-in']);
    expect(result.terms?.supplements).toMatchObject([
      { payment: 'at-property', description: 'City fee' },
    ]);
  });

  it('rejects a different token even if PreBook returns only one unit', async () => {
    const { read, service } = setup();
    read.mockResolvedValue(searchResult([hotelResult('100', [preBookRoom('other-unit')])]));
    await expect(service.recheckPrice('rate-100')).rejects.toMatchObject({
      code: 'HOTEL_RATE_CHANGED',
      status: 409,
    });
  });

  it('rejects ambiguous PreBook units instead of selecting one', async () => {
    const { read, service } = setup();
    read.mockResolvedValue(
      searchResult([hotelResult('100', [preBookRoom(), preBookRoom('second-unit')])]),
    );
    await expect(service.recheckPrice('rate-100')).rejects.toMatchObject({
      code: 'HOTEL_NOT_AVAILABLE',
      status: 409,
    });
  });

  it.each([
    { label: 'missing result', payload: { Status: { Code: 200 } } },
    { label: 'missing refundability and policies', payload: searchResult() },
    {
      label: 'refundable unit without policies',
      payload: searchResult([hotelResult('100', [{ ...preBookRoom(), CancelPolicies: [] }])]),
    },
  ])('rejects a successful PreBook with $label', async ({ payload }) => {
    const { read, service } = setup();
    read.mockResolvedValue(payload);
    await expect(service.recheckPrice('rate-100')).rejects.toMatchObject({
      code: 'INVALID_SUPPLIER_RESPONSE',
    });
  });

  it.each(['', 'x'.repeat(4097)])('rejects an invalid token before PreBook', async (token) => {
    const { read, service } = setup();
    await expect(service.recheckPrice(token)).rejects.toMatchObject({ code: 'RATE_EXPIRED' });
    expect(read).not.toHaveBeenCalled();
  });
});
