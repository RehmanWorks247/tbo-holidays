import type { CheckoutRequest } from '@hotel/contracts';
import { checkoutRequestSchema } from '@hotel/contracts';
import type { RawBodyRequest } from '@nestjs/common';
import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('checkout')
  checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(checkoutRequestSchema)) request: CheckoutRequest,
  ) {
    return this.payments.checkout(user.id, request);
  }

  @Public()
  @HttpCode(200)
  @Post('webhooks/:provider')
  webhook(@Param('provider') provider: string, @Req() request: RawBodyRequest<Request>) {
    return this.payments.webhook(provider, request.rawBody, request.headers);
  }
}
