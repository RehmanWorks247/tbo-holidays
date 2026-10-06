import { type UpdateProfileRequest, userResponseSchema } from '@hotel/contracts';

import { apiRequest } from '@/services/api/api-client';

export const usersApi = {
  me: (token: string, signal?: AbortSignal) =>
    apiRequest('/users/me', userResponseSchema, { token, signal }),
  update: (request: UpdateProfileRequest, token: string) =>
    apiRequest('/users/me', userResponseSchema, { method: 'PATCH', body: request, token }),
};
