import {
  hotelSearchRequestSchema,
  mockHotelSearchRequestSchema,
  validateStay,
} from '@hotel/contracts';

import { publicEnvironment } from '@/config/env';

export const hotelSearchFormSchema = hotelSearchRequestSchema.superRefine((value, context) => {
  const error = validateStay(value.checkIn, value.checkOut, publicEnvironment.maxStayNights);
  if (error) context.addIssue({ code: 'custom', path: ['checkOut'], message: error });
});

export function createHotelSearchFormSchema(mode: 'live' | 'mock') {
  return mockHotelSearchRequestSchema.superRefine((value, context) => {
    if (mode === 'live') {
      const parsed = hotelSearchFormSchema.safeParse(value);
      if (!parsed.success) {
        for (const issue of parsed.error.issues)
          context.addIssue({ code: 'custom', path: issue.path, message: issue.message });
      }
      return;
    }
    if (value.checkIn && value.checkOut) {
      const error = validateStay(value.checkIn, value.checkOut, publicEnvironment.maxStayNights);
      if (error) context.addIssue({ code: 'custom', path: ['checkOut'], message: error });
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (value.checkIn && value.checkIn < today)
      context.addIssue({
        code: 'custom',
        path: ['checkIn'],
        message: 'Check-in cannot be in the past.',
      });
    if (value.checkOut && value.checkOut <= today)
      context.addIssue({
        code: 'custom',
        path: ['checkOut'],
        message: 'Check-out must be after today.',
      });
  });
}
