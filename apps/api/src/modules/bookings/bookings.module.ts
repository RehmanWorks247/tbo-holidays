import { Module } from '@nestjs/common';

import { CustomersModule } from '../customers/customers.module';
import { TboModule } from '../tbo/tbo.module';
import { BookingFulfillmentService } from './booking-fulfillment.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [CustomersModule, TboModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingFulfillmentService],
  exports: [BookingsService, BookingFulfillmentService],
})
export class BookingsModule {}
