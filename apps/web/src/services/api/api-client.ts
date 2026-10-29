import { z } from 'zod';

import { publicEnvironment } from '@/config/env';

const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string().optional(),
});

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 20_000);
  let response: Response;
  try {
    response = await fetch(`${publicEnvironment.apiUrl.replace(/\/$/, '')}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal ? AbortSignal.any([timeout, options.signal]) : timeout,
      cache: 'no-store',
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(
      'API_UNAVAILABLE',
      'We could not reach the booking service. Please try again.',
      503,
    );
  }
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const parsed = errorResponseSchema.safeParse(payload);
    if (parsed.success)
      throw new ApiError(
        parsed.data.code,
        parsed.data.message,
        response.status,
        parsed.data.requestId,
      );
    throw new ApiError(
      'REQUEST_FAILED',
      'The request could not be completed. Please try again.',
      response.status,
    );
  }
  const envelope = z.object({ data: schema, requestId: z.string() }).safeParse(payload);
  if (!envelope.success)
    throw new ApiError(
      'INVALID_RESPONSE',
      'The booking service returned an unexpected response.',
      502,
    );
  return envelope.data.data;
}

export async function requireSessionToken(getToken: () => Promise<string | null>): Promise<string> {
  const token = await getToken();
  if (!token) throw new ApiError('UNAUTHENTICATED', 'Please sign in again to continue.', 401);
  return token;
}
