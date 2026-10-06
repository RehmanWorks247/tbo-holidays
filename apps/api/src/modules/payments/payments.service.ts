import { createHash } from 'node:crypto';

import type { CheckoutRequest, CheckoutResponse } from '@hotel/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { type Payment, Prisma } from '@prisma/client';

import { DomainError } from '../../common/errors/domain-error';
import { DatabaseService } from '../../database/database.service';
import type { PaymentProvider, VerifiedPaymentEvent } from './providers/payment-provider';
import { PAYMENT_PROVIDER } from './providers/payment-provider';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  async checkout(userId: string, request: CheckoutRequest): Promise<CheckoutResponse> {
    this.provider.assertConfigured();
    const requestHash = createHash('sha256').update(request.bookingId).digest('hex');
    const previous = await this.findCheckout(userId, request, requestHash);
    if (previous) return previous;

    // Reserve once before the external side effect. A crash or unknown outcome
    // leaves a durable payment for reconciliation; it never creates a new charge.
    let payment: Payment;
    try {
      payment = await this.database.$transaction(async (tx) => {
        const booking = await tx.booking.findFirst({
          where: { id: request.bookingId, userId },
          include: { quote: true },
        });
        if (!booking) throw new DomainError('BOOKING_NOT_FOUND', 'Booking not found.', 404);
        if (!booking.guestsCapturedAt)
          throw new DomainError(
            'GUEST_DETAILS_REQUIRED',
            'Complete the guest details before checkout.',
            409,
          );
        if (booking.quote.expiresAt <= new Date())
          throw new DomainError(
            'QUOTE_EXPIRED',
            'The quote has expired. Recheck and create a new booking.',
            409,
          );
        const reserved = await tx.booking.updateMany({
          where: {
            id: booking.id,
            version: booking.version,
            bookingStatus: 'BOOKING_PENDING',
            paymentStatus: 'PAYMENT_PENDING',
            payments: { none: {} },
          },
          data: { version: { increment: 1 } },
        });
        if (reserved.count !== 1)
          throw new DomainError(
            'CHECKOUT_CONFLICT',
            'This booking has changed. Reload before checkout.',
            409,
          );
        const created = await tx.payment.create({
          data: {
            bookingId: booking.id,
            provider: this.provider.name,
            idempotencyKey: request.idempotencyKey,
            requestHash,
            amount: booking.totalAmount,
            currency: booking.currency,
          },
        });
        await tx.outboxEvent.create({
          data: {
            kind: 'PAYMENT_RECONCILIATION',
            aggregateId: created.id,
            dedupeKey: `payment-reconciliation:${created.id}`,
            availableAt: new Date(Date.now() + 5 * 60_000),
          },
        });
        return created;
      });
    } catch (error) {
      if (
        (error instanceof DomainError && error.code === 'CHECKOUT_CONFLICT') ||
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      ) {
        const replay = await this.findCheckout(userId, request, requestHash);
        if (replay) return replay;
      }
      throw error;
    }

    try {
      const checkout = await this.provider.createPayment({
        paymentId: payment.id,
        bookingId: payment.bookingId,
        idempotencyKey: payment.id,
        amount: payment.amount,
        currency: payment.currency,
      });
      await this.database.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: checkout.providerPaymentId,
          checkoutUrl: checkout.redirectUrl,
          checkoutExpiresAt: checkout.expiresAt,
        },
      });
      return { paymentId: payment.id, status: payment.status, redirectUrl: checkout.redirectUrl };
    } catch {
      await this.database.payment.update({
        where: { id: payment.id },
        data: { requiresReconciliation: true },
      });
      throw new DomainError(
        'PAYMENT_RECONCILIATION_REQUIRED',
        'The payment outcome is being checked. Do not create another payment.',
        503,
      );
    }
  }

  private async findCheckout(
    userId: string,
    request: CheckoutRequest,
    requestHash: string,
  ): Promise<CheckoutResponse | null> {
    const previous = await this.database.payment.findFirst({
      where: { bookingId: request.bookingId, booking: { userId } },
    });
    if (!previous) return null;
    if (
      previous.idempotencyKey !== request.idempotencyKey ||
      previous.requestHash !== requestHash
    ) {
      throw new DomainError(
        'CHECKOUT_ALREADY_EXISTS',
        'This booking already has a checkout. Reuse the original request key.',
        409,
      );
    }
    const usableCheckout =
      previous.status === 'PAYMENT_PENDING' &&
      !previous.requiresReconciliation &&
      previous.checkoutExpiresAt &&
      previous.checkoutExpiresAt > new Date() &&
      previous.checkoutUrl;
    return {
      paymentId: previous.id,
      status: previous.status,
      ...(usableCheckout ? { redirectUrl: usableCheckout } : {}),
    };
  }

  async webhook(
    providerName: string,
    rawBody: Buffer | undefined,
    headers: Readonly<Record<string, string | string[] | undefined>>,
  ): Promise<{ received: true; duplicate: boolean }> {
    if (providerName !== this.provider.name)
      throw new DomainError('UNKNOWN_PAYMENT_PROVIDER', 'Unknown payment provider.', 404);
    if (!rawBody?.length)
      throw new DomainError('WEBHOOK_BODY_REQUIRED', 'Webhook requires the original request body.');
    // The provider has sole ownership of signature validation. Never parse JSON
    // or trust provider fields in the controller before this completes.
    const event = await this.provider.verifyWebhook(rawBody, headers);
    return this.applyVerifiedEvent(event, createHash('sha256').update(rawBody).digest('hex'));
  }

  private async applyVerifiedEvent(event: VerifiedPaymentEvent, payloadHash: string) {
    try {
      await this.database.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id: event.paymentId },
          include: { booking: true },
        });
        if (!payment || payment.provider !== this.provider.name) {
          throw new DomainError('PAYMENT_NOT_FOUND', 'Payment not found.', 404);
        }
        if (
          payment.amount !== event.amount ||
          payment.currency !== event.currency ||
          (payment.providerPaymentId !== null &&
            payment.providerPaymentId !== event.providerPaymentId)
        ) {
          throw new DomainError(
            'PAYMENT_EVENT_MISMATCH',
            'Payment event does not match the reserved payment.',
            409,
          );
        }
        await tx.paymentEvent.create({
          data: {
            provider: this.provider.name,
            providerEventId: event.id,
            paymentId: payment.id,
            type: event.type,
            payloadHash,
          },
        });
        if (event.type === 'payment.succeeded') {
          const applied = await tx.payment.updateMany({
            where: { id: payment.id, status: { in: ['PAYMENT_PENDING', 'PAYMENT_FAILED'] } },
            data: {
              status: 'PAYMENT_SUCCEEDED',
              providerPaymentId: event.providerPaymentId,
              requiresReconciliation: false,
            },
          });
          if (applied.count === 1) {
            await tx.booking.update({
              where: { id: payment.bookingId },
              data: { paymentStatus: 'PAYMENT_SUCCEEDED', version: { increment: 1 } },
            });
            await tx.outboxEvent.create({
              data: {
                kind: 'BOOKING_FULFILLMENT',
                aggregateId: payment.bookingId,
                dedupeKey: `booking-fulfillment:${payment.bookingId}`,
              },
            });
          }
        } else {
          const applied = await tx.payment.updateMany({
            where: { id: payment.id, status: 'PAYMENT_PENDING' },
            data: {
              status: 'PAYMENT_FAILED',
              providerPaymentId: event.providerPaymentId,
              requiresReconciliation: false,
            },
          });
          if (applied.count === 1)
            await tx.booking.update({
              where: { id: payment.bookingId },
              data: { paymentStatus: 'PAYMENT_FAILED', version: { increment: 1 } },
            });
        }
        await tx.auditLog.create({
          data: {
            bookingId: payment.bookingId,
            action: event.type,
            metadata: { paymentId: payment.id, eventId: event.id },
          },
        });
      });
      return { received: true as const, duplicate: false };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.database.paymentEvent.findUnique({
          where: {
            provider_providerEventId: { provider: this.provider.name, providerEventId: event.id },
          },
        });
        if (existing?.paymentId === event.paymentId && existing.payloadHash === payloadHash) {
          return { received: true as const, duplicate: true };
        }
        throw new DomainError(
          'PAYMENT_EVENT_CONFLICT',
          'A payment event identifier was reused with different data.',
          409,
        );
      }
      throw error;
    }
  }
}
