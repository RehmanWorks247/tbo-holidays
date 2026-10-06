import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  clerkId: string;
  role: 'USER' | 'ADMIN';
}
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  id: string;
}
