import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DomainError } from '../../common/errors/domain-error';
import type { Environment } from '../../config/environment';
import { tboStatusSchema } from './dto/tbo.schemas';

const readOperations = [
  'Search',
  'PreBook',
  'HotelDetails',
  'TBOHotelCodeList',
  'CountryList',
  'CityList',
] as const;

export type TboReadOperation = (typeof readOperations)[number];

class ReadFailure extends Error {
  constructor(readonly retryable: boolean) {
    super('Supplier read failed');
  }
}

function invalidResponse(): DomainError {
  return new DomainError(
    'INVALID_SUPPLIER_RESPONSE',
    'The supplier returned an unsupported response.',
    502,
  );
}

function assertSupplierStatus(operation: TboReadOperation, code: number): void {
  // Search's no-availability payload is validated by the service, including any
  // contradictory inventory. It must not be silently converted into success here.
  if (code === 200 || (operation === 'Search' && code === 201)) return;
  if (operation === 'PreBook' && (code === 201 || code === 207)) {
    throw new DomainError('HOTEL_NOT_AVAILABLE', 'This hotel rate is no longer available.', 409);
  }
  if (operation === 'PreBook' && code === 315) {
    throw new DomainError('RATE_EXPIRED', 'Please search again to refresh this room.', 409);
  }
  switch (code) {
    case 400:
      throw new DomainError(
        'SUPPLIER_REQUEST_REJECTED',
        'The supplier could not accept the inventory request.',
        502,
      );
    case 401:
      throw new DomainError(
        'SUPPLIER_AUTHENTICATION_FAILED',
        'The supplier connection requires account configuration.',
        503,
      );
    case 402:
      throw new DomainError(
        'SUPPLIER_ACCOUNT_BLOCKED',
        'The supplier account is currently unavailable.',
        503,
      );
    case 300:
      throw new DomainError(
        'SUPPLIER_INSUFFICIENT_BALANCE',
        'The supplier account cannot currently complete this request.',
        503,
      );
    case 429:
      throw new ReadFailure(true);
    default:
      throw new ReadFailure(false);
  }
}

@Injectable()
export class TboClient {
  private readonly logger = new Logger(TboClient.name);

  constructor(private readonly config: ConfigService<Environment, true>) {}

  /** Only side-effect-free operations are allowed here, regardless of HTTP verb. */
  async read(
    operation: TboReadOperation,
    body: Record<string, unknown>,
    deadline?: number,
  ): Promise<unknown> {
    if (!readOperations.includes(operation)) {
      throw new DomainError(
        'SUPPLIER_OPERATION_NOT_ALLOWED',
        'This supplier operation is not supported by the read client.',
        500,
      );
    }
    const baseUrl = this.config.get('TBO_BASE_URL', { infer: true });
    const username = this.config.get('TBO_USERNAME', { infer: true });
    const password = this.config.get('TBO_PASSWORD', { infer: true });
    if (
      !this.config.get('TBO_READS_ENABLED', { infer: true }) ||
      !baseUrl ||
      !username ||
      !password
    ) {
      throw new DomainError(
        'SUPPLIER_NOT_CONFIGURED',
        'Hotel inventory is unavailable until the supplier connection is configured and verified.',
        503,
      );
    }
    const retries = this.config.get('TBO_MAX_RETRIES', { infer: true });
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const remainingMs = deadline === undefined ? Infinity : deadline - Date.now();
      if (remainingMs <= 0) {
        throw new DomainError(
          'SUPPLIER_SEARCH_TIMEOUT',
          'The search took too long. Please try a more specific destination or hotel.',
          504,
        );
      }
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        Math.min(this.config.get('TBO_TIMEOUT_MS', { infer: true }), remainingMs),
      );
      let retryable = false;
      const startedAt = Date.now();
      try {
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/${operation}`, {
          method: operation === 'CountryList' ? 'GET' : 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          ...(operation === 'CountryList' ? {} : { body: JSON.stringify(body) }),
          signal: controller.signal,
          redirect: 'error',
        });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            assertSupplierStatus(operation, 401);
          }
          throw new ReadFailure([429, 500, 502, 503, 504].includes(response.status));
        }
        let payload: unknown;
        try {
          payload = await response.json();
        } catch (error: unknown) {
          if (error instanceof SyntaxError) throw invalidResponse();
          throw error;
        }
        const envelope = tboStatusSchema.safeParse(payload);
        if (!envelope.success) throw invalidResponse();
        assertSupplierStatus(operation, envelope.data.Status.Code);
        this.logger.debug({ supplier: 'TBO', operation, durationMs: Date.now() - startedAt });
        return payload;
      } catch (error: unknown) {
        retryable =
          error instanceof ReadFailure
            ? error.retryable
            : error instanceof Error && (error.name === 'AbortError' || error instanceof TypeError);
        // Do not log the upstream error/body: it can contain credentials, PII, or booking codes.
        this.logger.warn({ supplier: 'TBO', operation, attempt: attempt + 1, retryable });
        if (error instanceof DomainError) throw error;
        if (!retryable || attempt === retries) {
          throw new DomainError(
            'SUPPLIER_UNAVAILABLE',
            'The hotel supplier could not complete the request.',
            503,
          );
        }
      } finally {
        clearTimeout(timeout);
      }
      await new Promise((resolve) =>
        setTimeout(resolve, 150 * 2 ** attempt + Math.floor(Math.random() * 100)),
      );
    }
    throw new DomainError('SUPPLIER_UNAVAILABLE', 'The hotel supplier is unavailable.', 503);
  }
}
