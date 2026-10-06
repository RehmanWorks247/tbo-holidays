import {
  type HotelSearchRequest,
  type RecheckRequest,
  recheckRequestSchema,
} from '@hotel/contracts';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { hotelSearchQuerySchema } from '../search/search.schemas';
import { SearchService } from '../search/search.service';
import { HotelsService } from './hotels.service';

@Controller('hotels')
export class HotelsController {
  constructor(
    private readonly hotels: HotelsService,
    private readonly search: SearchService,
  ) {}

  @Public()
  @Get('search')
  searchHotels(@Query(new ZodValidationPipe(hotelSearchQuerySchema)) query: HotelSearchRequest) {
    return this.search.searchHotels(query);
  }

  @Post('recheck')
  recheckHotelRate(
    @Body(new ZodValidationPipe(recheckRequestSchema)) body: RecheckRequest,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return this.search.recheckHotelRate(body.rateId, user.id);
  }

  @Public()
  @Get(':id')
  getHotelDetails(@Param('id') id: string) {
    return this.hotels.getHotelDetails(id);
  }
}
