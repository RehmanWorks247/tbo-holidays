import { Injectable } from '@nestjs/common';

import { DomainError } from '../../../common/errors/domain-error';
import type { PaymentProvider, VerifiedPaymentEvent } from './payment-provider';

@Injectable()
export class DisabledPaymentProvider implements PaymentProvider {
  readonly name = 'disabled';

  assertConfigured(): never {
    throw new DomainError(
      'PAYMENT_NOT_CONFIGURED',
      'Payments are not configured. No charge has been made.',
      503,
    );
  }

  async createPayment(): Promise<never> {
    return this.assertConfigured();
  }
  async verifyWebhook(): Promise<VerifiedPaymentEvent> {
    return this.assertConfigured();
  }
  async verifyPayment(): Promise<never> {
    return this.assertConfigured();
  }
  async refundPayment(): Promise<never> {
    return this.assertConfigured();
  }
}
