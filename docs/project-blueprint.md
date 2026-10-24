# TBOHolidays project blueprint

**Product vision:** Make affordable travel easy to compare, book and manage, with transparent prices, useful hotel information and dependable payment and booking outcomes.

TBOHolidays is a booking platform for **hotel stays and flight plus hotel trips**, with TBO as the primary planned inventory supplier. Travelers choose their destination, dates and party, compare offers, pay securely and manage reservations. Launch hotel booking first, then add combined trips after verifying the flight contract and operating requirements.

The existing repository provides a hotel foundation. Live sales require the integrations and release gates below.

## Customers and value

Serve travelers who value price and convenience, especially couples, families and small groups. Make room occupancy, meals, cancellation rules and property charges easy to compare. Compete through relevant inventory, clear totals, a straightforward mobile experience and reliable support. Affordability is a pricing goal; do not promise the lowest price or guaranteed availability without evidence.

## Product scope

| Product           | Search inputs                                                                                  | Delivery                 |
| ----------------- | ---------------------------------------------------------------------------------------------- | ------------------------ |
| Hotels            | Destination or location, check-in and check-out, rooms, adults, children and ages, nationality | First commercial release |
| Flight plus hotel | Departure and destination airports, travel dates, travelers, cabin and hotel occupancy         | Subsequent release       |
| Flight only       | Reuse the future flight search and ticketing flow if commercially useful                       | Optional expansion       |

Hotel searches do not require a departure airport. For combined trips, confirm hotel dates against local flight arrival and departure, including overnight flights.

Defer loyalty schemes, native apps, complex promotions, multiple suppliers and automated trip recommendations until the core booking operation is dependable.

## Customer experience

| Area            | First release requirements                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search          | Named destination autocomplete mapped to supplier city codes; validated dates and occupancy; shareable criteria                                    |
| Results         | Photos, location, star rating, room and meal summary, cancellation terms, and total for the selected stay and all rooms; per-night price secondary |
| Filters         | Budget, star rating, meals, refundable options and supported amenities; map or location filters where verified coordinates are available           |
| Hotel and rooms | Description, photos, facilities, location, check-in rules, room combinations, inclusions, policies and mandatory property charges                  |
| Checkout        | Sign-in, validated guests, current quote, explicit acceptance of terms, hosted payment and resumable booking status                                |
| Manage booking  | Owned history, confirmation and voucher access, cancellation requests, refund progress and support contact                                         |
| Admin           | Booking search, supplier and payment references, reconciliation and refund queues, audit history and controlled support actions                    |

Use accessible, responsive forms with clear loading, empty and error states. Show genuine supplier content and licensed imagery; distinguish star ratings from traveler reviews. Advertise only currencies and languages supported throughout the relevant booking journey.

## Hotel booking journey

1. **Search and compare.** Browse publicly by destination, stay and occupancy. Prices remain indicative until rechecked.
2. **Recheck the offer.** After sign-in, the backend verifies availability, rooms, price and terms through TBO PreBook and creates an owned, expiring quote.
3. **Accept and create an intent.** Display the amount charged now, separate property charges and cancellation terms. Record acceptance, consume the quote once and capture guests. Expired or changed offers require a fresh quote and acceptance.
4. **Take payment.** Reserve one payment and open gateway checkout. A verified webhook or authoritative lookup establishes success; the browser redirect cannot.
5. **Fulfill the reservation.** Durable background work checks the accepted offer before dispatch and sends at most one supplier booking creation request. Definitive supplier confirmation produces the confirmed booking and voucher.
6. **Manage the outcome.** Show processing while an outcome is uncertain. Reconcile original references and refund definite failures after payment. Cancellation and refund completion remain separate events.

A successful payment does not establish hotel confirmation. Repeated requests resume the original booking or payment using the same idempotency key.

## TBO integration

The supplied contract is **TBO Hotel JSON API v2.1**. Flight search, fare validation, ticketing, changes and refunds need a separately verified contract and account access; hotel documentation does not establish flight capabilities.

| Capability          | Required integration                                                   | Repository baseline                                                                                                 |
| ------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Catalog and content | Destination discovery, city hotel mapping, content and images          | City hotel catalog and hotel-level details implemented as gated reads; autocomplete and synchronization remain work |
| Availability        | Search by complete stay and occupancy                                  | Search implemented as a gated read                                                                                  |
| Final offer         | Recheck prices, availability, policies, supplements and selling floors | PreBook implemented as a gated read; customer presentation and acceptance need completion                           |
| Reservation         | Create once and persist application and supplier references            | Supplier booking creation disabled                                                                                  |
| Recovery            | Retrieve the original reservation and resolve uncertain outcomes       | Supplier lookup disabled                                                                                            |
| After sales         | Obtain current penalties, cancel and follow refund outcomes            | Supplier cancellation disabled                                                                                      |

Reads are disabled by default and have synthetic fixture coverage, not account certification. Before enabling them, verify assigned HTTPS endpoints, credentials, currency, tax inclusion, room mappings, policy timezones, selling floors, token validity and supplier limits with sanitized sandbox fixtures. Confirm catalog caching and refresh permissions.

Keep raw supplier payloads and rate tokens server-side. Persist the lookup-capable supplier reference before booking dispatch. Customer gateway payments and TBO agency balance or credit are separate financial arrangements; monitor supplier funding before accepting sales.

