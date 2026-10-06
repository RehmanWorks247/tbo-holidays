import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import { toBookingResponse } from '../bookings/mappers/booking.mapper';

@Injectable()
export class AdminService {
  constructor(private readonly database: DatabaseService) {}

  async listBookings() {
    const bookings = await this.database.booking.findMany({
      include: { rooms: true, guests: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return bookings.map(toBookingResponse);
  }
}
