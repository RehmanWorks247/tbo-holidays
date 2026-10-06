import { type CheckoutRequest, checkoutResponseSchema } from '@hotel/contracts';

import { apiRequest } from '@/services/api/api-client';

export const paymentsApi = {
  checkout: (request: CheckoutRequest, token: string) =>
    apiRequest('/payments/checkout', checkoutResponseSchema, {
      method: 'POST',
      body: request,
      token,
    }),
};
