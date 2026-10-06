import { randomUUID } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Environment } from '../src/config/environment';
import { DatabaseService } from '../src/database/database.service';
import { BookingFulfillmentService } from '../src/modules/bookings/booking-fulfillment.service';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { CustomersService } from '../src/modules/customers/customers.service';
import type { HotelSupplier, SupplierRate } from '../src/modules/hotels/hotel-supplier';
import { PaymentsService } from '../src/modules/payments/payments.service';
import type {
  PaymentProvider,
  VerifiedPaymentEvent,
} from '../src/modules/payments/providers/payment-provider';

// Run against a dedicated migrated PostgreSQL database; never reuse production.
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.toLowerCase().includes('test')) {
  throw new Error(
    'Integration tests require TEST_DATABASE_URL pointing to a dedicated database whose name contains test.',
  );
}
const database = new DatabaseService(new ConfigService<Environment, true>({ DATABASE_URL: url }));
const bookings = new BookingsService(database, new CustomersService());
const userId = randomUUID();

const rate: SupplierRate = {
  hotelId: 'integration-hotel',
  supplierRateId: 'test-rate-reference',
  roomName: 'Selected room',
  refundable: true,
  cancellationPolicies: [],
  price: { currency: 'USD', baseAmount: 10000, taxAmount: 1000, feeAmount: 0 },
};

function paymentProvider(event: VerifiedPaymentEvent): PaymentProvider {
  return {
    name: 'test-only',
    assertConfigured() {},
    createPayment: vi.fn(async (input) => ({
      providerPaymentId: `provider-${input.paymentId}`,
      redirectUrl: 'https://example.test/checkout',
      expiresAt: new Date(Date.now() + 60_000),
    })),
    // The unit suite verifies that failed signature validation prevents persistence.
    // This test adapter returns a pre-authenticated event to exercise real DB transactions.
    verifyWebhook: vi.fn(async () => event),
    verifyPayment: vi.fn(),
    refundPayment: vi.fn(),
  };
}

async function createQuote() {
  return database.priceQuote.create({
    data: {
      userId,
      supplier: 'test-only',
      supplierRateId: rate.supplierRateId,
      hotelId: rate.hotelId,
      hotelName: 'Integration fixture',
      roomId: randomUUID(),
      roomName: rate.roomName,
      checkIn: new Date('2030-01-10'),
      checkOut: new Date('2030-01-12'),
      occupancy: { nationality: 'PK', rooms: [{ adults: 1, childrenAges: [] }] },
      ...rate.price,
      markupAmount: 1000,
      discountAmount: 0,
      totalAmount: 12000,
      pricingSnapshot: { version: 1 },
      policySnapshot: { refundable: true, cancellationPolicies: [] },
      expiresAt: new Date(Date.now() + 600_000),
    },
  });
}

async function createReadyBooking(concurrentCheckout = false) {
  const quote = await createQuote();
  const booking = await bookings.createIntent(userId, {
    quoteId: quote.id,
    idempotencyKey: randomUUID(),
  });
  await bookings.updateGuests(userId, booking.id, {
    contactEmail: 'guest@example.test',
    contactPhone: '+12025550123',
    guests: [
      {
        title: 'Ms',
        firstName: 'Integration',
        lastName: 'Guest',
        roomIndex: 0,
        type: 'ADULT',
        leadGuest: true,
      },
    ],
  });
  const event: VerifiedPaymentEvent = {
    id: randomUUID(),
    paymentId: '',
    providerPaymentId: '',
    type: 'payment.succeeded',
    amount: 12000,
    currency: 'USD',
  };
  const provider = paymentProvider(event);
  const payments = new PaymentsService(database, provider);
  const checkoutRequest = {
    bookingId: booking.id,
    idempotencyKey: randomUUID(),
  };
  const [checkout, checkoutReplay] = await Promise.all([
    payments.checkout(userId, checkoutRequest),
    concurrentCheckout ? payments.checkout(userId, checkoutRequest) : Promise.resolve(undefined),
  ]);
  event.paymentId = checkout.paymentId;
  event.providerPaymentId = `provider-${checkout.paymentId}`;
  return { booking, payments, event, provider, checkout, checkoutReplay };
}

