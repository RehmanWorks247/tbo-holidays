import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { UsersModule } from '../users/users.module';
import { AuthGuard } from './auth.guard';
import { ClerkTokenService } from './clerk-token.service';

@Module({
  imports: [UsersModule],
  providers: [ClerkTokenService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
