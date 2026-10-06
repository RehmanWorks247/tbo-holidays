import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import type { UsersService } from '../users/users.service';
import { AuthGuard } from './auth.guard';
import type { ClerkTokenService } from './clerk-token.service';

function context(headers: Record<string, string> = {}): ExecutionContext {
  const request = { headers };
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}
describe('API session guard', () => {
  it('rejects missing credentials before attempting a database write', async () => {
    const resolveClerkUser = vi.fn();
    const guard = new AuthGuard(
      new Reflector(),
      {} as ClerkTokenService,
      { resolveClerkUser } as unknown as UsersService,
    );
    await expect(guard.canActivate(context())).rejects.toThrow('Sign in');
    expect(resolveClerkUser).not.toHaveBeenCalled();
  });
  it('does not provision an internal user for an invalid token', async () => {
    const resolveClerkUser = vi.fn();
    const guard = new AuthGuard(
      new Reflector(),
      {
        verifySessionToken: vi.fn().mockRejectedValue(new Error('Invalid')),
      } as unknown as ClerkTokenService,
      { resolveClerkUser } as unknown as UsersService,
    );
    await expect(guard.canActivate(context({ authorization: 'Bearer invalid' }))).rejects.toThrow(
      'Invalid',
    );
    expect(resolveClerkUser).not.toHaveBeenCalled();
  });
  it('takes the admin role from the internal record rather than browser fields', async () => {
    const reflector = new Reflector();
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['ADMIN']);
    const guard = new AuthGuard(
      reflector,
      {
        verifySessionToken: vi.fn().mockResolvedValue('clerk-user'),
      } as unknown as ClerkTokenService,
      {
        resolveClerkUser: vi
          .fn()
          .mockResolvedValue({ id: 'internal', clerkId: 'clerk-user', role: 'USER' }),
      } as unknown as UsersService,
    );
    await expect(guard.canActivate(context({ authorization: 'Bearer valid' }))).rejects.toThrow(
      'access',
    );
  });
});
