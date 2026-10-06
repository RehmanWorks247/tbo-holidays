import { Controller, Get } from '@nestjs/common';

import { Public } from '../common/decorators/public.decorator';
import { DomainError } from '../common/errors/domain-error';
import { DatabaseService } from '../database/database.service';
import { RedisService } from './redis/redis.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {}
  @Get('live')
  live() {
    return { status: 'ok' };
  }
  @Get('ready')
  async ready() {
    try {
      await Promise.all([this.database.$queryRaw`SELECT 1`, this.redis.client.ping()]);
    } catch {
      throw new DomainError('NOT_READY', 'A required dependency is unavailable.', 503);
    }
    return { status: 'ok' };
  }
}
