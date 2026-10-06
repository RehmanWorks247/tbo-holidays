import { hotelSearchRequestSchema, validateStay } from '@hotel/contracts';

import { publicEnvironment } from '@/config/env';

export const hotelSearchFormSchema = hotelSearchRequestSchema.superRefine((value, context) => {
  const error = validateStay(value.checkIn, value.checkOut, publicEnvironment.maxStayNights);
  if (error) context.addIssue({ code: 'custom', path: ['checkOut'], message: error });
});
