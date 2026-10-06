import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import type { Environment } from '../../config/environment';
import type { DatabaseService } from '../../database/database.service';
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
