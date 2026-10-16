import { bookingEnglish } from '@/features/booking/messages/booking-english';
import { homeEnglish } from '@/features/hotel-search/messages/home-english';
import { resultsEnglish } from '@/features/hotel-search/messages/results-english';

export const appEnglish = {
  skipContent: 'Skip to content',
  pageTitle: 'Best Holiday Packages · Find your next stay',
  pageDescription:
    'Discover your next destination and find a hotel for your journey with Best Holiday Packages.',
  languageDescription:
    'Choose your language for the website, including your search and booking pages.',
  accountTitle: 'My account',
  accountDescription: 'Keep your contact details ready for your next stay.',
  adminTitle: 'Administration',
  operationsTitle: 'Booking operations',
  bookingsTitle: 'My bookings',
  bookingsDescription: 'Review upcoming stays and track reservation updates.',
  checkoutTitle: 'Checkout',
  checkoutDescription: 'Review the latest room price, add your guests, and continue to payment.',
  selectRoom: 'Select an available room to begin checkout.',
  findRoom: 'Find a room',
  hotelsTitle: 'Find a hotel',
  hotelsDescription: 'Explore room options for your stay.',
  signInUnavailable: 'Sign-in is not available yet',
  accountUnavailable:
    'Account and booking services will be available once authentication is configured. You can still explore the hotel search.',
  backToSearch: 'Back to search',
  errorTitle: 'Something went wrong',
  errorDescription: 'Please try loading this page again.',
  tryAgain: 'Try again',
  notFoundTitle: 'Page not found',
  notFoundDescription: 'This page may have moved or is no longer available.',
  returnHome: 'Return home',
  loadingPage: 'Loading page',
  loading: 'Loading…',
  requestReference: 'Reference: {reference}',
  requestError:
    'We could not complete the request. If you were making a booking or payment, check its status before trying again.',
  serviceUnavailable: 'This service is temporarily unavailable. Please try again later.',
  sessionExpired: 'Please sign in to continue.',
  accessDenied: 'You do not have access to this page or booking.',
  bookingNotFound: 'This booking could not be found.',
  hotelUnavailable: 'This hotel or room is no longer available. Please search again.',
  rateExpired:
    'The room price or availability has changed. Please check the latest price before continuing.',
  quoteUsed:
    'This price quote has already been used. Check your bookings before starting another reservation.',
  bookingChanged: 'This booking has changed. Open its details to review the current status.',
  guestDetailsError:
    'Check that the guests, ages, and rooms match your reservation, with exactly one adult as lead guest.',
  invalidStay: 'Choose valid check-in and check-out dates, then search again.',
  unsupportedCurrency:
    'This currency is not supported for this booking. Please choose another currency and search again.',
  paymentReview:
    'The payment outcome is being checked. Do not make another payment. Check your booking for updates.',
  confirmationPending:
    'Hotel confirmation is still pending. Check your booking for updates before making another reservation.',
  cancellationUnavailable:
    'Online cancellation is currently unavailable. Please contact support for help with your booking.',
  paymentsUnavailable: 'Payments are not configured. No charge has been made.',
  inventoryUnavailable: 'Hotel availability is currently unavailable. Please try again later.',
  validationError: 'Check the details you entered and try again.',
};

export const pageEnglish = {
  home: homeEnglish,
  booking: bookingEnglish,
  results: resultsEnglish,
  app: appEnglish,
};

export type PageMessages = typeof pageEnglish;
