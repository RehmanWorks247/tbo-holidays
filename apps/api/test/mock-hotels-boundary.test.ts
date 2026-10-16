import { hotelDestinationsResponseSchema, hotelSearchResponseSchema } from '@hotel/contracts';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { LoggerModule, type PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ApiResponseInterceptor } from '../src/common/interceptors/api-response.interceptor';
import type { Environment } from '../src/config/environment';
import { loggingOptions } from '../src/config/logging';
import { DatabaseService } from '../src/database/database.service';
import { HOTEL_SUPPLIER } from '../src/modules/hotels/hotel-supplier';
import { HotelsController } from '../src/modules/hotels/hotels.controller';
import { HotelsService } from '../src/modules/hotels/hotels.service';
import { MockHotelSupplier } from '../src/modules/hotels/mock-hotel.supplier';
import { MockReadOnlyGuard } from '../src/modules/hotels/mock-read-only.guard';
import { MockSearchService } from '../src/modules/search/mock-search.service';
import { SearchService } from '../src/modules/search/search.service';
import { createMockHotelDatabase } from './mock-hotel-database.fixture';

describe('preview hotel HTTP boundaries', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: loggingOptions('silent') })],
      controllers: [HotelsController],
      providers: [
        { provide: DatabaseService, useValue: createMockHotelDatabase().database },
        {
          provide: ConfigService,
          useValue: new ConfigService<Environment, true>({
            HOTEL_DATA_MODE: 'mock',
            NODE_ENV: 'test',
            MAX_STAY_NIGHTS: 30,
          }),
        },
        MockHotelSupplier,
        { provide: HOTEL_SUPPLIER, useExisting: MockHotelSupplier },
        MockSearchService,
        { provide: SearchService, useExisting: MockSearchService },
        HotelsService,
        { provide: APP_GUARD, useClass: MockReadOnlyGuard },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ApiExceptionFilter({ error: vi.fn() } as unknown as PinoLogger));
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('discovers preview destinations through the real public controller with request IDs', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/hotels/destinations')
      .expect(200);
    const data = hotelDestinationsResponseSchema.parse(response.body.data);
    expect(data.source).toBe('mock');
    expect(data.destinations.map(({ id }) => id)).toEqual(['dubai', 'london', 'antalya', 'bali']);
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
  });

  it('validates query filters, sorts and paginates server responses over HTTP', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/hotels/search')
      .query({
        destination: 'dubai',
        checkIn: '2100-01-01',
        checkOut: '2100-01-08',
        nationality: 'GB',
        currency: 'GBP',
        rooms: JSON.stringify([{ adults: 2, childrenAges: [] }]),
        filters: JSON.stringify({ starRatings: [5], refundable: true }),
        sort: 'price-asc',
        page: '1',
        pageSize: '3',
      })
      .expect(200);
    const data = hotelSearchResponseSchema.parse(response.body.data);
    expect(data.hotels).toHaveLength(3);
    expect(data.metadata?.total).toBeGreaterThan(3);
    expect(
      data.hotels.every(
        ({ hotel, rates }) => hotel.starRating === 5 && rates.every(({ refundable }) => refundable),
      ),
    ).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain('supplierRateId');
  });

  it('returns detail content and a normalized error for unknown IDs', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/hotels/mock-dubai-01')
      .expect(200);
    expect(response.body.data).toMatchObject({ source: 'mock', id: 'mock-dubai-01' });
    const missing = await request(app.getHttpServer())
      .get('/api/v1/hotels/mock-missing')
      .expect(404);
    expect(missing.body.code).toBe('HOTEL_NOT_FOUND');
  });

  it('denies quote creation with and without credentials and mounts no payment or booking routes', async () => {
    for (const authorization of ['', 'Bearer arbitrary-token']) {
      const denied = await request(app.getHttpServer())
        .post('/api/v1/hotels/recheck')
        .set('Authorization', authorization)
        .send({ rateId: 'mock:test' })
        .expect(409);
      expect(denied.body.code).toBe('MOCK_BOOKING_DISABLED');
    }
    await request(app.getHttpServer()).post('/api/v1/bookings').send({}).expect(404);
    await request(app.getHttpServer()).post('/api/v1/payments/checkout').send({}).expect(404);
  });
});
