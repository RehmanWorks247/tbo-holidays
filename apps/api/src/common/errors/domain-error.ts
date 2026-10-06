export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
export class HotelNotAvailableError extends DomainError {
  constructor() {
    super('HOTEL_NOT_AVAILABLE', 'This hotel rate is no longer available.', 409);
  }
}
export class HotelRateChangedError extends DomainError {
  constructor() {
    super(
      'HOTEL_RATE_CHANGED',
      'The hotel price has changed. Recheck and accept the latest price.',
      409,
    );
  }
}
export class BookingFailedError extends DomainError {
  constructor() {
    super('BOOKING_FAILED', 'The booking could not be completed.', 409);
  }
}
export class PaymentFailedError extends DomainError {
  constructor() {
    super('PAYMENT_FAILED', 'The payment could not be completed.', 409);
  }
}
export class SupplierUnavailableError extends DomainError {
  constructor() {
    super('SUPPLIER_UNAVAILABLE', 'The hotel supplier is temporarily unavailable.', 503);
  }
}
