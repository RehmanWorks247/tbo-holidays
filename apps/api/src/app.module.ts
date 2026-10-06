import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { type Environment, validateEnvironment } from './config/environment';
import { loggingOptions } from './config/logging';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './infrastructure/health.controller';
import { RedisModule } from './infrastructure/redis/redis.module';
import { JobsModule } from './jobs/jobs.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { HotelsModule } from './modules/hotels/hotels.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnvironment,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        pinoHttp: loggingOptions(config.get('LOG_LEVEL', { infer: true })),
        forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    DatabaseModule,
    RedisModule,
    AuthModule,
    UsersModule,
    HotelsModule,
    BookingsModule,
    PaymentsModule,
    AdminModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
