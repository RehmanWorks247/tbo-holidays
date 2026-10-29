import {
  type HotelCatalogQuery,
  hotelCatalogQuerySchema,
  type HotelSuggestionsQuery,
  hotelSuggestionsQuerySchema,
  type RecheckRequest,
  recheckRequestSchema,
} from '@hotel/contracts';
import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { MockSearchService } from '../search/mock-search.service';
import { hotelSearchQuerySchema, mockHotelSearchQuerySchema } from '../search/search.schemas';
import { SearchService } from '../search/search.service';
import { HotelsService } from './hotels.service';

@Controller('hotels')
export class HotelsController {
  constructor(
    private readonly hotels: HotelsService,
    @Inject(SearchService) private readonly search: SearchService | MockSearchService,
  ) {}

  @Public()
  @Get('destinations')
  getDestinations() {
    return this.hotels.getDestinations();
  }

  @Public()
  @Get('suggestions')
  getSuggestions(
    @Query(new ZodValidationPipe(hotelSuggestionsQuerySchema)) query: HotelSuggestionsQuery,
  ) {
    return this.hotels.getSuggestions(query);
  }

  @Public()
  @Get('catalog')
  browseHotels(@Query(new ZodValidationPipe(hotelCatalogQuerySchema)) query: HotelCatalogQuery) {
    return this.hotels.browseHotels(query);
  }

  @Public()
  @Get('search')
  searchHotels(@Query() query: unknown) {
    if (this.search instanceof MockSearchService) {
      const input = new ZodValidationPipe(mockHotelSearchQuerySchema).transform(query);
      return this.search.searchHotels(input);
    }
    const input = new ZodValidationPipe(hotelSearchQuerySchema).transform(query);
    return this.search.searchHotels(input);
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
