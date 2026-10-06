import { Module } from '@nestjs/common';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { DisabledPaymentProvider } from './providers/disabled-payment.provider';
import { PAYMENT_PROVIDER } from './providers/payment-provider';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, { provide: PAYMENT_PROVIDER, useClass: DisabledPaymentProvider }],
  exports: [PaymentsService],
})
export class PaymentsModule {}
