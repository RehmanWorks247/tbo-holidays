import { Module } from '@nestjs/common';

import { HOTEL_SUPPLIER } from '../hotels/hotel-supplier';
import { PricingModule } from '../pricing/pricing.module';
import { TboClient } from './tbo.client';
import { TboService } from './tbo.service';

@Module({
  imports: [PricingModule],
  providers: [TboClient, TboService, { provide: HOTEL_SUPPLIER, useExisting: TboService }],
  exports: [HOTEL_SUPPLIER],
})
export class TboModule {}
