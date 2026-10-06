import type { BookingResponse } from '@hotel/contracts';
import { currencySchema } from '@hotel/contracts';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

export type BookingWithDetails = Prisma.BookingGetPayload<{
  include: { rooms: true; guests: true };
}>;

export function toBookingResponse(booking: BookingWithDetails): BookingResponse {
  return {
    id: booking.id,
    hotel: { id: booking.hotelCode, name: booking.hotelName, images: [], facilities: [] },
    checkIn: booking.checkIn.toISOString().slice(0, 10),
    checkOut: booking.checkOut.toISOString().slice(0, 10),
    rooms: booking.rooms.map((room) => ({
      roomIndex: room.roomIndex,
      name: room.roomName,
      adults: room.adults,
      childrenAges: z.array(z.number()).parse(room.childrenAges),
    })),
    guests: booking.guests.map((guest) => ({
      roomIndex: guest.roomIndex,
      title: z.enum(['Mr', 'Mrs', 'Ms', 'Miss', 'Master']).parse(guest.title),
      firstName: guest.firstName,
      lastName: guest.lastName,
      type: guest.type,
      ...(guest.age === null ? {} : { age: guest.age }),
      leadGuest: guest.leadGuest,
    })),
    price: {
      currency: currencySchema.parse(booking.currency),
      baseAmount: booking.baseAmount,
      taxAmount: booking.taxAmount,
      feeAmount: booking.feeAmount,
      markupAmount: booking.markupAmount,
      discountAmount: booking.discountAmount,
      totalAmount: booking.totalAmount,
    },
    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}
