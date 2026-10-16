import {
  currencySchema,
  type Hotel,
  type HotelSearchRequest,
  type PriceBreakdown,
} from '@hotel/contracts';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DomainError } from '../../common/errors/domain-error';
import type { Environment } from '../../config/environment';
import { DatabaseService } from '../../database/database.service';
import type { SupplierRate } from '../hotels/hotel-supplier';
import { supplierPolicySnapshot } from '../hotels/hotel-supplier';
import { assertMinorAmount, CurrencyService } from './currency.service';
import { MarkupService } from './markup.service';

@Injectable()
export class PricingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService<Environment, true>,
    private readonly currency: CurrencyService,
    private readonly markup: MarkupService,
  ) {}

  calculateBookingTotal(input: SupplierRate['price']): PriceBreakdown {
    this.currency.digits(input.currency);
    const supportedCurrency = currencySchema.safeParse(input.currency);
    if (!supportedCurrency.success) {
      throw new DomainError(
        'UNSUPPORTED_CURRENCY',
        'This currency is not supported for checkout.',
        422,
      );
    }
    [input.baseAmount, input.taxAmount, input.feeAmount].forEach(assertMinorAmount);
    if (input.minimumSellingAmount !== undefined) assertMinorAmount(input.minimumSellingAmount);
    const supplierAmount = input.baseAmount + input.taxAmount + input.feeAmount;
    assertMinorAmount(supplierAmount);
    const markedUpTotal = supplierAmount + this.markup.calculate(input.baseAmount);
    assertMinorAmount(markedUpTotal);
    // A supplier selling floor changes our markup, never the supplier's charges.
    const totalAmount = Math.max(markedUpTotal, input.minimumSellingAmount ?? 0);
    assertMinorAmount(totalAmount);
    const markupAmount = totalAmount - supplierAmount;
    assertMinorAmount(markupAmount);
    return {
      currency: supportedCurrency.data,
      baseAmount: input.baseAmount,
      taxAmount: input.taxAmount,
      feeAmount: input.feeAmount,
      markupAmount,
      discountAmount: 0,
      totalAmount,
    };
  }

  createQuote(input: {
    userId: string;
    supplier: string;
    rateId: string;
    rate: SupplierRate;
    hotel: Hotel;
    criteria: HotelSearchRequest;
    expiresAt?: Date;
  }) {
    const price = this.calculateBookingTotal(input.rate.price);
    return this.db.priceQuote.create({
      data: {
        userId: input.userId,
        supplier: input.supplier,
        supplierRateId: input.rate.supplierRateId,
        hotelId: input.hotel.id,
        hotelName: input.hotel.name,
        roomId: input.rateId,
        roomName: input.rate.roomName,
        checkIn: new Date(`${input.criteria.checkIn}T00:00:00.000Z`),
        checkOut: new Date(`${input.criteria.checkOut}T00:00:00.000Z`),
        occupancy: { nationality: input.criteria.nationality, rooms: input.criteria.rooms },
        ...price,
        pricingSnapshot: {
          version: 1,
          ...price,
          ...(input.rate.price.minimumSellingAmount === undefined
            ? {}
            : { minimumSellingAmount: input.rate.price.minimumSellingAmount }),
          markupBasisPoints: this.config.get('MARKUP_BASIS_POINTS', { infer: true }),
          calculatedAt: new Date().toISOString(),
        },
        policySnapshot: supplierPolicySnapshot(input.rate),
        supplierMetadata: {},
        expiresAt: new Date(
          Math.min(
            Date.now() + this.config.get('QUOTE_TTL_SECONDS', { infer: true }) * 1000,
            input.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY,
          ),
        ),
      },
    });
  }

  async getQuoteForUser(quoteId: string, userId: string) {
    const quote = await this.db.priceQuote.findFirst({ where: { id: quoteId, userId } });
    if (!quote) throw new DomainError('QUOTE_NOT_FOUND', 'The quote could not be found.', 404);
    if (quote.consumedAt || quote.expiresAt.getTime() <= Date.now()) {
      throw new DomainError('QUOTE_EXPIRED', 'Please recheck the room to get a new quote.', 409);
    }
    return quote;
  }
}
