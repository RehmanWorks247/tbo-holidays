import type { HotelSearchRequest } from '@hotel/contracts';
import { describe, expect, it, vi } from 'vitest';

import { CurrencyService } from '../pricing/currency.service';
import type { TboClient } from './tbo.client';
import { TboService } from './tbo.service';

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
  return {
    Status: { Code: 200 },
    Hotels: codes.map((code) => ({ HotelCode: code, HotelName: `Hotel ${code}` })),
  };
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

function setup() {
  const read = vi.fn<TboClient['read']>();
  const service = new TboService({ read } as unknown as TboClient, new CurrencyService());
  return { read, service };
}

describe('TBO read service', () => {
  it('builds the documented Search request from nationality and each room occupancy', async () => {
    const { read, service } = setup();
    read.mockResolvedValueOnce(catalog()).mockResolvedValueOnce({ Status: { Code: 201 } });
    const input = {
      ...criteria,
      rooms: [
        { adults: 2, childrenAges: [] },
        { adults: 1, childrenAges: [7] },
      ],
    };

    await expect(service.searchHotels(input)).resolves.toEqual([]);

    expect(read).toHaveBeenNthCalledWith(1, 'TBOHotelCodeList', {
      CityCode: '12345',
      IsDetailedResponse: true,
    });
    expect(read).toHaveBeenNthCalledWith(2, 'Search', {
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
    });
  });

  it('batches 100 codes with at most three concurrent reads and retains available batches', async () => {
    const { read, service } = setup();
    const codes = Array.from({ length: 351 }, (_, index) => String(index + 1));
    const pending: (() => void)[] = [];
    let active = 0;
    let maximumActive = 0;
    read.mockImplementation(async (operation, body) => {
      if (operation === 'TBOHotelCodeList') return catalog(codes);
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
    const { read, service } = setup();
    read.mockResolvedValue(catalog([]));
    await expect(service.searchHotels(criteria)).resolves.toEqual([]);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it.each(['Dubai', '1,2', '1.2', '-1', '100/Book'])(
    'rejects non-numeric city code %s before supplier access',
    async (destination) => {
      const { read, service } = setup();
      await expect(service.searchHotels({ ...criteria, destination })).rejects.toMatchObject({
        code: 'INVALID_DESTINATION',
        status: 400,
      });
      expect(read).not.toHaveBeenCalled();
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
    const { read, service } = setup();
    const codes = Array.from({ length: 101 }, (_, index) => String(index + 1));
    read.mockImplementation(async (operation, body) => {
      if (operation === 'TBOHotelCodeList') return catalog(codes);
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
    const { read, service } = setup();
    read.mockResolvedValue(catalog(['100', '100']));
    await expect(service.searchHotels(criteria)).rejects.toMatchObject({
      code: 'INVALID_SUPPLIER_RESPONSE',
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it.each([
    { label: 'hotel results', hotels: [hotelResult(), hotelResult()] },
    { label: 'units within one hotel', hotels: [hotelResult('100', [room(), room()])] },
    {
      label: 'units across hotels',
      hotels: [hotelResult('100', [room()]), hotelResult('101', [room()])],
    },
  ])('rejects duplicate $label', async ({ hotels }) => {
    const { read, service } = setup();
    read.mockResolvedValueOnce(catalog(['100', '101'])).mockResolvedValueOnce(searchResult(hotels));
    await expect(service.searchHotels(criteria)).rejects.toMatchObject({
      code: 'INVALID_SUPPLIER_RESPONSE',
    });
  });

  it('rejects a supplier token repeated across separate code batches', async () => {
    const { read, service } = setup();
    const codes = Array.from({ length: 101 }, (_, index) => String(index + 1));
    read.mockImplementation(async (operation, body) => {
      if (operation === 'TBOHotelCodeList') return catalog(codes);
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

  it('requests a single hotel using exact documented casing without optional room content', async () => {
    const { read, service } = setup();
    read.mockResolvedValue({
      Status: { Code: 200 },
      HotelDetails: [{ HotelCode: '100', HotelName: 'Hotel 100' }],
    });
    await expect(service.getHotelDetails('100')).resolves.toMatchObject({
      id: '100',
      name: 'Hotel 100',
    });
    expect(read).toHaveBeenCalledExactlyOnceWith('HotelDetails', {
      Hotelcodes: '100',
      Language: 'EN',
    });
  });

  it('returns not available for an explicitly empty hotel-details result', async () => {
    const { read, service } = setup();
    read.mockResolvedValue({ Status: { Code: 200 }, HotelDetails: [] });
    await expect(service.getHotelDetails('100')).rejects.toMatchObject({
      code: 'HOTEL_NOT_AVAILABLE',
      status: 404,
    });
  });

  it.each([
    { label: 'wrong hotel', details: [{ HotelCode: '101', HotelName: 'Other' }] },
    {
      label: 'multiple hotels',
      details: [
        { HotelCode: '100', HotelName: 'Hotel 100' },
        { HotelCode: '101', HotelName: 'Other' },
      ],
    },
    { label: 'missing name', details: [{ HotelCode: '100' }] },
  ])('rejects hotel details with $label', async ({ details }) => {
    const { read, service } = setup();
    read.mockResolvedValue({ Status: { Code: 200 }, HotelDetails: details });
    await expect(service.getHotelDetails('100')).rejects.toMatchObject({
      code: 'INVALID_SUPPLIER_RESPONSE',
    });
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
