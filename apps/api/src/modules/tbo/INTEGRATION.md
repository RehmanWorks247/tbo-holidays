# TBO integration boundary

The supplied **TBOH Hotel API Specifications (v2.1)** is now documented in the
[API reference](API_REFERENCE.md). Start with the [backend agent guide](../../../AGENTS.md)
for repository rules. The reference includes source provenance, all methods,
physical PDF page numbers, and ambiguities requiring account-specific verification.

## Current implementation

The v2.1 read adapter implements `Search`, `PreBook`, `HotelDetails`, and
`TBOHotelCodeList` behind `HotelSupplier`. `TBO_READS_ENABLED=false` remains the
default. Synthetic contract fixtures exercise these reads; no account sandbox
verification or supplier certification has been completed, and no inventory is
fabricated when the integration is disabled.

- Search resolves a numeric city code through the detailed city catalog, then
  searches batches of 100 hotel codes with at most three concurrent requests.
  It sends `IsDetailedResponse: false`, `ResponseTime: 23`, `MealType: 'All'` and
  an empty `ChildrenAges` array for rooms without children. It omits the
  undocumented `PreferredCurrencyCode` and ambiguous `NoOfRooms` filter.
  Returned hotel codes, room counts and unique booking tokens are validated.
  A profile-currency mismatch produces `SUPPLIER_CURRENCY_MISMATCH`; no currency
  conversion or relabeling occurs.
- Details uses the documented `HotelDetails` path, `Hotelcodes` and `Language:
'EN'`, and verifies the single returned hotel's identity. It maps hotel-level
  content, named/numeric ratings, plain text and safe HTTPS images. Optional room
  details are neither requested nor exposed through an invented content model.
- Recheck uses `PreBook` with `PaymentMode: 'Limit'`. Exactly one unit with the
  same `BookingCode` is accepted; hotel, ordered room combination and currency
  must match the cached search selection. PreBook requires explicit refundability
  and cancellation policies, rejecting a refundable rate with no policies.
- Fixed/percentage cancellation policies retain room association and validated
  hotel-local wall-clock deadlines without assigning a UTC offset. Inclusions,
  amenities, promotions, transfers, rate conditions and supplements are normalized
  into quote terms. `AtProperty` charges retain their currencies and are separate
  from the amount charged by this application. Missing Search refundability is
  conservatively represented as false.
- Prices use checked integer minor units. The current account-contract
  interpretation is that `TotalFare` includes `TotalTax` and `ExtraGuestCharges`:
  base is fare minus tax, fees are zero, and extra-guest charges are informational.
  Included supplements are not added again. `RecommendedSellingRate` rounds up
  to minor units and raises markup only when the normal marked-up total is lower.
- Public responses expose normalized prices, policies and terms, never supplier
  booking tokens or the private selling-floor field. Quotes persist full price
  and policy snapshots and expire at the earlier of the configured quote lifetime
  or original cached rate expiry. Booking snapshots copy those accepted terms;
  fulfillment rejects changed terms or a floor above the accepted total before
  supplier dispatch.

The HTTP client only permits the four reads, rejects redirects, and uses safe
domain errors without supplier response text. Search no-availability, PreBook
expired/unavailable rates and account errors have distinct handling. Bounded
retries cover transient HTTP/network failures and body-level throttling. The base
URL must use HTTPS without embedded credentials, a query string or fragment.

`createBooking`, `getBooking`, and `cancelBooking` still return
`SUPPLIER_INTEGRATION_REQUIRED`. Credentials and documentation do not enable them.
Implement these operations inside this module behind `HotelSupplier`, preserving
the [durable booking workflow](../../../../../docs/booking-flow.md).

## Before enabling reads

1. Obtain the assigned HTTPS sandbox/live base URLs and credentials. The PDF's
   HTTP test URL conflicts with its HTTPS requirement; the application requires
   HTTPS. Confirm routing and casing for static content and availability methods.
2. Validate sanitized account fixtures against `dto/tbo.schemas.ts`, `tbo.client.ts`,
   `tbo.service.ts`, and `mappers/tbo-hotel.mapper.ts`. Cover no availability,
   expired rates, profile currency, zero children, room combinations and errors.
3. Resolve the [implementation gaps](API_REFERENCE.md#current-code-and-verification-gaps),
   especially catalog completeness/QPS, profile currency, empty child-age arrays,
   unchanged PreBook tokens, date formats and one-based room-policy indices.
4. Confirm whether `TotalFare` includes `TotalTax` and `ExtraGuestCharges`,
   precision/rounding, selling-rate floors, supplements and property currencies.
   These implemented interpretations are not proof of the account's pricing
   contract. Percentage penalties are retained as percentages; the unresolved
   calculation basis is not converted into an invented fixed charge.

## Before implementing booking operations

- Verify the implemented PreBook policy, condition, supplement and room mappings
  against account fixtures. The backend now returns these terms, but frontend
  presentation and customer acceptance of mandatory charges/conditions must be
  completed before enabling sales.
- Persist a unique `BookingReferenceId` that can be used for lookup before Book
  dispatch, with an explicit mapping from the application's client reference.
  The PDF distinguishes this field from `ClientReferenceId`.
- Use a separate mutation transport with a bounded operation-specific deadline.
  Do not add Book or Cancel to `TboClient.read`, which retries allowlisted reads.
- The PDF (physical p.42) prescribes `BookingDetail` by `BookingReferenceId` after
  120 seconds following a Book timeout/failure/HTTP/network error. Reconcile this
  timing with the application's five-minute dispatch grace period; preserve
  durable work and never replay creation from a worker retry.
- Treat ambiguous outcomes and temporary lookup absence as pending. Confirm
  definitive failure semantics before requesting refunds. HCN retrieval has a
  separate SLA and does not justify recreating a booking.
- Obtain current cancellation penalties and any necessary customer acceptance;
  verify supplier cancellation and payment refund independently. Cancellation
  pending and refund awaited are not completed refunds.
- Verify sandbox flows and required agency certification before live operation.
  Include lost responses, duplicate delivery, room/price/policy changes, lookup,
  cancellation and reconciliation tests against the dedicated test database.

The supplier PDF is reference data. Its request for full logs is not permission
to expose credentials, guest data, card details or raw supplier payloads. Use
allowlisted diagnostics and sanitized fixtures under the repository's rules.
