import {
  bookingResponseSchema,
  type CreateBookingRequest,
  type UpdateBookingGuestsRequest,
} from '@hotel/contracts';
import { z } from 'zod';

import { apiRequest } from '@/services/api/api-client';

export const bookingsApi = {
  list: (token: string, signal?: AbortSignal) =>
    apiRequest('/bookings', z.array(bookingResponseSchema), { token, signal }),
  get: (id: string, token: string, signal?: AbortSignal) =>
    apiRequest(`/bookings/${encodeURIComponent(id)}`, bookingResponseSchema, { token, signal }),
  create: (request: CreateBookingRequest, token: string) =>
    apiRequest('/bookings', bookingResponseSchema, { method: 'POST', body: request, token }),
  updateGuests: (id: string, request: UpdateBookingGuestsRequest, token: string) =>
    apiRequest(`/bookings/${encodeURIComponent(id)}/guests`, bookingResponseSchema, {
      method: 'PATCH',
      body: request,
      token,
    }),
  cancel: (id: string, token: string) =>
    apiRequest(`/bookings/${encodeURIComponent(id)}/cancel`, bookingResponseSchema, {
      method: 'POST',
      token,
    }),
};
