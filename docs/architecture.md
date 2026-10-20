# Architecture

This repository contains one Next.js application and one NestJS API. The API is a
modular monolith with PostgreSQL as its durable source of truth and Redis for
short-lived search references and BullMQ delivery. There are no microservices.

## Find the right place to make a change

| Location                                               | Owns                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `apps/web/src/app`                                     | Pages, layouts, route composition, loading and error boundaries                      |
| `apps/web/src/features/<feature>`                      | Feature components, forms, queries, mutations, schemas and utilities                 |
| `apps/web/src/components/ui`                           | Reusable UI primitives                                                               |
| `apps/web/src/components/shared`                       | Shared layout and request/configuration feedback                                     |
| `apps/web/src/services/api`                            | HTTP transport, bearer tokens, response validation and domain API clients            |
| `apps/web/src/providers`                               | Clerk and TanStack Query providers                                                   |
| `apps/api/src/modules`                                 | Business domains listed below                                                        |
| `apps/api/src/common`                                  | Transport validation, authorization decorators, public errors and response envelopes |
| `apps/api/src/database`                                | The shared Prisma client lifecycle                                                   |
| `apps/api/src/infrastructure`                          | Redis connection and readiness checks                                                |
| `apps/api/src/jobs`                                    | Durable outbox publication and workflow workers                                      |
| `apps/api/prisma`                                      | PostgreSQL schema and migrations                                                     |
| `packages/contracts`                                   | Public Zod request/response schemas and inferred types                               |
| `packages/typescript-config`, `packages/eslint-config` | Shared compiler and lint settings                                                    |

Route files compose features; they do not own booking rules. React Hook Form and
Zod validate form inputs. The date picker selects a range and enforces stay rules;
it does not represent hotel inventory. TanStack Query manages API state near the
feature that consumes it. Its cache is not an authoritative price or booking store.

The API has these domain boundaries:

| Module          | Responsibility                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `auth`          | Verify Clerk session tokens and enforce default authentication and roles                           |
| `users`         | Resolve Clerk identities to internal users and manage owned profiles                               |
| `hotels`        | Public hotel transport and the provider-neutral `HotelSupplier` interface                          |
| `search`        | Stay validation, search orchestration, opaque rate references and authenticated recheck            |
| `pricing`       | Checked minor-unit arithmetic, markup and durable owned price quotes                               |
| `tbo`           | Supplier authentication, wire DTO validation, mapping, transport and the TBO adapter               |
| `bookings`      | Intent creation, quote consumption, guest updates, supplier fulfillment and booking reconciliation |
| `customers`     | Guest and room occupancy validation                                                                |
| `payments`      | Checkout reservation, provider abstraction and verified webhook application                        |
| `notifications` | Confirmation delivery boundary; currently disabled                                                 |
| `admin`         | Server-authorized booking visibility                                                               |

Controllers only validate transport and delegate. Services use Prisma directly
where it is sufficient; there is no generic repository or base-service layer.
Supplier and payment interfaces exist because they isolate real external systems.

```mermaid
flowchart LR
  Web[Next.js features] --> Contracts[Public REST contracts]
  Contracts --> API[NestJS domain modules]
  API --> DB[(PostgreSQL)]
  Search[Search] --> Supplier[HotelSupplier]
  Booking[Bookings] --> Supplier
  Supplier --> TBO[TBO adapter]
  Payment[Payments] --> Gateway[PaymentProvider]
  DB --> Outbox[Durable outbox]
  Outbox --> Queue[Redis / BullMQ]
  Queue --> Worker[Domain workers]
  Worker --> Booking
```

## Data and trust boundaries

All REST routes use `/api/v1`. Successful responses contain `{ data, requestId }`.
Errors contain `{ code, message, requestId, details? }`. A centralized filter turns
domain errors into this shape and avoids exposing unexpected exception messages.

The global authentication guard requires a verified Clerk user session unless a
route explicitly uses `@Public()`. Search and hotel details are public. Recheck,
quotes used for booking, bookings, profiles and checkout are associated with the
authenticated internal user. Admin permissions come from the internal user role.
Frontend route protection is an additional UI boundary, not the API authorization.

Search responses expose application `Hotel` and `HotelRate` models. Supplier DTOs
and booking codes remain inside the API. For each rate, search creates a random
UUID and caches the supplier reference, stay criteria and hotel identity in Redis
for 15 minutes. The browser receives only that UUID and a calculated display price.
The catalog uses supplier destination codes; a destination discovery/autocomplete
integration is an extension point, not seeded hotel inventory.

Authenticated recheck loads the cached rate, validates the stay again, asks the
supplier for its current offer, and verifies the unchanged token,
hotel/ordered-room/currency identity. It creates a `PriceQuote` in PostgreSQL bound
to the current user. The quote stores normalized occupancy, supplier reference,
component amounts, pricing rules, cancellation policies and complete rate terms.
Policies preserve property-local deadlines and room association; terms include
mandatory property charges in their own currencies. Expiry is capped by both the
configured quote lifetime and the original cached rate expiry. The browser receives
normalized prices and terms and can accept the quote ID; it cannot submit an
authoritative amount or supplier booking token. Frontend presentation of the new
terms remains work before sales can be enabled.

The public currency set is USD, EUR, GBP, AED, PKR and INR. Every amount in a public
contract or money column is an integer in the currency's minor unit. Pricing
validates the currency, uses checked bounds, and calculates normal markup on the
base amount with integer half-up rounding; tax and fee components are added once.
A supplier selling floor rounds up to minor units and raises markup so the total
is at least that floor, without changing supplier charges. The floor remains in
private pricing snapshots, not public price breakdowns. TBO fare is currently
interpreted as inclusive of tax and extra-guest charges; the latter are informational,
and property-payable supplements are disclosed separately. These supplier pricing
interpretations still require account verification. Discounts are currently zero.
No implicit foreign-exchange conversion exists. Historical bookings retain the
accepted price and complete policy/term snapshots.

