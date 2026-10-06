import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DomainError } from '../../common/errors/domain-error';
import type { Environment } from '../../config/environment';
import { assertMinorAmount } from './currency.service';

@Injectable()
export class MarkupService {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  calculate(baseAmount: number): number {
    assertMinorAmount(baseAmount);
    const basisPoints = this.config.get('MARKUP_BASIS_POINTS', { infer: true });
    if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
      throw new DomainError('INVALID_MARKUP', 'The configured markup is invalid.', 500);
    }
    // Round half up once, using integer arithmetic. Markup applies to base only.
    const markup = Number((BigInt(baseAmount) * BigInt(basisPoints) + 5_000n) / 10_000n);
    assertMinorAmount(markup);
    return markup;
  }
}
