import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC } from '../../common/decorators/public.decorator';
import { REQUIRED_ROLES } from '../../common/decorators/roles.decorator';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../../common/types/authenticated-request';
import { UsersService } from '../users/users.service';
import { ClerkTokenService } from './clerk-token.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: ClerkTokenService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ') || authorization.length > 16000)
      throw new UnauthorizedException('Sign in to continue.');
    const clerkId = await this.tokens.verifySessionToken(authorization.slice(7));
    request.user = await this.users.resolveClerkUser(clerkId);
    const roles = this.reflector.getAllAndOverride<AuthenticatedUser['role'][]>(REQUIRED_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles?.length && !roles.includes(request.user.role))
      throw new ForbiddenException('You do not have access to this resource.');
    return true;
  }
}
