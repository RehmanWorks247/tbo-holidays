import { Controller, Get } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';

@Controller('admin')
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('bookings')
  bookings() {
    return this.admin.listBookings();
  }
}
