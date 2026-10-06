import 'server-only';

import { z } from 'zod';

import { publicEnvironment } from '@/config/env';

const serverEnvironmentSchema = z.object({
  clerkSecretKey: z
    .string()
    .regex(/^sk_(test|live)_/)
    .optional(),
});

export function getServerEnvironment() {
  const result = serverEnvironmentSchema.safeParse({
    clerkSecretKey: process.env.CLERK_SECRET_KEY || undefined,
  });
  if (!result.success) throw new Error('Invalid web server environment: check CLERK_SECRET_KEY.');
  return {
    authEnabled: Boolean(publicEnvironment.clerkPublishableKey && result.data.clerkSecretKey),
  };
}
