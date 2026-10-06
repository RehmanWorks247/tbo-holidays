import type { CreateBookingRequest, UpdateBookingGuestsRequest } from '@hotel/contracts';
import { createBookingRequestSchema, updateBookingGuestsRequestSchema } from '@hotel/contracts';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { BookingsService } from './bookings.service';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createBookingRequestSchema)) request: CreateBookingRequest,
  ) {
    return this.bookings.createIntent(user.id, request);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.bookings.list(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.get(user.id, id);
  }

  @Patch(':id/guests')
  updateGuests(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateBookingGuestsRequestSchema))
    request: UpdateBookingGuestsRequest,
  ) {
    return this.bookings.updateGuests(user.id, id, request);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.cancel(user.id, id);
  }
}
