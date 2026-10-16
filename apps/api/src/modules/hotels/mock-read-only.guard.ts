import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC } from '../../common/decorators/public.decorator';
import { rejectMockBooking } from './mock-hotel.supplier';

/** Preview has no authenticated capabilities: protected routes are always denied. */
@Injectable()
export class MockReadOnlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    return rejectMockBooking();
  }
}
