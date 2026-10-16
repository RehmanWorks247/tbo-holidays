import { isDeepStrictEqual } from 'node:util';

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DomainError } from '../../common/errors/domain-error';
import { DatabaseService } from '../../database/database.service';
import type { HotelSupplier, SupplierBookingResult, SupplierRate } from '../hotels/hotel-supplier';
import { HOTEL_SUPPLIER, supplierPolicySnapshot } from '../hotels/hotel-supplier';
import { assertMinorAmount } from '../pricing/currency.service';
import { customerSnapshotSchema, occupancySnapshotSchema } from './booking-snapshots';
import { canFulfillBooking } from './booking-state';

@Injectable()
export class BookingFulfillmentService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(HOTEL_SUPPLIER) private readonly supplier: HotelSupplier,
  ) {}

  async fulfill(bookingId: string): Promise<void> {
    const booking = await this.database.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { quote: true, guests: true },
    });
    if (!canFulfillBooking(booking.bookingStatus, booking.paymentStatus)) return;
    if (booking.supplier !== this.supplier.name)
      throw new DomainError('SUPPLIER_MISMATCH', 'The booking supplier is not configured.', 503);
    const occupancy = occupancySnapshotSchema.parse(booking.occupancySnapshot);
    const contact = customerSnapshotSchema.parse(booking.customerSnapshot);

    const claimed = await this.database.$transaction(async (tx) => {
      const result = await tx.booking.updateMany({
        where: {
          id: bookingId,
          version: booking.version,
          bookingStatus: 'BOOKING_PENDING',
          paymentStatus: 'PAYMENT_SUCCEEDED',
        },
        data: { bookingStatus: 'BOOKING_PROCESSING', version: { increment: 1 } },
      });
      if (result.count !== 1) return false;
      await tx.outboxEvent.create({
        data: {
          kind: 'BOOKING_STATUS_CHECK',
          aggregateId: bookingId,
          dedupeKey: `booking-status:${bookingId}`,
          availableAt: new Date(Date.now() + 15 * 60_000),
        },
      });
      return true;
    });
    if (!claimed) return;

    if (booking.quote.expiresAt <= new Date()) {
      await this.failAndRequestRefund(bookingId, 'QUOTE_EXPIRED_BEFORE_FULFILLMENT');
      return;
    }
    let rechecked: SupplierRate;
    try {
      rechecked = await this.supplier.recheckPrice(booking.quote.supplierRateId);
      if (rechecked.price.minimumSellingAmount !== undefined) {
        assertMinorAmount(rechecked.price.minimumSellingAmount);
      }
      if (
        rechecked.hotelId !== booking.hotelCode ||
        rechecked.roomName !== booking.quote.roomName ||
        rechecked.price.currency !== booking.currency ||
        rechecked.price.baseAmount !== booking.baseAmount ||
        rechecked.price.taxAmount !== booking.taxAmount ||
        rechecked.price.feeAmount !== booking.feeAmount ||
        (rechecked.price.minimumSellingAmount ?? 0) > booking.totalAmount ||
        !isDeepStrictEqual(booking.policySnapshot, supplierPolicySnapshot(rechecked))
      ) {
        await this.failAndRequestRefund(bookingId, 'HOTEL_RATE_CHANGED');
        return;
      }
    } catch {
      // No supplier mutation has been sent, so this outcome is known and can
      // safely enter the refund path rather than charge a changed/unavailable rate.
      await this.failAndRequestRefund(bookingId, 'SUPPLIER_RECHECK_UNAVAILABLE');
      return;
    }
    if (booking.quote.expiresAt <= new Date()) {
      await this.failAndRequestRefund(bookingId, 'QUOTE_EXPIRED_BEFORE_FULFILLMENT');
      return;
    }
    // Persist the dispatch boundary before the mutation. The initial status
    // check waits long enough for the bounded recheck; this shorter grace starts
    // only once dispatch begins and exceeds the client's maximum mutation timeout.
    const dispatchAllowed = await this.database.$transaction(async (tx) => {
      const stamped = await tx.booking.updateMany({
        where: {
          id: bookingId,
          bookingStatus: 'BOOKING_PROCESSING',
          paymentStatus: 'PAYMENT_SUCCEEDED',
          supplierAttemptedAt: null,
          quote: { expiresAt: { gt: new Date() } },
        },
        data: { supplierAttemptedAt: new Date(), version: { increment: 1 } },
      });
      if (stamped.count !== 1) return false;
      await tx.outboxEvent.update({
        where: { dedupeKey: `booking-status:${bookingId}` },
        data: { availableAt: new Date(Date.now() + 5 * 60_000) },
      });
      return true;
    });
    if (!dispatchAllowed) return;
    try {
      // This is the only mutation attempt. A crash, timeout, or pending outcome
      // is resolved through getBooking(clientReference), never another create.
      const result = await this.supplier.createBooking({
        clientReference: booking.id,
        supplierRateId: rechecked.supplierRateId,
        hotelId: booking.hotelCode,
        checkIn: booking.checkIn.toISOString().slice(0, 10),
        checkOut: booking.checkOut.toISOString().slice(0, 10),
        nationality: occupancy.nationality,
        rooms: occupancy.rooms,
        contact,
        guests: booking.guests.map((guest) => ({
          firstName: guest.firstName,
          lastName: guest.lastName,
          type: guest.type,
          roomIndex: guest.roomIndex,
          ...(guest.age === null ? {} : { age: guest.age }),
        })),
        expectedPrice: {
          currency: booking.currency,
          baseAmount: booking.baseAmount,
          taxAmount: booking.taxAmount,
          feeAmount: booking.feeAmount,
        },
      });
      await this.applySupplierResult(bookingId, result);
    } catch (error) {
      if (error instanceof DomainError && error.code === 'SUPPLIER_INTEGRATION_REQUIRED') {
        await this.failAndRequestRefund(bookingId, error.code);
        return;
      }
      await this.database.booking.updateMany({
        where: { id: bookingId, bookingStatus: 'BOOKING_PROCESSING' },
        data: {
          bookingStatus: 'RECONCILIATION_REQUIRED',
          failureCode: 'SUPPLIER_OUTCOME_UNKNOWN',
          version: { increment: 1 },
        },
      });
    }
  }

  async reconcile(bookingId: string): Promise<void> {
    const booking = await this.database.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (!['BOOKING_PROCESSING', 'RECONCILIATION_REQUIRED'].includes(booking.bookingStatus)) return;
    if (booking.supplier !== this.supplier.name)
      throw new DomainError('SUPPLIER_MISMATCH', 'The booking supplier is not configured.', 503);
    if (!booking.supplierAttemptedAt) {
      if (booking.updatedAt.getTime() + 15 * 60_000 > Date.now()) {
        throw new DomainError(
          'SUPPLIER_RECHECK_PENDING',
          'Supplier rate validation is still in progress.',
          503,
        );
      }
      await this.failAndRequestRefund(bookingId, 'SUPPLIER_DISPATCH_NOT_STARTED', true);
      return;
    }
    if (booking.supplierAttemptedAt.getTime() + 5 * 60_000 > Date.now()) {
      throw new DomainError(
        'SUPPLIER_BOOKING_PENDING',
        'Supplier booking is still in progress.',
        503,
      );
    }
    const result = await this.supplier.getBooking({
      clientReference: booking.id,
      ...(booking.supplierBookingId ? { supplierBookingId: booking.supplierBookingId } : {}),
    });
    await this.applySupplierResult(bookingId, result);
    if (result.status === 'pending')
      throw new DomainError(
        'SUPPLIER_BOOKING_PENDING',
        'Supplier confirmation is still pending.',
        503,
      );
  }

  private async applySupplierResult(
    bookingId: string,
    result: SupplierBookingResult,
  ): Promise<void> {
    if (result.status === 'failed') {
      await this.failAndRequestRefund(bookingId, 'SUPPLIER_BOOKING_REJECTED');
      return;
    }
    if (result.status === 'pending' || !result.supplierBookingId) {
      await this.database.booking.updateMany({
        where: {
          id: bookingId,
          bookingStatus: { in: ['BOOKING_PROCESSING', 'RECONCILIATION_REQUIRED'] },
        },
        data: {
          bookingStatus: 'RECONCILIATION_REQUIRED',
          ...(result.supplierBookingId ? { supplierBookingId: result.supplierBookingId } : {}),
          version: { increment: 1 },
        },
      });
      if (result.status === 'confirmed')
        throw new DomainError(
          'INVALID_SUPPLIER_CONFIRMATION',
          'Supplier returned no booking reference.',
          503,
        );
      return;
    }
    await this.database.$transaction(async (tx) => {
      const applied = await tx.booking.updateMany({
        where: {
          id: bookingId,
          bookingStatus: { in: ['BOOKING_PROCESSING', 'RECONCILIATION_REQUIRED'] },
          paymentStatus: 'PAYMENT_SUCCEEDED',
        },
        data: {
          bookingStatus: 'BOOKING_CONFIRMED',
          supplierBookingId: result.supplierBookingId,
          confirmationNumber: result.confirmationNumber ?? null,
          confirmedAt: new Date(),
          failureCode: null,
          version: { increment: 1 },
        },
      });
      if (applied.count === 0) return;
      await tx.outboxEvent.create({
        data: {
          kind: 'BOOKING_CONFIRMATION_EMAIL',
          aggregateId: bookingId,
          dedupeKey: `booking-confirmation:${bookingId}`,
        },
      });
      await tx.auditLog.create({ data: { bookingId, action: 'booking.confirmed' } });
    });
  }

  private async failAndRequestRefund(
    bookingId: string,
    failureCode: string,
    onlyIfUndispatched = false,
  ): Promise<void> {
    await this.database.$transaction(async (tx) => {
      const applied = await tx.booking.updateMany({
        where: {
          id: bookingId,
          bookingStatus: { in: ['BOOKING_PROCESSING', 'RECONCILIATION_REQUIRED'] },
          paymentStatus: 'PAYMENT_SUCCEEDED',
          ...(onlyIfUndispatched ? { supplierAttemptedAt: null } : {}),
        },
        data: {
          bookingStatus: 'BOOKING_FAILED',
          paymentStatus: 'REFUND_PENDING',
          failureCode,
          version: { increment: 1 },
        },
      });
      if (applied.count === 0) return;
      const payment = await tx.payment.findUniqueOrThrow({ where: { bookingId } });
      const refund = await tx.refund.create({
        data: {
          bookingId,
          paymentId: payment.id,
          idempotencyKey: `booking-failed:${bookingId}`,
          amount: payment.amount,
          currency: payment.currency,
          reason: failureCode,
        },
      });
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUND_PENDING' } });
      await tx.outboxEvent.create({
        data: {
          kind: 'REFUND_PROCESSING',
          aggregateId: refund.id,
          dedupeKey: `refund:${refund.id}`,
        },
      });
      await tx.auditLog.create({
        data: {
          bookingId,
          action: 'booking.failed.refund.requested',
          metadata: { failureCode } as Prisma.InputJsonValue,
        },
      });
    });
  }
}