## Pricing and payment rules

- The backend owns every price, tax, fee, markup, discount, availability decision and status. Use checked integer minor units and validated currencies.
- Show the full checkout total and separate property charges in their actual currencies. Count included taxes and supplements once and respect supplier selling floors.
- Earn revenue through controlled markup. Measure contribution after supplier cost, payment fees, refunds and support costs; avoid uneconomic discounts.
- Preserve immutable quotes and booking snapshots. Current contracts accept USD, EUR, GBP, AED, PKR and INR; enable sales only where supplier and gateway support match. Currency conversion is not implemented.
- Implement the gateway behind `PaymentProvider`, including hosted card entry, verified webhooks, payment lookup, refunds and dispute handling. Provider selection depends on the business entity, markets and settlement needs.
- Persist payment receipt and pending fulfillment together. Enforce unique booking, payment, webhook and refund keys; workers claim durable work before external effects.
- Treat timeouts as unknown outcomes. Never blindly replay booking, cancellation or refund mutations, or refund an uncertain supplier reservation before resolving its outcome.

## Architecture and data

Extend the existing TypeScript monorepo and modular monolith.

| Layer                 | Ownership                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Next.js and React     | Feature-based search, details, checkout, account and booking screens; route files compose features                            |
| NestJS API            | Authentication, ownership, search, pricing, bookings, guests, payments, notifications and admin rules                         |
| Provider adapters     | TBO wire contracts inside `modules/tbo`; hotel operations behind `HotelSupplier`; gateway operations behind `PaymentProvider` |
| PostgreSQL and Prisma | Durable users, quotes, room and guest snapshots, bookings, payments, events, refunds, audits and outbox work                  |
| Redis and BullMQ      | Expiring search references, bounded caches and delivery of work persisted in PostgreSQL                                       |
| Shared contracts      | Public Zod schemas and inferred types in `packages/contracts`; no raw supplier objects or database records                    |

Clerk verifies identity; the API enforces ownership and database-backed admin roles. Future flight services should own fare and ticketing rules through an explicit flight provider interface. A combined order must link independently tracked flight and hotel reservations.

## Operations and trust

Separate development, staging and production databases, secrets, gateway environments and supplier settings. Keep fictional preview inventory labeled and outside live checkout.

Apply validation, abuse controls, secret management and access restrictions. Exclude guest data, credentials and card details from logs and analytics; use request IDs and allowlisted diagnostics. Define retention, deletion, privacy and consent handling before collecting live traveler data.

Alert on supplier failures, funding shortages, pending paid bookings, delayed refunds, exhausted jobs and failed notifications. Support operators need original references, audited recovery actions, daily payment and supplier reconciliation, and clear escalation ownership. Test backup restoration and worker recovery.

Complete business review for launch markets, travel terms, cancellation disclosures, consumer obligations and applicable package-travel requirements. Publish support hours the team can operate.

## Delivery phases and release gates

| Phase                    | Deliverable                                                                                                          | Exit gate                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1. Verify inventory      | Account-verified hotel reads, destination discovery, useful results and complete offer terms                         | Correct prices, occupancy, cancellation policies and property charges across representative sandbox cases                       |
| 2. Complete transactions | Gateway, TBO Book and lookup, durable fulfillment, confirmations, cancellation and refunds                           | Sandbox proof covering duplicates, price changes, timeouts, late webhooks and crashes; required supplier certification complete |
| 3. Launch hotels         | Limited markets and inventory, working support, reconciliation, monitoring and recoverable infrastructure            | Financial reconciliation balances; no unexplained paid bookings; business and operational launch reviews complete               |
| 4. Add combined trips    | Verified flight contract, airports, baggage, fare rules, repricing, ticketing, linked orders and after-sales support | Defined booking sequence and compensation for partial failure; all required components confirmed before trip confirmation       |

For combined trips, disclose whether the sale is a package or separate reservations and explain partial-failure handling before payment. Track flight reservation and ticket issuance separately.

Implementation changes require `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`. Financial workflow changes also require integration tests against the dedicated test database; sandbox verification supplements repository checks.

## Success measures

Track search-to-selection and checkout-to-confirmed conversion, paid bookings reaching supplier confirmation, contribution per booking, search latency, reconciliation backlog age, refund completion time and support contacts per booking. Set numeric targets from sandbox and pilot results before expanding launch scope.

## Decisions before launch

1. **Commercial:** Public brand, entity, launch countries, target segment, initial destinations and markup policy.
2. **Supplier:** Account access, currencies, agency funding, certification, reference and lookup behavior, and operational limits.
3. **Payments:** Gateway eligibility, settlement currency, fees, refunds and dispute ownership.
4. **Service:** Cancellation handling, support coverage, escalation ownership and confirmation delivery provider.
5. **Expansion:** Flight contract and the commercial structure of combined trips.

## Implementation references

- [Architecture](architecture.md) for module ownership and trust boundaries.
- [Booking flow and recovery](booking-flow.md) for transactions, idempotency and reconciliation.
- [TBO integration boundary](../apps/api/src/modules/tbo/INTEGRATION.md) for enablement requirements.
- [TBO Hotel API reference](../apps/api/src/modules/tbo/API_REFERENCE.md) for endpoints and account verification gaps.

This blueprint defines the intended product. The integration documents define current capabilities and gates; resolve differences explicitly before changing financial or supplier behavior.