Database models are not public API contracts. `User`, `CustomerProfile`,
`PriceQuote`, `Booking`, guests, rooms, payments, events, refunds, favorites,
`AuditLog` and `OutboxEvent` represent application data. The schema includes
ownership indexes, idempotency uniqueness and one payment reservation per booking.
Raw third-party payloads are not the primary model.

PostgreSQL is the primary database for both the application and its isolated mock
catalogue. Bookings, payment events, quote consumption and pending work need
transactions, foreign keys and uniqueness constraints. Redis serves short-lived
references and queue delivery; it does not replace durable financial records.
Query-specific indexes and bounded supplier-result caches support fast reads.
A separate document database would add operational complexity without a current
requirement that the existing PostgreSQL schema cannot meet.

## External integrations and their current limits

`HOTEL_SUPPLIER` binds to `TboService`; application code depends on `HotelSupplier`.
An explicit development-only `HOTEL_DATA_MODE=mock` selects `MockAppModule`
instead of the live application composition. It reuses hotel transport with
`MockHotelSupplier` and `MockSearchService`, with the shared database module but
without Redis or mutation modules. Dedicated `MockDestination`, `MockHotel` and
`MockRate` tables store the fictional catalogue. They have no links to booking,
quote, payment or user records. Runtime reads use PostgreSQL; the TypeScript
fixtures are seed input only. Destination and hotel/currency indexes bound the
catalogue queries, then the shared search domain filters computed stay prices.
Mock search alone accepts omitted stay criteria. With no destination it combines
all persisted destinations before filtering, sorting and pagination; the backend
returns the effective sample pricing stay in `metadata.previewStay`. An empty
preview search shows the complete 45-hotel seed with a default page size of 50.
Live search keeps its required destination and stay validation.
Production configuration rejects mock mode. See [hotel preview](hotel-preview.md).
The client uses configured HTTPS, Basic authentication, deadlines, redacted
context logging and bounded retries for explicitly allowlisted read operations.
Endpoint configuration rejects embedded credentials, query strings and fragments;
the client rejects redirects. No mutation can enter the read retry path. The v2.1
adapter implements `Search`, `HotelDetails`, `PreBook` and the city-scoped
`TBOHotelCodeList`, with synthetic contract fixtures and default
`TBO_READS_ENABLED=false`. Search batches up to 100 codes with at most three
concurrent requests, omits unsupported currency and room-limit parameters, and
rejects a returned currency different from the requested one. Supplier no-inventory,
rate expiry and account errors are normalized without exposing supplier payloads.
Hotel results filtering, sorting and pagination run in the search domain after
authoritative pricing. Live unfiltered inventory is cached in Redis for 30 seconds
by the complete stay and pricing policy, with identical in-flight requests coalesced
per process. Original opaque rate references and expiry are retained across filters.

The supplied JSON Hotel API v2.1 specification is documented in the
[TBO API reference](../apps/api/src/modules/tbo/API_REFERENCE.md), with scoped
[backend agent guidance](../apps/api/AGENTS.md). It does not certify this account's
implementation. Obtain the assigned HTTPS endpoints and sanitized account sandbox
fixtures before enabling reads. Validate endpoint routing, profile currency,
tax-inclusive fare semantics, multi-room rates, local policy dates and indices,
supplements, selling-rate floors and token validity. Details currently exposes
hotel-level content only; optional static room content is not requested. Read
[the TBO integration notes](../apps/api/src/modules/tbo/INTEGRATION.md) before
changing this boundary. TBO booking, lookup and cancellation remain explicitly
disabled even when read credentials are supplied.

`PAYMENT_PROVIDER` binds to a disabled adapter. The gateway interface covers
checkout, signed webhook verification, authoritative payment lookup and refunds.
No Stripe or other gateway secretly returns test success. Payment reconciliation,
refund processing and confirmation email workers preserve pending durable work
and report configuration errors until their adapters are implemented.

`JOBS_ENABLED=false` is the default. Enabling it starts one BullMQ queue and worker
inside the API process, with PostgreSQL outbox rows as the durable work record.
It does not enable unfinished integrations. See [booking flow](booking-flow.md)
for the transaction and recovery boundaries.

## Operational conventions

Environment validation lives in each app's `config` folder. Backend credentials
never belong in `NEXT_PUBLIC_*` variables. Logs allowlist request path, request ID,
operation and other safe context; they exclude bodies, headers, query strings,
guest details, provider payloads and secrets. Correlation IDs are generated on the
server and returned in the response header and envelope.

Unit tests cover money, supplier mapping/transport, opaque search references,
booking transitions, guest validation and webhook application. Transactional
integration tests require a dedicated PostgreSQL test database. Tests and builds
do not constitute supplier/gateway certification. Before live operation, finish
the adapters, verify end-to-end sandbox scenarios, and provide monitoring and an
operator workflow for unresolved outbox and reconciliation records.

## Supplier references

- [Supplied TBO JSON Hotel API v2.1 reference](../apps/api/src/modules/tbo/API_REFERENCE.md)
- [Backend agent guide](../apps/api/AGENTS.md)
- [TBO public API specification portal](https://api.tbotechnology.in/AIS_APISpecification.aspx)
- [TBO certification and ambiguous-booking guidance](https://api.tbotechnology.in/AIS_Going-live-certification.aspx)
