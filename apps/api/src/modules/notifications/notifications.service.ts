import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error';

@Injectable()
export class NotificationsService {
  // A production email adapter must use bookingId as its send idempotency key.
  // Throwing preserves the outbox instead of recording a message that was never sent.
  async sendBookingConfirmation(_bookingId: string): Promise<never> {
    throw new DomainError(
      'NOTIFICATIONS_NOT_CONFIGURED',
      'Configure a transactional email adapter before enabling confirmation delivery.',
      503,
    );
  }
}
