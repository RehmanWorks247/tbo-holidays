import { Module } from '@nestjs/common';

import { SearchModule } from '../search/search.module';
import { TboModule } from '../tbo/tbo.module';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';

@Module({
  imports: [SearchModule, TboModule],
  controllers: [HotelsController],
  providers: [HotelsService],
  exports: [HotelsService, TboModule],
})
export class HotelsModule {}
