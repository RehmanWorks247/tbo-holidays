import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger, PinoLogger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import type { Environment } from './config/environment';
import { runtimeConfig } from './config/runtime-config';
import { MockAppModule } from './mock-app.module';

async function bootstrap(): Promise<void> {
  await runtimeConfig;
  const app = await NestFactory.create(
    process.env.HOTEL_DATA_MODE === 'mock' ? MockAppModule : AppModule,
    { bufferLogs: true, rawBody: true },
  );
  const config = app.get(ConfigService<Environment, true>);
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({
    origin: config.get('WEB_ORIGIN', { infer: true }),
    credentials: false,
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Request-Id'],
  });
  app.useGlobalFilters(new ApiExceptionFilter(await app.resolve(PinoLogger)));
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.enableShutdownHooks();
  await app.listen(config.get('PORT', { infer: true }), config.get('HOST', { infer: true }));
}

bootstrap().catch(() => {
  // Never print initialization errors that may include connection secrets.
  process.stderr.write(
    'API startup failed. Check environment validation and dependency readiness.\n',
  );
  process.exitCode = 1;
});
