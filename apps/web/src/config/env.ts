import { z } from 'zod';

const optionalKey = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z
    .string()
    .regex(/^pk_(test|live)_/, 'Use a Clerk publishable key')
    .optional(),
);

export const publicEnvironmentSchema = z.object({
  apiUrl: z.url().default('http://localhost:4000/api/v1'),
  maxStayNights: z.coerce.number().int().min(1).max(90).default(30),
  clerkPublishableKey: optionalKey,
});

// Explicit property access allows Next.js to replace public variables at build time.
export const publicEnvironment = publicEnvironmentSchema.parse({
  apiUrl: process.env.NEXT_PUBLIC_API_URL || undefined,
  maxStayNights: process.env.NEXT_PUBLIC_MAX_STAY_NIGHTS || undefined,
  clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});
