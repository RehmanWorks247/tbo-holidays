import type { UpdateProfileRequest, UserResponse } from '@hotel/contracts';
import { Injectable } from '@nestjs/common';

import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}

  async resolveClerkUser(clerkId: string): Promise<AuthenticatedUser> {
    return this.database.user.upsert({
      where: { clerkId },
      create: { clerkId },
      update: {},
      select: { id: true, clerkId: true, role: true },
    });
  }

  async getProfile(user: AuthenticatedUser): Promise<UserResponse> {
    const profile = await this.database.customerProfile.findUnique({ where: { userId: user.id } });
    return {
      ...user,
      profile: profile
        ? {
            firstName: profile.firstName,
            lastName: profile.lastName,
            ...(profile.phone ? { phone: profile.phone } : {}),
            ...(profile.nationality ? { nationality: profile.nationality } : {}),
          }
        : null,
    };
  }

  async updateProfile(user: AuthenticatedUser, input: UpdateProfileRequest): Promise<UserResponse> {
    await this.database.customerProfile.upsert({
      where: { userId: user.id },
      create: { ...input, userId: user.id },
      update: input,
    });
    return this.getProfile(user);
  }
}
