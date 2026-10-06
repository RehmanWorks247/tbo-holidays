import { z } from 'zod';

export const occupancySnapshotSchema = z.object({
  nationality: z.string().length(2),
  rooms: z
    .array(
      z.object({
        adults: z.number().int().min(1).max(8),
        childrenAges: z.array(z.number().int().min(0).max(17)).max(4),
      }),
    )
    .min(1)
    .max(8),
});

export const customerSnapshotSchema = z.object({
  email: z.email(),
  phone: z.string().min(5).max(30),
});
