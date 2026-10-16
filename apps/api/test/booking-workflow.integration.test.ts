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
import { CurrencyService } from '../src/modules/pricing/currency.service';
import { MarkupService } from '../src/modules/pricing/markup.service';
import { PricingService } from '../src/modules/pricing/pricing.service';

// Run against a dedicated migrated PostgreSQL database; never reuse production.
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.toLowerCase().includes('test')) {
  throw new Error(
    'Integration tests require TEST_DATABASE_URL pointing to a dedicated database whose name contains test.',
  );
}
const database = new DatabaseService(new ConfigService<Environment, true>({ DATABASE_URL: url }));
const bookings = new BookingsService(database, new CustomersService());
const pricingConfig = new ConfigService<Environment, true>({
  MARKUP_BASIS_POINTS: 1000,
  QUOTE_TTL_SECONDS: 600,
});
const pricing = new PricingService(
  database,
  pricingConfig,
  new CurrencyService(),
  new MarkupService(pricingConfig),
);
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

async function createQuote(selectedRate = rate) {
  return pricing.createQuote({
    userId,
    supplier: 'test-only',
    rateId: randomUUID(),
    rate: selectedRate,
    hotel: { id: selectedRate.hotelId, name: 'Integration fixture', images: [], facilities: [] },
    criteria: {
      destination: 'fixture-city',
      checkIn: '2030-01-10',
      checkOut: '2030-01-12',
      nationality: 'PK',
      rooms: [{ adults: 1, childrenAges: [] }],
      currency: 'USD',
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

  it('persists complete quote terms and the selling floor in immutable booking snapshots', async () => {
    const selectedRate: SupplierRate = {
      ...rate,
      price: { ...rate.price, minimumSellingAmount: 15000 },
      cancellationPolicies: [
        {
          roomIndex: 0,
          from: '2030-01-09T18:00:00',
          timeBasis: 'property-local',
          chargeType: 'percentage',
          percentageBasisPoints: 10000,
        },
      ],
      terms: {
        roomNames: [rate.roomName],
        amenities: ['Breakfast'],
        promotions: [],
        rateConditions: ['Present a matching photo ID.'],
        supplements: [
          {
            roomIndex: 0,
            payment: 'at-property',
            description: 'City tax',
            amount: 400,
            currency: 'EUR',
          },
        ],
      },
    };
    const quote = await createQuote(selectedRate);
    const response = await bookings.createIntent(userId, {
      quoteId: quote.id,
      idempotencyKey: randomUUID(),
    });
    const persistedQuote = await database.priceQuote.findUniqueOrThrow({ where: { id: quote.id } });
    const booking = await database.booking.findUniqueOrThrow({ where: { id: response.id } });
    expect(persistedQuote.policySnapshot).toEqual({
      refundable: selectedRate.refundable,
      cancellationPolicies: selectedRate.cancellationPolicies,
      terms: selectedRate.terms,
    });
    expect(persistedQuote.pricingSnapshot).toMatchObject({
      baseAmount: 10000,
      taxAmount: 1000,
      feeAmount: 0,
      markupAmount: 4000,
      totalAmount: 15000,
      minimumSellingAmount: 15000,
    });
    expect(booking.policySnapshot).toEqual(persistedQuote.policySnapshot);
    expect(booking.pricingSnapshot).toEqual(persistedQuote.pricingSnapshot);
    expect(booking.totalAmount).toBe(15000);
    expect(persistedQuote.consumedAt).not.toBeNull();
    expect(JSON.stringify(response)).not.toContain('minimumSellingAmount');
    expect(JSON.stringify(response)).not.toContain(selectedRate.supplierRateId);
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

  it.each(['price', 'selling floor', 'terms', 'meal plan'] as const)(
    'requests a refund without sending a supplier mutation if the accepted %s changes',
    async (changed) => {
      const fixture = await createReadyBooking();
      await fixture.payments.webhook('test-only', Buffer.from('paid-before-price-change'), {});
      const rechecked: SupplierRate = {
        ...rate,
        ...(changed === 'meal plan' ? { mealType: 'Room_Only' } : {}),
        price: {
          ...rate.price,
          ...(changed === 'price' ? { baseAmount: 20000 } : {}),
          ...(changed === 'selling floor' ? { minimumSellingAmount: 12001 } : {}),
        },
        ...(changed === 'terms'
          ? {
              terms: {
                roomNames: [rate.roomName],
                amenities: [],
                promotions: [],
                rateConditions: ['New mandatory condition'],
                supplements: [],
              },
            }
          : {}),
      };
      const supplier: HotelSupplier = {
        name: 'test-only',
        searchHotels: vi.fn(),
        getHotelDetails: vi.fn(),
        getAvailability: vi.fn(),
        recheckPrice: vi.fn(async () => rechecked),
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
      expect(await database.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject(
        { failureCode: 'HOTEL_RATE_CHANGED', supplierAttemptedAt: null },
      );
    },
  );

  it.each([11999, 12000])(
    'accepts a rechecked selling floor within the already accepted total: %s',
    async (minimumSellingAmount) => {
      const fixture = await createReadyBooking();
      await fixture.payments.webhook('test-only', Buffer.from('paid-before-floor-recheck'), {});
      const supplier: HotelSupplier = {
        name: 'test-only',
        searchHotels: vi.fn(),
        getHotelDetails: vi.fn(),
        getAvailability: vi.fn(),
        recheckPrice: vi.fn(async () => ({
          ...rate,
          price: { ...rate.price, minimumSellingAmount },
        })),
        createBooking: vi.fn(async () => ({
          status: 'confirmed' as const,
          supplierBookingId: `confirmed-${fixture.booking.id}`,
        })),
        getBooking: vi.fn(),
        cancelBooking: vi.fn(),
      };
      const fulfillment = new BookingFulfillmentService(database, supplier);
      await fulfillment.fulfill(fixture.booking.id);
      const booking = await bookings.get(userId, fixture.booking.id);
      expect(booking.bookingStatus).toBe('BOOKING_CONFIRMED');
      expect(supplier.createBooking).toHaveBeenCalledTimes(1);
      expect(await database.refund.count({ where: { bookingId: booking.id } })).toBe(0);
    },
  );

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

  it('does not dispatch when the loaded quote expires during supplier recheck', async () => {
    const fixture = await createReadyBooking();
    await fixture.payments.webhook('test-only', Buffer.from('paid-before-expiring-recheck'), {});
    const persisted = await database.booking.findUniqueOrThrow({
      where: { id: fixture.booking.id },
      include: { quote: true },
    });
    const supplier: HotelSupplier = {
      name: 'test-only',
      searchHotels: vi.fn(),
      getHotelDetails: vi.fn(),
      getAvailability: vi.fn(),
      recheckPrice: vi.fn(async () => {
        vi.setSystemTime(persisted.quote.expiresAt.getTime() + 1);
        return rate;
      }),
      createBooking: vi.fn(),
      getBooking: vi.fn(),
      cancelBooking: vi.fn(),
    };
    // Only move the clock: database/network timers continue to run normally.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      await new BookingFulfillmentService(database, supplier).fulfill(fixture.booking.id);
    } finally {
      vi.useRealTimers();
    }
    expect(supplier.recheckPrice).toHaveBeenCalledTimes(1);
    expect(supplier.createBooking).not.toHaveBeenCalled();
    expect(
      await database.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } }),
    ).toMatchObject({
      bookingStatus: 'BOOKING_FAILED',
      paymentStatus: 'REFUND_PENDING',
      supplierAttemptedAt: null,
      failureCode: 'QUOTE_EXPIRED_BEFORE_FULFILLMENT',
    });
    expect(await database.refund.count({ where: { bookingId: fixture.booking.id } })).toBe(1);
  });

  it('atomically fences persisted quote expiry and retains recovery when the worker has a stale quote', async () => {
    const fixture = await createReadyBooking();
    await fixture.payments.webhook(
      'test-only',
      Buffer.from('paid-before-persisted-quote-expiry'),
      {},
    );
    const persisted = await database.booking.findUniqueOrThrow({
      where: { id: fixture.booking.id },
    });
    const supplier: HotelSupplier = {
      name: 'test-only',
      searchHotels: vi.fn(),
      getHotelDetails: vi.fn(),
      getAvailability: vi.fn(),
      recheckPrice: vi.fn(async () => {
        // The worker already loaded the future expiry. Only the dispatch predicate
        // can see this change, just as it fences a competing recovery transition.
        await database.priceQuote.update({
          where: { id: persisted.quoteId },
          data: { expiresAt: new Date(Date.now() - 1_000) },
        });
        return rate;
      }),
      createBooking: vi.fn(),
      getBooking: vi.fn(),
      cancelBooking: vi.fn(),
    };
    const fulfillment = new BookingFulfillmentService(database, supplier);
    await fulfillment.fulfill(fixture.booking.id);
    expect(supplier.createBooking).not.toHaveBeenCalled();
    expect(
      await database.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } }),
    ).toMatchObject({
      bookingStatus: 'BOOKING_PROCESSING',
      paymentStatus: 'PAYMENT_SUCCEEDED',
      supplierAttemptedAt: null,
    });
    expect(
      await database.outboxEvent.count({
        where: { dedupeKey: `booking-status:${fixture.booking.id}`, completedAt: null },
      }),
    ).toBe(1);
    expect(await database.refund.count({ where: { bookingId: fixture.booking.id } })).toBe(0);

    await database.booking.update({
      where: { id: fixture.booking.id },
      data: { updatedAt: new Date(Date.now() - 20 * 60_000) },
    });
    await fulfillment.reconcile(fixture.booking.id);
    expect(supplier.createBooking).not.toHaveBeenCalled();
    expect(supplier.getBooking).not.toHaveBeenCalled();
    expect(
      await database.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } }),
    ).toMatchObject({
      bookingStatus: 'BOOKING_FAILED',
      paymentStatus: 'REFUND_PENDING',
      supplierAttemptedAt: null,
      failureCode: 'SUPPLIER_DISPATCH_NOT_STARTED',
    });
    expect(await database.refund.count({ where: { bookingId: fixture.booking.id } })).toBe(1);
  });
});
