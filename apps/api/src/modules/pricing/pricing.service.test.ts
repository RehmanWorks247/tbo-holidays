import type { HotelSearchRequest } from '@hotel/contracts';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import type { Environment } from '../../config/environment';
import type { DatabaseService } from '../../database/database.service';
import type { SupplierRate } from '../hotels/hotel-supplier';
import { CurrencyService, MAX_AMOUNT } from './currency.service';
import { MarkupService } from './markup.service';
import { PricingService } from './pricing.service';

const config = new ConfigService<Environment, true>({ MARKUP_BASIS_POINTS: 1250 });
const currency = new CurrencyService();
const pricing = new PricingService(
  {} as DatabaseService,
  config,
  currency,
  new MarkupService(config),
);

describe('authoritative pricing', () => {
  it('adds fees and taxes once, with markup on base only', () => {
    expect(
      pricing.calculateBookingTotal({
        currency: 'USD',
        baseAmount: 10001,
        taxAmount: 1999,
        feeAmount: 500,
      }),
    ).toEqual({
      currency: 'USD',
      baseAmount: 10001,
      taxAmount: 1999,
      feeAmount: 500,
      markupAmount: 1250,
      discountAmount: 0,
      totalAmount: 13750,
    });
  });

  it('rounds supplier decimals and markup using integer half-up arithmetic', () => {
    expect(currency.toMinorUnits('1.005', 'USD')).toBe(101);
    expect(currency.toMinorUnits('12.3455', 'KWD')).toBe(12346);
    expect(currency.toMinorUnits('100.5', 'JPY')).toBe(101);
    expect(
      new MarkupService(
        new ConfigService<Environment, true>({ MARKUP_BASIS_POINTS: 5000 }),
      ).calculate(1),
    ).toBe(1);
  });

  it.each([
    { minimumSellingAmount: 13000, totalAmount: 13750, markupAmount: 1250 },
    { minimumSellingAmount: 13750, totalAmount: 13750, markupAmount: 1250 },
    { minimumSellingAmount: 15000, totalAmount: 15000, markupAmount: 2500 },
  ])('honors a selling floor of $minimumSellingAmount through markup only', (expected) => {
    const price = pricing.calculateBookingTotal({
      currency: 'USD',
      baseAmount: 10001,
      taxAmount: 1999,
      feeAmount: 500,
      minimumSellingAmount: expected.minimumSellingAmount,
    });
    expect(price).toEqual({
      currency: 'USD',
      baseAmount: 10001,
      taxAmount: 1999,
      feeAmount: 500,
      markupAmount: expected.markupAmount,
      discountAmount: 0,
      totalAmount: expected.totalAmount,
    });
    expect(price).not.toHaveProperty('minimumSellingAmount');
  });

  it.each([-1, 0.1, Number.NaN, Number.POSITIVE_INFINITY, MAX_AMOUNT + 1])(
    'rejects invalid selling floors before calculating a quote: %s',
    (minimumSellingAmount) => {
      expect(() =>
        pricing.calculateBookingTotal({
          currency: 'USD',
          baseAmount: 10000,
          taxAmount: 1000,
          feeAmount: 0,
          minimumSellingAmount,
        }),
      ).toThrow();
    },
  );

  it('checks total overflow even when the supplier floor itself is valid', () => {
    expect(() =>
      pricing.calculateBookingTotal({
        currency: 'USD',
        baseAmount: MAX_AMOUNT,
        taxAmount: 0,
        feeAmount: 0,
        minimumSellingAmount: MAX_AMOUNT,
      }),
    ).toThrow();
  });

  it('rejects unsafe, fractional, negative and unsupported checkout amounts', () => {
    for (const amount of [-1, 0.1, Number.NaN, MAX_AMOUNT + 1]) {
      expect(() =>
        pricing.calculateBookingTotal({
          currency: 'USD',
          baseAmount: amount,
          taxAmount: 0,
          feeAmount: 0,
        }),
      ).toThrow();
    }
    expect(() => currency.toMinorUnits('1e6', 'USD')).toThrow();
    expect(() =>
      pricing.calculateBookingTotal({ currency: 'ZZZ', baseAmount: 1, taxAmount: 0, feeAmount: 0 }),
    ).toThrow();
    expect(() =>
      pricing.calculateBookingTotal({
        currency: 'USD',
        baseAmount: MAX_AMOUNT,
        taxAmount: 1,
        feeAmount: 0,
      }),
    ).toThrow();
  });
});

