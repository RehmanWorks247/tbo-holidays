import { Module } from '@nestjs/common';

import { BookingsModule } from '../modules/bookings/bookings.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { JobsService } from './jobs.service';

@Module({ imports: [BookingsModule, NotificationsModule], providers: [JobsService] })
export class JobsModule {}
