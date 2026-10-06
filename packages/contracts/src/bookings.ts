import { z } from 'zod';

import { priceBreakdownSchema } from './common';
import { dateOnlySchema, hotelSchema } from './hotels';

export const bookingStatusSchema = z.enum([
  'BOOKING_PENDING',
  'BOOKING_PROCESSING',
  'BOOKING_CONFIRMED',
  'BOOKING_FAILED',
  'BOOKING_CANCELLED',
  'RECONCILIATION_REQUIRED',
]);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;
export const paymentStatusSchema = z.enum([
  'PAYMENT_PENDING',
  'PAYMENT_SUCCEEDED',
  'PAYMENT_FAILED',
  'REFUND_PENDING',
  'REFUNDED',
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export const createBookingRequestSchema = z
  .object({ quoteId: z.uuid(), idempotencyKey: z.uuid() })
  .strict();
export type CreateBookingRequest = z.infer<typeof createBookingRequestSchema>;
export const bookingGuestInputSchema = z
  .object({
    roomIndex: z.number().int().min(0).max(3),
    title: z.enum(['Mr', 'Mrs', 'Ms', 'Miss', 'Master']),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    type: z.enum(['ADULT', 'CHILD']),
    age: z.number().int().min(0).max(120).optional(),
    leadGuest: z.boolean(),
  })
  .strict()
  .refine((guest) => guest.type !== 'CHILD' || (guest.age !== undefined && guest.age < 18), {
    message: 'Children require an age below 18.',
    path: ['age'],
  })
  .refine((guest) => !guest.leadGuest || guest.type === 'ADULT', {
    message: 'The lead guest must be an adult.',
    path: ['leadGuest'],
  });
export type BookingGuestInput = z.infer<typeof bookingGuestInputSchema>;
export const updateBookingGuestsRequestSchema = z
  .object({
    guests: z.array(bookingGuestInputSchema).min(1).max(24),
    contactEmail: z.email().max(254),
    contactPhone: z.string().trim().min(5).max(30),
  })
  .strict()
  .refine((value) => value.guests.filter((guest) => guest.leadGuest).length === 1, {
    message: 'Exactly one adult must be the lead guest.',
    path: ['guests'],
  });
export type UpdateBookingGuestsRequest = z.infer<typeof updateBookingGuestsRequestSchema>;
export const bookingRoomResponseSchema = z.object({
  roomIndex: z.number().int(),
  name: z.string(),
  adults: z.number().int(),
  childrenAges: z.array(z.number().int()),
});
export type BookingRoomResponse = z.infer<typeof bookingRoomResponseSchema>;
export const bookingResponseSchema = z.object({
  id: z.uuid(),
  hotel: hotelSchema,
  checkIn: dateOnlySchema,
  checkOut: dateOnlySchema,
  rooms: z.array(bookingRoomResponseSchema),
  guests: z.array(bookingGuestInputSchema),
  price: priceBreakdownSchema,
  bookingStatus: bookingStatusSchema,
  paymentStatus: paymentStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type BookingResponse = z.infer<typeof bookingResponseSchema>;
export const checkoutRequestSchema = z
  .object({ bookingId: z.uuid(), idempotencyKey: z.uuid() })
  .strict();
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export const checkoutResponseSchema = z.object({
  paymentId: z.uuid(),
  status: z.string(),
  redirectUrl: z.url().optional(),
});
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;
