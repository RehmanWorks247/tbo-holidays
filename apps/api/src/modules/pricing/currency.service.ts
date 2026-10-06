import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error';

const CURRENCY_DIGITS: Readonly<Record<string, number>> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  AED: 2,
  PKR: 2,
  INR: 2,
  SAR: 2,
  AUD: 2,
  CAD: 2,
  SGD: 2,
  QAR: 2,
  JPY: 0,
  KWD: 3,
  BHD: 3,
  OMR: 3,
};

/** Aligned with PostgreSQL Int columns; prevents overflows before persistence. */
export const MAX_AMOUNT = 2_000_000_000;

export function assertMinorAmount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_AMOUNT) {
    throw new DomainError('INVALID_MONEY', 'The amount is outside the supported range.', 422);
  }
}

@Injectable()
export class CurrencyService {
  /** No implicit conversion. An FX integration must supply a separately stored rate. */
  digits(currency: string): number {
    const digits = CURRENCY_DIGITS[currency];
    if (digits === undefined) {
      throw new DomainError('UNSUPPORTED_CURRENCY', 'The currency is not supported.', 422);
    }
    return digits;
  }

  toMinorUnits(value: string | number, currency: string): number {
    const digits = this.digits(currency);
    const match = /^(\d+)(?:\.(\d+))?$/.exec(String(value));
    if (!match?.[1]) {
      throw new DomainError('INVALID_MONEY', 'The supplier returned an invalid amount.', 502);
    }
    const fraction = match[2] ?? '';
    const factor = 10n ** BigInt(digits);
    const rounded =
      BigInt(match[1]) * factor +
      BigInt(fraction.padEnd(digits, '0').slice(0, digits) || '0') +
      (Number(fraction[digits] ?? '0') >= 5 ? 1n : 0n);
    const amount = Number(rounded);
    assertMinorAmount(amount);
    return amount;
  }
}
