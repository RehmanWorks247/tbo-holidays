import { z } from 'zod';

export const currencySchema = z.enum(['USD', 'EUR', 'GBP', 'AED', 'PKR', 'INR']);
export const amountSchema = z.number().int().min(0).max(2_000_000_000);
export const priceBreakdownSchema = z.object({
  currency: currencySchema,
  baseAmount: amountSchema,
  taxAmount: amountSchema,
  feeAmount: amountSchema,
  markupAmount: amountSchema,
  discountAmount: amountSchema,
  totalAmount: amountSchema,
});
export type PriceBreakdown = z.infer<typeof priceBreakdownSchema>;
export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
export interface ApiResponse<T> {
  data: T;
  requestId: string;
}
export const apiResponseSchema = <T extends z.ZodType>(schema: T) =>
  z.object({ data: schema, requestId: z.string() });