describe('owned quote snapshots', () => {
  const criteria: HotelSearchRequest = {
    destination: '100',
    checkIn: '2100-01-01',
    checkOut: '2100-01-03',
    nationality: 'PK',
    currency: 'USD',
    rooms: [
      { adults: 2, childrenAges: [] },
      { adults: 1, childrenAges: [8] },
    ],
  };
  const rate: SupplierRate = {
    hotelId: 'hotel-1',
    supplierRateId: 'private-supplier-rate',
    roomName: 'Double | Family',
    mealType: 'Breakfast_For_2',
    refundable: true,
    price: { currency: 'USD', baseAmount: 10000, taxAmount: 1000, feeAmount: 0 },
    cancellationPolicies: [
      {
        roomIndex: 0,
        from: '2099-12-31T18:00:00',
        timeBasis: 'property-local',
        chargeType: 'fixed',
        amount: 1000,
        currency: 'USD',
      },
      {
        roomIndex: 1,
        from: '2100-01-01T12:00:00',
        timeBasis: 'property-local',
        chargeType: 'percentage',
        percentageBasisPoints: 10000,
      },
    ],
    terms: {
      roomNames: ['Double', 'Family'],
      inclusion: 'Breakfast',
      amenities: ['Wi-Fi'],
      promotions: ['Advance purchase'],
      withTransfers: false,
      rateConditions: ['Present a matching photo ID.'],
      supplements: [
        {
          roomIndex: 1,
          payment: 'at-property',
          description: 'City tax',
          amount: 400,
          currency: 'EUR',
        },
      ],
      extraGuestAmount: 500,
    },
  };

  it.each([undefined, 0, 15000])(
    'preserves accepted policies and terms and privately snapshots the floor %s',
    (minimumSellingAmount) => {
      const create = vi.fn<(input: Prisma.PriceQuoteCreateArgs) => void>();
      const database = { priceQuote: { create } } as unknown as DatabaseService;
      const quoteConfig = new ConfigService<Environment, true>({
        MARKUP_BASIS_POINTS: 1250,
        QUOTE_TTL_SECONDS: 300,
      });
      const service = new PricingService(
        database,
        quoteConfig,
        currency,
        new MarkupService(quoteConfig),
      );
      service.createQuote({
        userId: 'authenticated-user',
        supplier: 'TBO',
        rateId: 'opaque-public-rate',
        rate: {
          ...rate,
          price: {
            ...rate.price,
            ...(minimumSellingAmount === undefined ? {} : { minimumSellingAmount }),
          },
        },
        hotel: { id: rate.hotelId, name: 'Fixture hotel', images: [], facilities: [] },
        criteria,
      });

      const data = create.mock.calls[0]?.[0].data;
      expect(data).toMatchObject({
        userId: 'authenticated-user',
        supplierRateId: 'private-supplier-rate',
        roomId: 'opaque-public-rate',
        occupancy: { nationality: criteria.nationality, rooms: criteria.rooms },
        policySnapshot: {
          refundable: rate.refundable,
          mealType: rate.mealType,
          cancellationPolicies: rate.cancellationPolicies,
          terms: rate.terms,
        },
        pricingSnapshot: {
          version: 1,
          markupBasisPoints: 1250,
          totalAmount: minimumSellingAmount === 15000 ? 15000 : 12250,
        },
      });
      expect(data).not.toHaveProperty('minimumSellingAmount');
      if (minimumSellingAmount === undefined) {
        expect(data?.pricingSnapshot).not.toHaveProperty('minimumSellingAmount');
      } else {
        expect(data?.pricingSnapshot).toHaveProperty('minimumSellingAmount', minimumSellingAmount);
      }
    },
  );

  it.each([60, 600])('caps quote validity at the source rate expiry (%s seconds)', (seconds) => {
    const create = vi.fn<(input: Prisma.PriceQuoteCreateArgs) => void>();
    const database = { priceQuote: { create } } as unknown as DatabaseService;
    const quoteConfig = new ConfigService<Environment, true>({
      MARKUP_BASIS_POINTS: 1250,
      QUOTE_TTL_SECONDS: 300,
    });
    const service = new PricingService(
      database,
      quoteConfig,
      currency,
      new MarkupService(quoteConfig),
    );
    const now = Date.parse('2099-12-01T00:00:00Z');
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      service.createQuote({
        userId: 'authenticated-user',
        supplier: 'TBO',
        rateId: 'opaque-public-rate',
        rate,
        hotel: { id: rate.hotelId, name: 'Fixture hotel', images: [], facilities: [] },
        criteria,
        expiresAt: new Date(now + seconds * 1000),
      });
      expect(create.mock.calls[0]?.[0].data.expiresAt).toEqual(
        new Date(now + Math.min(seconds, 300) * 1000),
      );
    } finally {
      clock.mockRestore();
    }
  });
});
