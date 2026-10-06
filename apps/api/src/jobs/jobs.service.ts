import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { Queue, Worker } from 'bullmq';
import type Redis from 'ioredis';
import { PinoLogger } from 'nestjs-pino';

import { DomainError } from '../common/errors/domain-error';
import type { Environment } from '../config/environment';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../infrastructure/redis/redis.service';
import { BookingFulfillmentService } from '../modules/bookings/booking-fulfillment.service';
import { NotificationsService } from '../modules/notifications/notifications.service';

interface OutboxJob {
  eventId: string;
}

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private queue?: Queue<OutboxJob>;
  private worker?: Worker<OutboxJob>;
  private workerConnection?: Redis;
  private interval?: NodeJS.Timeout;
  private publishing = false;

  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    private readonly fulfillment: BookingFulfillmentService,
    private readonly notifications: NotificationsService,
    private readonly logger: PinoLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.get('JOBS_ENABLED', { infer: true })) return;
    this.queue = new Queue<OutboxJob>('hotel-workflow', { connection: this.redis.client });
    this.workerConnection = this.redis.client.duplicate({ maxRetriesPerRequest: null });
    this.worker = new Worker<OutboxJob>('hotel-workflow', (job) => this.process(job), {
      connection: this.workerConnection,
      concurrency: 4,
    });
    this.worker.on('error', () =>
      this.logger.error({ operation: 'workflow-worker' }, 'Workflow worker unavailable'),
    );
    this.worker.on('failed', (job) =>
      this.logger.warn(
        { operation: 'workflow-job', jobId: job?.id },
        'Workflow job deferred; inspect durable outbox',
      ),
    );
    this.interval = setInterval(() => {
      void this.publishPending();
    }, 5_000);
    this.interval.unref();
    await this.publishPending();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.interval) clearInterval(this.interval);
    await this.worker?.close();
    await this.queue?.close();
    this.workerConnection?.disconnect();
  }

  private async publishPending(): Promise<void> {
    if (this.publishing || !this.queue) return;
    this.publishing = true;
    try {
      const events = await this.database.outboxEvent.findMany({
        where: { completedAt: null, availableAt: { lte: new Date() }, attempts: { lt: 8 } },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
      for (const event of events) {
        await this.queue.add(
          event.kind,
          { eventId: event.id },
          {
            jobId: event.id,
            attempts: 1,
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
      }
    } catch {
      this.logger.error(
        { operation: 'outbox-publish' },
        'Pending workflow events remain in the database for retry',
      );
    } finally {
      this.publishing = false;
    }
  }

  private async process(job: Job<OutboxJob>): Promise<void> {
    const event = await this.database.outboxEvent.findUniqueOrThrow({
      where: { id: job.data.eventId },
    });
    if (event.completedAt) return;
    try {
      switch (event.kind) {
        case 'BOOKING_FULFILLMENT':
          await this.fulfillment.fulfill(event.aggregateId);
          break;
        case 'BOOKING_STATUS_CHECK':
          await this.fulfillment.reconcile(event.aggregateId);
          break;
        case 'BOOKING_CONFIRMATION_EMAIL':
          await this.notifications.sendBookingConfirmation(event.aggregateId);
          break;
        case 'PAYMENT_RECONCILIATION': {
          const payment = await this.database.payment.findUniqueOrThrow({
            where: { id: event.aggregateId },
          });
          if (payment.status !== 'PAYMENT_PENDING' && !payment.requiresReconciliation) break;
          // Gateway reconciliation needs provider-specific metadata lookup and
          // authoritative amount/currency verification before emitting an event.
          throw new DomainError(
            'PAYMENT_RECONCILIATION_NOT_CONFIGURED',
            'Payment reconciliation requires a configured gateway adapter.',
            503,
          );
        }
        case 'REFUND_PROCESSING':
          throw new DomainError(
            'REFUNDS_NOT_CONFIGURED',
            'Refund requires a configured gateway adapter and confirmed provider outcome.',
            503,
          );
      }
      await this.database.outboxEvent.update({
        where: { id: event.id },
        data: { completedAt: new Date(), lastError: null },
      });
    } catch (error) {
      const code = error instanceof DomainError ? error.code : 'JOB_FAILED';
      await this.database.outboxEvent.update({
        where: { id: event.id },
        data: {
          attempts: { increment: 1 },
          lastError: code,
          availableAt: new Date(Date.now() + Math.min(3_600_000, 30_000 * 2 ** event.attempts)),
        },
      });
      // Store/log codes only. Provider exception messages can contain credentials or PII.
      throw new Error(code);
    }
  }
}