describe('transactional booking workflow with PostgreSQL', () => {
  beforeAll(async () => {
    await database.$connect();
    await database.user.create({ data: { id: userId, clerkId: `integration-${userId}` } });
  });

  afterAll(async () => {
    const ownedBookings = await database.booking.findMany({
      where: { userId },
      select: { id: true },
    });
    const bookingIds = ownedBookings.map((booking) => booking.id);
    const payments = await database.payment.findMany({
      where: { bookingId: { in: bookingIds } },
      select: { id: true },
    });
    const refunds = await database.refund.findMany({
      where: { bookingId: { in: bookingIds } },
      select: { id: true },
    });
    await database.outboxEvent.deleteMany({
      where: {
        aggregateId: {
          in: [
            ...bookingIds,
            ...payments.map((payment) => payment.id),
            ...refunds.map((refund) => refund.id),
          ],
        },
      },
    });
    await database.paymentEvent.deleteMany({
      where: { paymentId: { in: payments.map((payment) => payment.id) } },
    });
    await database.refund.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await database.payment.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await database.auditLog.deleteMany({
      where: { OR: [{ userId }, { bookingId: { in: bookingIds } }] },
    });
    await database.booking.deleteMany({ where: { userId } });
    await database.priceQuote.deleteMany({ where: { userId } });
    await database.user.deleteMany({ where: { id: userId } });
    await database.$disconnect();
  });

  it('atomically consumes one quote and persists concurrent intent idempotency', async () => {
    const quote = await createQuote();
    const request = { quoteId: quote.id, idempotencyKey: randomUUID() };
    const [first, replay] = await Promise.all([
      bookings.createIntent(userId, request),
      bookings.createIntent(userId, request),
    ]);
    expect(first.id).toBe(replay.id);
    expect(await database.booking.count({ where: { quoteId: quote.id } })).toBe(1);
    expect(
      (await database.priceQuote.findUniqueOrThrow({ where: { id: quote.id } })).consumedAt,
    ).not.toBeNull();
    const other = await createQuote();
    await expect(
      bookings.createIntent(userId, { ...request, quoteId: other.id }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('isolates quotes and bookings by authenticated owner', async () => {
    const quote = await createQuote();
    await expect(
      bookings.createIntent(randomUUID(), { quoteId: quote.id, idempotencyKey: randomUUID() }),
    ).rejects.toMatchObject({ code: 'QUOTE_NOT_FOUND' });
    const booking = await bookings.createIntent(userId, {
      quoteId: quote.id,
      idempotencyKey: randomUUID(),
    });
    await expect(bookings.get(randomUUID(), booking.id)).rejects.toMatchObject({
      code: 'BOOKING_NOT_FOUND',
    });
  });

  it('resolves concurrent checkout replays to one persisted payment and one gateway call', async () => {
    const fixture = await createReadyBooking(true);
    expect(fixture.checkoutReplay?.paymentId).toBe(fixture.checkout.paymentId);
    expect(fixture.provider.createPayment).toHaveBeenCalledTimes(1);
    expect(await database.payment.count({ where: { bookingId: fixture.booking.id } })).toBe(1);
  });

  it('deduplicates concurrent webhooks and ignores a late failure after success', async () => {
    const fixture = await createReadyBooking();
    const bytes = Buffer.from('authenticated-success-event');
    const results = await Promise.all([
      fixture.payments.webhook('test-only', bytes, {}),
      fixture.payments.webhook('test-only', bytes, {}),
    ]);
    expect(results.map((result) => result.duplicate).sort()).toEqual([false, true]);
    expect(
      await database.paymentEvent.count({ where: { paymentId: fixture.checkout.paymentId } }),
    ).toBe(1);
    expect(
      await database.outboxEvent.count({
        where: { dedupeKey: `booking-fulfillment:${fixture.booking.id}` },
      }),
    ).toBe(1);
    fixture.event.id = randomUUID();
    fixture.event.type = 'payment.failed';
    await fixture.payments.webhook('test-only', Buffer.from('authenticated-late-failure'), {});
    expect((await bookings.get(userId, fixture.booking.id)).paymentStatus).toBe(
      'PAYMENT_SUCCEEDED',
    );
  });

  it('rejects signed events with the wrong currency or amount before recording them', async () => {
    const fixture = await createReadyBooking();
    fixture.event.amount = 1;
    await expect(
      fixture.payments.webhook('test-only', Buffer.from('wrong-amount'), {}),
    ).rejects.toMatchObject({ code: 'PAYMENT_EVENT_MISMATCH' });
    expect(
      await database.paymentEvent.count({ where: { paymentId: fixture.checkout.paymentId } }),
    ).toBe(0);
    expect((await bookings.get(userId, fixture.booking.id)).paymentStatus).toBe('PAYMENT_PENDING');
  });

  it('rolls back deduplication, payment, and booking writes when downstream persistence fails', async () => {
    const fixture = await createReadyBooking();
    const collision = await database.outboxEvent.create({
      data: {
        kind: 'BOOKING_FULFILLMENT',
        aggregateId: fixture.booking.id,
        dedupeKey: `booking-fulfillment:${fixture.booking.id}`,
      },
    });
    const bytes = Buffer.from('rollback-event');
    await expect(fixture.payments.webhook('test-only', bytes, {})).rejects.toMatchObject({
      code: 'PAYMENT_EVENT_CONFLICT',
    });
    expect(
      await database.paymentEvent.count({ where: { paymentId: fixture.checkout.paymentId } }),
    ).toBe(0);
    expect(
      (await database.payment.findUniqueOrThrow({ where: { id: fixture.checkout.paymentId } }))
        .status,
    ).toBe('PAYMENT_PENDING');
    expect((await bookings.get(userId, fixture.booking.id)).paymentStatus).toBe('PAYMENT_PENDING');
    await database.outboxEvent.delete({ where: { id: collision.id } });
    await expect(fixture.payments.webhook('test-only', bytes, {})).resolves.toEqual({
      received: true,
      duplicate: false,
    });
  });

  it('does not retry supplier mutations after an ambiguous timeout and reconciles by stable reference', async () => {
    const fixture = await createReadyBooking();
    await fixture.payments.webhook('test-only', Buffer.from('paid-for-timeout'), {});
    const supplier: HotelSupplier = {
      name: 'test-only',
      searchHotels: vi.fn(),
      getHotelDetails: vi.fn(),
      getAvailability: vi.fn(),
      recheckPrice: vi.fn(async () => rate),
      createBooking: vi.fn().mockRejectedValue(new Error('timeout')),
      getBooking: vi.fn(async () => ({
        status: 'confirmed' as const,
        supplierBookingId: `confirmed-${fixture.booking.id}`,
      })),
      cancelBooking: vi.fn(),
    };
    const fulfillment = new BookingFulfillmentService(database, supplier);
    await fulfillment.fulfill(fixture.booking.id);
    expect((await bookings.get(userId, fixture.booking.id)).bookingStatus).toBe(
      'RECONCILIATION_REQUIRED',
    );
    await fulfillment.fulfill(fixture.booking.id);
    expect(supplier.createBooking).toHaveBeenCalledTimes(1);
    await database.booking.update({
      where: { id: fixture.booking.id },
      data: { supplierAttemptedAt: new Date(Date.now() - 10 * 60_000) },
    });
    await fulfillment.reconcile(fixture.booking.id);
    expect(supplier.getBooking).toHaveBeenCalledWith({ clientReference: fixture.booking.id });
    expect((await bookings.get(userId, fixture.booking.id)).bookingStatus).toBe(
      'BOOKING_CONFIRMED',
    );
  });

  it('requests a refund without sending a supplier mutation if the paid rate changes', async () => {
    const fixture = await createReadyBooking();
    await fixture.payments.webhook('test-only', Buffer.from('paid-before-price-change'), {});
    const supplier: HotelSupplier = {
      name: 'test-only',
      searchHotels: vi.fn(),
      getHotelDetails: vi.fn(),
      getAvailability: vi.fn(),
      recheckPrice: vi.fn(async () => ({ ...rate, price: { ...rate.price, baseAmount: 20000 } })),
      createBooking: vi.fn(),
      getBooking: vi.fn(),
      cancelBooking: vi.fn(),
    };
    const fulfillment = new BookingFulfillmentService(database, supplier);
    await fulfillment.fulfill(fixture.booking.id);
    await fulfillment.fulfill(fixture.booking.id);
    const booking = await bookings.get(userId, fixture.booking.id);
    expect(booking.bookingStatus).toBe('BOOKING_FAILED');
    expect(booking.paymentStatus).toBe('REFUND_PENDING');
    expect(supplier.createBooking).not.toHaveBeenCalled();
    expect(await database.refund.count({ where: { bookingId: booking.id } })).toBe(1);
  });

  it('prevents a paused worker from dispatching after stale undispatched work entered refunds', async () => {
    const fixture = await createReadyBooking();
    await fixture.payments.webhook('test-only', Buffer.from('paid-before-stalled-recheck'), {});
    let announceRecheck: () => void = () => {};
    let completeRecheck: (value: SupplierRate) => void = () => {};
    const recheckStarted = new Promise<void>((resolve) => {
      announceRecheck = resolve;
    });
    const recheckResult = new Promise<SupplierRate>((resolve) => {
      completeRecheck = resolve;
    });
    const supplier: HotelSupplier = {
      name: 'test-only',
      searchHotels: vi.fn(),
      getHotelDetails: vi.fn(),
      getAvailability: vi.fn(),
      recheckPrice: vi.fn(async () => {
        announceRecheck();
        return recheckResult;
      }),
      createBooking: vi.fn(),
      getBooking: vi.fn(),
      cancelBooking: vi.fn(),
    };
    const fulfillment = new BookingFulfillmentService(database, supplier);
    const pending = fulfillment.fulfill(fixture.booking.id);
    await recheckStarted;
    await database.booking.update({
      where: { id: fixture.booking.id },
      data: { updatedAt: new Date(Date.now() - 20 * 60_000) },
    });
    await fulfillment.reconcile(fixture.booking.id);
    completeRecheck(rate);
    await pending;
    expect((await bookings.get(userId, fixture.booking.id)).paymentStatus).toBe('REFUND_PENDING');
    expect(supplier.createBooking).not.toHaveBeenCalled();
  });
});
