import { SetMetadata } from '@nestjs/common';

import type { AuthenticatedUser } from '../types/authenticated-request';

export const REQUIRED_ROLES = 'requiredRoles';
export const Roles = (...roles: AuthenticatedUser['role'][]) => SetMetadata(REQUIRED_ROLES, roles);
