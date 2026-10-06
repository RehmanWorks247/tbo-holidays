import { type CreateBookingRequest, createBookingRequestSchema } from '@hotel/contracts';
import {
  Body,
  Controller,
  Get,
  type INestApplication,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { LoggerModule, type PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { CurrentUser } from '../src/common/decorators/current-user.decorator';
import { Public } from '../src/common/decorators/public.decorator';
import { Roles } from '../src/common/decorators/roles.decorator';
import { DomainError } from '../src/common/errors/domain-error';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ApiResponseInterceptor } from '../src/common/interceptors/api-response.interceptor';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../src/common/types/authenticated-request';
import { loggingOptions } from '../src/config/logging';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { ClerkTokenService } from '../src/modules/auth/clerk-token.service';
import { UsersService } from '../src/modules/users/users.service';

const quoteId = 'c6c65d38-3fa0-490d-b27c-1a2769c6960a';
const idempotencyKey = '2b25aef9-4d4e-4422-9aa4-bdd6b6c5db0a';
const user: AuthenticatedUser = {
  id: '6932a9a2-3b85-4619-b140-4be3301369b5',
  clerkId: 'clerk-test-user',
  role: 'USER',
};
const acceptBooking = vi.fn((input: CreateBookingRequest, currentUser: AuthenticatedUser) => ({
  quoteId: input.quoteId,
  userId: currentUser.id,
}));
const logError = vi.fn();
const verifySessionToken = vi.fn(async (token: string) => {
  if (token !== 'valid-test-session')
    throw new UnauthorizedException('Your session is invalid or expired.');
  return user.clerkId;
});
const resolveClerkUser = vi.fn(async () => user);

@Controller('boundary')
class BoundaryController {
  @Public()
  @Get('public')
  publicEndpoint() {
    return { ready: true };
  }

  @Post('booking')
  booking(
    @Body(new ZodValidationPipe(createBookingRequestSchema)) body: CreateBookingRequest,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return acceptBooking(body, currentUser);
  }

  @Roles('ADMIN')
  @Get('admin')
  admin() {
    return { permitted: true };
  }

  @Public()
  @Get('domain-error')
  domainError(): never {
    throw new DomainError('HOTEL_RATE_CHANGED', 'Recheck the latest room price.', 409);
  }

  @Public()
  @Get('unknown-error')
  unknownError(): never {
    throw new Error('upstream-password=never-expose-this; guest=private-person');
  }
}

describe('HTTP API boundaries', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: loggingOptions('silent') })],
      controllers: [BoundaryController],
      providers: [
        { provide: ClerkTokenService, useValue: { verifySessionToken } },
        { provide: UsersService, useValue: { resolveClerkUser } },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ApiExceptionFilter({ error: logError } as unknown as PinoLogger));
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('generates correlation IDs and wraps public success without requiring a token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/boundary/public')
      .set('X-Request-Id', 'untrusted-client-id')
      .expect(200);
    expect(response.body).toEqual({
      data: { ready: true },
      requestId: response.headers['x-request-id'],
    });
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers['x-request-id']).not.toBe('untrusted-client-id');
    expect(verifySessionToken).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated access before validation or domain work', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/boundary/booking')
      .send({ quoteId, idempotencyKey })
      .expect(401);
    expect(response.body).toMatchObject({
      code: 'UNAUTHENTICATED',
      requestId: response.headers['x-request-id'],
    });
    expect(verifySessionToken).not.toHaveBeenCalled();
    expect(acceptBooking).not.toHaveBeenCalled();
  });

  it('rejects browser prices even with a valid session', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/boundary/booking')
      .set('Authorization', 'Bearer valid-test-session')
      .send({ quoteId, idempotencyKey, totalAmount: 1, currency: 'USD' })
      .expect(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Check the request fields.',
      requestId: response.headers['x-request-id'],
    });
    expect(acceptBooking).not.toHaveBeenCalled();
  });

  it('passes only validated identifiers and the server-resolved user into domain work', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/boundary/booking')
      .set('Authorization', 'Bearer valid-test-session')
      .send({ quoteId, idempotencyKey })
      .expect(201);
    expect(response.body).toMatchObject({ data: { quoteId, userId: user.id } });
    expect(verifySessionToken).toHaveBeenCalledWith('valid-test-session');
    expect(resolveClerkUser).toHaveBeenCalledWith(user.clerkId);
    expect(acceptBooking).toHaveBeenCalledWith({ quoteId, idempotencyKey }, user);
  });

  it('uses the server role to reject a non-admin session', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/boundary/admin')
      .set('Authorization', 'Bearer valid-test-session')
      .expect(403);
    expect(response.body).toMatchObject({
      code: 'FORBIDDEN',
      requestId: response.headers['x-request-id'],
    });
  });

  it('preserves public domain errors and hides unknown provider details in responses and logs', async () => {
    const domain = await request(app.getHttpServer())
      .get('/api/v1/boundary/domain-error')
      .expect(409);
    expect(domain.body).toMatchObject({
      code: 'HOTEL_RATE_CHANGED',
      message: 'Recheck the latest room price.',
    });
    const unknown = await request(app.getHttpServer())
      .get('/api/v1/boundary/unknown-error')
      .expect(500);
    expect(unknown.body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      requestId: unknown.headers['x-request-id'],
    });
    expect(JSON.stringify(unknown.body)).not.toContain('never-expose-this');
    expect(JSON.stringify(logError.mock.calls)).not.toContain('never-expose-this');
    expect(JSON.stringify(logError.mock.calls)).not.toContain('private-person');
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: unknown.headers['x-request-id'], errorType: 'Error' }),
      'Unhandled request failure',
    );
  });

  it('rejects malformed JSON as a client error without invoking domain work', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/boundary/booking')
      .set('Authorization', 'Bearer valid-test-session')
      .set('Content-Type', 'application/json')
      .send('{private-person-never-echo-this')
      .expect(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.message).toBe('The request is invalid.');
    expect(JSON.stringify(response.body)).not.toContain('private-person-never-echo-this');
    expect(JSON.stringify(logError.mock.calls)).not.toContain('private-person-never-echo-this');
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(acceptBooking).not.toHaveBeenCalled();
  });
});
