import { z } from 'zod';

export const updateProfileRequestSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(5).max(30).optional(),
    nationality: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
  })
  .strict();
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
export const userResponseSchema = z.object({
  id: z.uuid(),
  clerkId: z.string(),
  role: z.enum(['USER', 'ADMIN']),
  profile: updateProfileRequestSchema.nullable(),
});
export type UserResponse = z.infer<typeof userResponseSchema>;
