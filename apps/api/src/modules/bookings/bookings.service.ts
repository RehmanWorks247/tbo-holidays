import { createHash } from 'node:crypto';

import type {
  BookingResponse,
  CreateBookingRequest,
  UpdateBookingGuestsRequest,
} from '@hotel/contracts';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DomainError } from '../../common/errors/domain-error';
import { DatabaseService } from '../../database/database.service';
import { CustomersService } from '../customers/customers.service';
import { occupancySnapshotSchema } from './booking-snapshots';
import { toBookingResponse } from './mappers/booking.mapper';

const details = {
  rooms: { orderBy: { roomIndex: 'asc' as const } },
  guests: { orderBy: { roomIndex: 'asc' as const } },
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly customers: CustomersService,
  ) {}

  async createIntent(userId: string, request: CreateBookingRequest): Promise<BookingResponse> {
    const requestHash = createHash('sha256').update(request.quoteId).digest('hex');
    const existing = await this.findIntent(userId, request.idempotencyKey, requestHash);
    if (existing) return existing;

    try {
      const booking = await this.database.$transaction(async (tx) => {
        const quote = await tx.priceQuote.findFirst({ where: { id: request.quoteId, userId } });
        if (!quote) throw new DomainError('QUOTE_NOT_FOUND', 'Price quote not found.', 404);
        const now = new Date();
        if (quote.expiresAt <= now)
          throw new DomainError('QUOTE_EXPIRED', 'Recheck the hotel price before booking.', 409);
        const consumed = await tx.priceQuote.updateMany({
          where: { id: quote.id, userId, consumedAt: null, expiresAt: { gt: now } },
          data: { consumedAt: now },
        });
        if (consumed.count !== 1)
          throw new DomainError(
            'QUOTE_ALREADY_USED',
            'This price quote has already been used.',
            409,
          );
        const occupancy = occupancySnapshotSchema.parse(quote.occupancy);
        const created = await tx.booking.create({
          data: {
            userId,
            quoteId: quote.id,
            idempotencyKey: request.idempotencyKey,
            requestHash,
            supplier: quote.supplier,
            hotelCode: quote.hotelId,
            hotelName: quote.hotelName,
            checkIn: quote.checkIn,
            checkOut: quote.checkOut,
            currency: quote.currency,
            baseAmount: quote.baseAmount,
            taxAmount: quote.taxAmount,
            feeAmount: quote.feeAmount,
            markupAmount: quote.markupAmount,
            discountAmount: quote.discountAmount,
            totalAmount: quote.totalAmount,
            pricingSnapshot: quote.pricingSnapshot as Prisma.InputJsonValue,
            policySnapshot: quote.policySnapshot as Prisma.InputJsonValue,
            occupancySnapshot: quote.occupancy as Prisma.InputJsonValue,
            rooms: {
              create: occupancy.rooms.map((room, roomIndex) => ({
                roomIndex,
                roomCode: quote.roomId,
                roomName: quote.roomName,
                adults: room.adults,
                childrenAges: room.childrenAges,
              })),
            },
          },
          include: details,
        });
        await tx.auditLog.create({
          data: { userId, bookingId: created.id, action: 'booking.intent.created' },
        });
        return created;
      });
      return toBookingResponse(booking);
    } catch (error) {
      // Resolve competing requests by the persisted key after rollback. No supplier
      // request is ever inside this transaction or replayed by this recovery path.
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') ||
        (error instanceof DomainError && error.code === 'QUOTE_ALREADY_USED')
      ) {
        const replay = await this.findIntent(userId, request.idempotencyKey, requestHash);
        if (replay) return replay;
      }
      throw error;
    }
  }

  async list(userId: string): Promise<BookingResponse[]> {
    const bookings = await this.database.booking.findMany({
      where: { userId },
      include: details,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return bookings.map(toBookingResponse);
  }

  async get(userId: string, bookingId: string): Promise<BookingResponse> {
    const booking = await this.database.booking.findFirst({
      where: { id: bookingId, userId },
      include: details,
    });
    if (!booking) throw new DomainError('BOOKING_NOT_FOUND', 'Booking not found.', 404);
    return toBookingResponse(booking);
  }

  async updateGuests(
    userId: string,
    bookingId: string,
    request: UpdateBookingGuestsRequest,
  ): Promise<BookingResponse> {
    return this.database.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({ where: { id: bookingId, userId } });
      if (!booking) throw new DomainError('BOOKING_NOT_FOUND', 'Booking not found.', 404);
      this.customers.assertGuestsMatchRooms(request.guests, booking.occupancySnapshot);
      const updated = await tx.booking.updateMany({
        where: {
          id: bookingId,
          userId,
          version: booking.version,
          bookingStatus: 'BOOKING_PENDING',
          paymentStatus: 'PAYMENT_PENDING',
          payments: { none: {} },
        },
        data: {
          customerSnapshot: { email: request.contactEmail, phone: request.contactPhone },
          guestsCapturedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new DomainError(
          'BOOKING_LOCKED',
          'Guest details cannot be changed after checkout starts.',
          409,
        );
      await tx.bookingGuest.deleteMany({ where: { bookingId } });
      await tx.bookingGuest.createMany({
        data: request.guests.map((guest) => ({ ...guest, bookingId })),
      });
      await tx.auditLog.create({ data: { userId, bookingId, action: 'booking.guests.updated' } });
      const result = await tx.booking.findUniqueOrThrow({
        where: { id: bookingId },
        include: details,
      });
      return toBookingResponse(result);
    });
  }

  async cancel(userId: string, bookingId: string): Promise<never> {
    await this.get(userId, bookingId);
    throw new DomainError(
      'CANCELLATION_NOT_CONFIGURED',
      'Cancellation requires a certified supplier cancellation integration. Contact support.',
      503,
    );
  }

  private async findIntent(
    userId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<BookingResponse | null> {
    const booking = await this.database.booking.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: details,
    });
    if (!booking) return null;
    if (booking.requestHash !== requestHash)
      throw new DomainError(
        'IDEMPOTENCY_CONFLICT',
        'This idempotency key was used for another request.',
        409,
      );
    return toBookingResponse(booking);
  }
}
