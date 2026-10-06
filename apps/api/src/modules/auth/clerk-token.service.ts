import { verifyToken } from '@clerk/backend';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DomainError } from '../../common/errors/domain-error';
import type { Environment } from '../../config/environment';

@Injectable()
export class ClerkTokenService {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  async verifySessionToken(token: string): Promise<string> {
    const secretKey = this.config.get('CLERK_SECRET_KEY', { infer: true });
    const jwtKey = this.config.get('CLERK_JWT_KEY', { infer: true });
    if (!secretKey && !jwtKey)
      throw new DomainError(
        'AUTH_NOT_CONFIGURED',
        'Authentication requires Clerk configuration.',
        503,
      );
    try {
      const payload = await verifyToken(token, {
        ...(secretKey ? { secretKey } : {}),
        ...(jwtKey ? { jwtKey } : {}),
        authorizedParties: this.config
          .get('CLERK_AUTHORIZED_PARTIES', { infer: true })
          .split(',')
          .map((origin) => origin.trim()),
      });
      if (!payload.sub || !payload.sid)
        throw new UnauthorizedException('A user session is required.');
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Your session is invalid or expired.');
    }
  }
}
