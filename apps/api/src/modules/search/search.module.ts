import { Module } from '@nestjs/common';

import { PricingModule } from '../pricing/pricing.module';
import { TboModule } from '../tbo/tbo.module';
import { SearchService } from './search.service';

@Module({
  imports: [PricingModule, TboModule],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
