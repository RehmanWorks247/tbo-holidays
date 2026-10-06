import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../common/errors/domain-error';
import type { DatabaseService } from '../../database/database.service';
import { PaymentsService } from './payments.service';
import { DisabledPaymentProvider } from './providers/disabled-payment.provider';
import type { PaymentProvider } from './providers/payment-provider';

describe('payment trust boundary', () => {
  it('rejects disabled checkout without creating a payment', async () => {
    const database = { $transaction: vi.fn() };
    const service = new PaymentsService(
      database as unknown as DatabaseService,
      new DisabledPaymentProvider(),
    );
    await expect(
      service.checkout('user', { bookingId: 'booking', idempotencyKey: 'key' }),
    ).rejects.toMatchObject({ code: 'PAYMENT_NOT_CONFIGURED' });
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('never reads or mutates persistence before authenticating the raw webhook', async () => {
    const database = { $transaction: vi.fn() };
    const verifyWebhook = vi
      .fn()
      .mockRejectedValue(new DomainError('INVALID_WEBHOOK_SIGNATURE', 'Invalid signature.', 401));
    const provider: PaymentProvider = {
      name: 'test',
      assertConfigured: vi.fn(),
      verifyWebhook,
      createPayment: vi.fn(),
      verifyPayment: vi.fn(),
      refundPayment: vi.fn(),
    };
    const service = new PaymentsService(database as unknown as DatabaseService, provider);
    const rawBody = Buffer.from('{"payment":"untrusted"}');
    const headers = { 'test-signature': 'invalid' };
    await expect(service.webhook('test', rawBody, headers)).rejects.toMatchObject({
      code: 'INVALID_WEBHOOK_SIGNATURE',
    });
    expect(verifyWebhook).toHaveBeenCalledWith(rawBody, headers);
    expect(database.$transaction).not.toHaveBeenCalled();
  });
});
