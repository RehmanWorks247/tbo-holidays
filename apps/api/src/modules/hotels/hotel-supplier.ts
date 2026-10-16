import type {
  CancellationPolicy,
  Hotel,
  HotelRateTerms,
  HotelSearchRequest,
} from '@hotel/contracts';

export const HOTEL_SUPPLIER = Symbol('HOTEL_SUPPLIER');

/** Provider-neutral amounts, in integer minor units. Total includes these three components. */
export interface SupplierPrice {
  currency: string;
  baseAmount: number;
  taxAmount: number;
  feeAmount: number;
  /** Supplier sales floor in the same currency, not an additional supplier charge. */
  minimumSellingAmount?: number;
}

export interface SupplierRate {
  hotelId: string;
  supplierRateId: string;
  roomName: string;
  mealType?: string;
  refundable: boolean;
  price: SupplierPrice;
  cancellationPolicies: CancellationPolicy[];
  terms?: HotelRateTerms;
}

/** One canonical snapshot for quote acceptance and later fulfillment comparison. */
export function supplierPolicySnapshot(rate: SupplierRate) {
  return {
    refundable: rate.refundable,
    ...(rate.mealType ? { mealType: rate.mealType } : {}),
    cancellationPolicies: rate.cancellationPolicies,
    ...(rate.terms ? { terms: rate.terms } : {}),
  };
}

export interface SupplierSearchResult {
  hotel: Hotel;
  rates: SupplierRate[];
}

export interface SupplierBookingRequest {
  /** Persist once before dispatch. A timeout must be reconciled with this reference. */
  clientReference: string;
  supplierRateId: string;
  hotelId: string;
  checkIn: string;
  checkOut: string;
  nationality: string;
  rooms: HotelSearchRequest['rooms'];
  guests: {
    firstName: string;
    lastName: string;
    type: 'ADULT' | 'CHILD';
    age?: number;
    roomIndex: number;
  }[];
  contact: { email: string; phone: string };
  expectedPrice: SupplierPrice;
}

export interface SupplierBookingResult {
  /** "failed" means definitive rejection. Absence/unknown/eventual consistency means "pending". */
  status: 'confirmed' | 'pending' | 'failed';
  supplierBookingId?: string;
  confirmationNumber?: string;
}

export interface HotelSupplier {
  readonly name: string;
  searchHotels(input: HotelSearchRequest): Promise<SupplierSearchResult[]>;
  getHotelDetails(hotelId: string): Promise<Hotel>;
  getAvailability(hotelId: string, input: HotelSearchRequest): Promise<SupplierRate[]>;
  recheckPrice(supplierRateId: string): Promise<SupplierRate>;
  createBooking(input: SupplierBookingRequest): Promise<SupplierBookingResult>;
  /**
   * Resolve by the original persisted client reference. A temporary "not found"
   * must return pending; it does not prove rejection or authorize a refund/retry.
   */
  getBooking(reference: {
    clientReference: string;
    supplierBookingId?: string;
  }): Promise<SupplierBookingResult>;
  cancelBooking(input: {
    clientReference: string;
    supplierBookingId: string;
  }): Promise<{ status: 'cancelled' | 'pending' }>;
}
