export const bookingEnglish = {
  statuses: {
    BOOKING_PENDING: 'Awaiting checkout',
    BOOKING_PROCESSING: 'Confirming with hotel',
    BOOKING_CONFIRMED: 'Booking confirmed',
    BOOKING_FAILED: 'Booking failed',
    BOOKING_CANCELLED: 'Booking cancelled',
    RECONCILIATION_REQUIRED: 'Confirmation under review',
    PAYMENT_PENDING: 'Payment pending',
    PAYMENT_SUCCEEDED: 'Payment received',
    PAYMENT_FAILED: 'Payment failed',
    REFUND_PENDING: 'Refund pending',
    REFUNDED: 'Refunded',
  },
  details: {
    reference: 'Booking reference: {reference}',
    reconciliation:
      'Your booking is being reviewed. Please avoid making another payment while confirmation is pending.',
    roomsAndGuests: 'Rooms and guests',
    occupancy: 'Adults: {adults} · Children: {children}',
    leadGuest: 'Lead guest',
    continueCheckout: 'Continue checkout',
    cancellationQuestion:
      'Request cancellation of this booking? The supplier’s cancellation policy and any applicable charges still apply.',
    requesting: 'Requesting…',
    confirmCancellation: 'Confirm cancellation request',
    keepBooking: 'Keep booking',
    requestCancellation: 'Request cancellation',
  },
  list: {
    emptyTitle: 'Your next trip starts here',
    emptyDescription: 'Your bookings will appear here once you start a reservation.',
    findHotel: 'Find a hotel',
    viewBooking: 'View booking',
  },
  price: {
    totalDescription: 'Total for your stay, including applicable taxes and fees',
    confirmation: 'The booking service calculates and confirms this total.',
  },
  checkout: {
    progressed:
      'This booking has moved beyond guest checkout. Open its details for the current status.',
    title: '2. Guest details and payment',
    savedGuests:
      'Guest details are saved. Resume an existing checkout here if a payment attempt was interrupted.',
    continueSaved: 'Continue payment with saved guest details',
    status: 'Checkout status: {status}. Your booking is confirmed only after the hotel accepts it.',
    statusUnavailable: 'Check the booking details for the latest payment status',
    viewStatus: 'View booking status',
  },
  guests: {
    formLabel: 'Guest details',
    contactEmail: 'Contact email',
    contactPhone: 'Contact phone',
    room: 'Room {number}',
    adult: 'Adult',
    child: 'Child, age {age}',
    title: 'Title',
    titles: { Mr: 'Mr', Mrs: 'Mrs', Ms: 'Ms', Miss: 'Miss', Master: 'Master' },
    firstName: 'First name',
    lastName: 'Last name',
    emailError: 'Enter a valid contact email address.',
    phoneError: 'Enter a contact phone number between 5 and 30 characters.',
    firstNameError: 'Enter a first name between 1 and 100 characters.',
    lastNameError: 'Enter a last name between 1 and 100 characters.',
    titleError: 'Select a valid title.',
    detailsError: 'Check the guest details. Exactly one adult must be the lead guest.',
    guidance:
      'Enter guest names as they appear on travel documents. Payment is handled by the configured payment provider.',
    preparing: 'Preparing checkout…',
    continue: 'Save guests and continue to payment',
  },
  rate: {
    title: '1. Confirm the latest price',
    description:
      'We’ll check this room’s current price and availability before creating your reservation.',
    checking: 'Checking availability…',
    checkPrice: 'Check latest price',
    quoteValidity: 'Quote valid until {expires}. Availability is confirmed by the booking service.',
    creating: 'Creating reservation…',
    accept: 'Accept price and continue',
    checkBeforeContinuing: 'Check the latest price before continuing.',
  },
};

export type BookingMessages = typeof bookingEnglish;
