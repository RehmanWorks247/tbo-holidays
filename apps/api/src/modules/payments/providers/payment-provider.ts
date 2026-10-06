export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface CreatePaymentInput {
  paymentId: string;
  bookingId: string;
  idempotencyKey: string;
  amount: number;
  currency: string;
}

export interface VerifiedPaymentEvent {
  id: string;
  paymentId: string;
  providerPaymentId: string;
  type: 'payment.succeeded' | 'payment.failed';
  amount: number;
  currency: string;
}

// Adapters must verify a signature over the original raw bytes, enforce the
// provider's replay/timestamp policy, and only then return normalized events.
export interface PaymentProvider {
  readonly name: string;
  assertConfigured(): void;
  createPayment(input: CreatePaymentInput): Promise<{
    providerPaymentId: string;
    redirectUrl: string;
    expiresAt: Date;
  }>;
  verifyWebhook(
    rawBody: Buffer,
    headers: Readonly<Record<string, string | string[] | undefined>>,
  ): Promise<VerifiedPaymentEvent>;
  verifyPayment(providerPaymentId: string): Promise<{
    providerPaymentId: string;
    paymentId: string;
    amount: number;
    currency: string;
    status: 'pending' | 'succeeded' | 'failed';
  }>;
  refundPayment(input: {
    providerPaymentId: string;
    amount: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<{ providerRefundId: string; status: 'pending' | 'succeeded' }>;
}
