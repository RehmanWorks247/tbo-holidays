import { Module } from '@nestjs/common';

import { CurrencyService } from './currency.service';
import { MarkupService } from './markup.service';
import { PricingService } from './pricing.service';

@Module({
  providers: [CurrencyService, MarkupService, PricingService],
  exports: [CurrencyService, PricingService],
})
export class PricingModule {}
