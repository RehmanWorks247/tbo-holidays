import { type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

import { DomainError } from '../errors/domain-error';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}
  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success)
      throw new DomainError('VALIDATION_ERROR', 'Check the request fields.', 400, {
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    return result.data;
  }
}
