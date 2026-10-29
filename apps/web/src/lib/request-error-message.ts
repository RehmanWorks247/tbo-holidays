import type { appEnglish } from './page-english';

type ErrorMessage = keyof typeof appEnglish;
const messageByCode: Record<string, ErrorMessage> = {
  UNAUTHENTICATED: 'sessionExpired',
  UNAUTHORIZED: 'sessionExpired',
  FORBIDDEN: 'accessDenied',
  BOOKING_NOT_FOUND: 'bookingNotFound',
  HOTEL_NOT_AVAILABLE: 'hotelUnavailable',
  INVALID_HOTEL_ID: 'hotelUnavailable',
  RATE_EXPIRED: 'rateExpired',
  QUOTE_EXPIRED: 'rateExpired',
  QUOTE_NOT_FOUND: 'rateExpired',
  HOTEL_RATE_CHANGED: 'rateExpired',
  QUOTE_ALREADY_USED: 'quoteUsed',
  BOOKING_LOCKED: 'bookingChanged',
  CHECKOUT_CONFLICT: 'bookingChanged',
  CHECKOUT_ALREADY_EXISTS: 'bookingChanged',
  INVALID_BOOKING_TRANSITION: 'bookingChanged',
  IDEMPOTENCY_CONFLICT: 'bookingChanged',
  GUEST_DETAILS_REQUIRED: 'guestDetailsError',
  GUEST_AGE_INVALID: 'guestDetailsError',
  INVALID_LEAD_GUEST: 'guestDetailsError',
  GUEST_OCCUPANCY_MISMATCH: 'guestDetailsError',
  INVALID_STAY: 'invalidStay',
  UNSUPPORTED_CURRENCY: 'unsupportedCurrency',
  SUPPLIER_CURRENCY_MISMATCH: 'unsupportedCurrency',
  SUPPLIER_CATALOG_UNAVAILABLE: 'inventoryUnavailable',
  PAYMENT_RECONCILIATION_REQUIRED: 'paymentReview',
  SUPPLIER_RECHECK_PENDING: 'confirmationPending',
  SUPPLIER_BOOKING_PENDING: 'confirmationPending',
  INVALID_SUPPLIER_CONFIRMATION: 'confirmationPending',
  CANCELLATION_NOT_CONFIGURED: 'cancellationUnavailable',
  PAYMENT_NOT_CONFIGURED: 'paymentsUnavailable',
  SUPPLIER_NOT_CONFIGURED: 'inventoryUnavailable',
  SUPPLIER_INTEGRATION_REQUIRED: 'inventoryUnavailable',
  AUTH_NOT_CONFIGURED: 'signInUnavailable',
  VALIDATION_ERROR: 'validationError',
};

export function requestErrorMessageKey(code?: string, status?: number): ErrorMessage {
  if (code && Object.hasOwn(messageByCode, code)) return messageByCode[code]!;
  if (status === 401) return 'sessionExpired';
  if (status === 403) return 'accessDenied';
  // Unknown transport/provider outcomes never imply a booking or payment failed.
  return 'requestError';
}
