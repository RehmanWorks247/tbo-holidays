import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PinoLogger } from 'nestjs-pino';

import type { Environment } from '../../config/environment';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly client: Redis;
  constructor(config: ConfigService<Environment, true>, logger: PinoLogger) {
    this.client = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      retryStrategy: (attempt) => Math.min(attempt * 250, 5000),
    });
    this.client.on('error', () =>
      logger.error({ operation: 'redis-connection' }, 'Redis connection unavailable'),
    );
  }
  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }
  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}
