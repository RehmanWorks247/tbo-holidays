import { type UpdateProfileRequest, updateProfileRequestSchema } from '@hotel/contracts';
import { Body, Controller, Get, Patch } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getProfile(user);
  }
  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileRequestSchema)) input: UpdateProfileRequest,
  ) {
    return this.users.updateProfile(user, input);
  }
}
