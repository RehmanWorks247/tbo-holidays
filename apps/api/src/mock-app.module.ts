import { Module, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import type { Environment } from './config/environment';
import { loggingOptions } from './config/logging';
import { runtimeConfig } from './config/runtime-config';
import { DatabaseModule } from './database/database.module';
import { HOTEL_SUPPLIER } from './modules/hotels/hotel-supplier';
import { HotelsController } from './modules/hotels/hotels.controller';
import { HotelsService } from './modules/hotels/hotels.service';
import { MockHotelSupplier } from './modules/hotels/mock-hotel.supplier';
import { MockReadOnlyGuard } from './modules/hotels/mock-read-only.guard';
import { MockSearchService } from './modules/search/mock-search.service';
import { SearchService } from './modules/search/search.service';

/** Reuses production transport and PostgreSQL; deliberately omits Redis and mutation modules. */
@Module({
  imports: [
    runtimeConfig,
    DatabaseModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        pinoHttp: loggingOptions(config.get('LOG_LEVEL', { infer: true })),
        forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
  ],
  controllers: [HotelsController],
  providers: [
    MockHotelSupplier,
    { provide: HOTEL_SUPPLIER, useExisting: MockHotelSupplier },
    MockSearchService,
    { provide: SearchService, useExisting: MockSearchService },
    HotelsService,
    { provide: APP_GUARD, useClass: MockReadOnlyGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class MockAppModule {}
