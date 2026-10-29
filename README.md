# Hotel platform

A TypeScript hotel-booking scaffold built as a pnpm/Turborepo monorepo. Next.js handles the customer experience; one NestJS application owns authentication, supplier access, pricing, payments and durable booking workflows.

This is production-oriented **structure**, with working validation, persistence boundaries and failure handling. Live bookings are intentionally unavailable until the account-specific TBO contract and a real payment gateway are implemented and verified. An explicit, read-only hotel preview provides fictional inventory for development; it never simulates a successful booking or payment.

See the [project blueprint](docs/project-blueprint.md) for the product vision, hotel-first launch scope, future flight plus hotel trips, and delivery gates.

## Stack

- Next.js 16.3.8 App Router, React 19, Tailwind 4, local shadcn/ui and Radix primitives, next-themes
- TanStack Query, React Hook Form, Zod and Clerk
- NestJS modular monolith, PostgreSQL, Prisma 6.19, Redis and BullMQ
- Strict TypeScript, ESLint, Prettier, Vitest and GitHub Actions

Prisma 6 and NestJS 11 are deliberate compatible stable-major choices. Dependency versions are recorded in `pnpm-lock.yaml`; update through reviewed changes.

## Start locally

Install Node.js 24, pnpm 11.9 and Docker with its daemon running. From the repository root:

```sh
pnpm install
```

Copy `.env.example` to `.env`, and `apps/web/.env.example` to `apps/web/.env.local`. The example PostgreSQL credentials are strictly for local containers. On PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item apps/web/.env.example apps/web/.env.local
```

On macOS/Linux use `cp` for the same two files. Then:

```sh
pnpm infra:up
pnpm db:generate
pnpm db:deploy
pnpm dev
```

Open the web app at [localhost:3000](http://localhost:3000). The API prefix is [localhost:4000/api/v1](http://localhost:4000/api/v1/health/live). `pnpm dev` starts both applications through Turbo. PostgreSQL and Redis bind to loopback ports **54329** and **63799**, avoiding standard local database ports.

Public pages build and render without Clerk or supplier credentials. Protected screens explain the missing authentication setup. The API requires PostgreSQL and Redis at startup; requests for an unconfigured external integration return a named error.

To explore realistic hotel results without supplier credentials, start PostgreSQL
with `pnpm infra:up`, run `pnpm db:prepare:mock`, then `pnpm dev:mock` and open
[the hotel preview](http://localhost:3000/hotels). The preview needs PostgreSQL;
Redis is not used by its read-only API.
This explicitly starts a separate read-only API composition, using the same hotel routes
and public response contracts. The repeatable seed stores 45 fictional hotels across
Dubai, London, Antalya and Bali in dedicated PostgreSQL tables, with rates for all
six supported currencies. Opening `/hotels` or submitting an empty search shows all
45 hotels without requiring a destination, dates or guest details. Optional criteria
and filters narrow the catalogue. Filters, sorting and pagination run in the API;
selections are shareable in the URL. Demo prices, reviews and photos are labelled, and booking is
disabled. Mock mode is rejected in production. See [hotel preview and search](docs/hotel-preview.md).

## Repository map

```text
apps/web/src/
  app/                 route composition, layouts and access boundaries
  features/            search, details, checkout, booking, account and authentication
  components/          shared layout and shadcn/ui primitives
  services/api/        one HTTP client and typed domain endpoints
  config/, providers/  validated settings, session and query providers
apps/api/
  prisma/              normalized schema and checked-in migration
  src/modules/         business domains and isolated provider implementations
  src/common/          transport validation, errors, guards and response envelopes
  src/database/        Prisma lifecycle
  src/infrastructure/  Redis and health endpoints
  src/jobs/            database outbox and BullMQ delivery
packages/contracts/    shared Zod API schemas and inferred types
packages/typescript-config/
packages/eslint-config/
docker/                local PostgreSQL and Redis
docs/                  architecture, booking workflow and development guidance
```

No separate UI package or generic configuration package exists yet: there is one frontend, and server secrets must remain server-only.

## Frontend design and themes

The Best Holiday Packages homepage uses the supplied company logo, a charcoal theme with a `#00A7E1` blue accent, a responsive travel layout, local destination photography, and shared shadcn-style Radix primitives. The appearance menu supports light, dark, and system themes with a persistent browser preference. Semantic colors live centrally in `apps/web/src/styles/globals.css`; feature layouts use CSS Modules. See [theming and frontend design](docs/theming.md) for customization and [image sources](docs/image-sources.md) for logo and photography credits.

Destination cards are editorial inspiration, not live hotel offers. Saved inspiration lasts only for the current homepage visit and is not saved to an account. The homepage hotel form accepts country, city and hotel names, with database-backed suggestions. Names ignore capitalization and accents; Turkey and Türkiye resolve to the same country. Opening `/hotels` or searching without dates browses real TBO hotel content without prices. Adding complete stay criteria requests supplier availability; the backend remains authoritative for inventory, prices, and booking outcomes.

## Frontend-only booking UI demo

Open `/preview/hotels` for the reference-inspired destination and guest dropdowns,
hotel room selection, and extras/passengers/payment screens. This separate demo
uses local fixtures and photos and runs with just `pnpm --filter @hotel/web dev`.
It never creates bookings or processes payments. See [the UI preview guide](docs/ui-booking-preview.md).
The homepage hotel tab uses the live search form. The separate hotel-plus-flight
tab is explicitly labelled as a demo and continues to use preview inventory.

## Configuration and integration boundaries

The header currency and language selectors save browser preferences. Currency
changes request backend search prices in one of the six supported currencies.
All 45 language options cover the site's homepage editorial content, navigation,
search, hotel results, account, checkout and booking pages, validation messages,
and booking/payment status labels. Dates and prices use the selected locale;
Arabic and Hebrew use right-to-left layouts. Supplier-provided descriptions and
external provider screens follow the language available from those providers. See
[selector behavior](docs/theming.md#currency-and-language-selectors).

Backend settings live in root `.env`; Next.js settings live in `apps/web/.env.local`. Both are ignored by Git. The two `.env.example` files document supported variables.

On this Windows checkout, run `.\Start-HotelApp.ps1` from a normal,
**non-Administrator PowerShell** to finish local setup. The launcher uses
[localhost:3001](http://localhost:3001) for this frontend and
[localhost:4001/api/v1](http://localhost:4001/api/v1/health/ready) for its API,
leaving port 3000 available for LedgerBook. It sets the matching frontend API URL
and API CORS origin for its child processes without changing your environment
files. Use `-WebPort 3002 -ApiPort 4002` to choose other ports. Both application
listeners bind to loopback, and occupied ports fail explicitly.

The launcher checks local dependencies, builds the API, applies application
migrations, then starts the API and frontend. Add `-VerifyIntegrations` to also
apply dedicated test migrations, run integration tests and supplier read-schema
verification, and synchronize destinations when supplier reads are configured.
Add `-EnableTboReads` to verify the supplied account, synchronize its directory,
and enable hotel reads for the launched processes only. Verification must succeed
before reads are enabled; `.env` and booking/payment gates remain unchanged.
Stop the existing API and frontend, then run in normal PowerShell:

```powershell
.\Start-HotelApp.ps1 -EnableTboReads
```

Then open [localhost:3001/hotels](http://localhost:3001/hotels). Next.js permits
one development process per checkout even when ports differ. The launcher reuses
the generated Prisma client when its schema and version already match.
An unfiltered browse imports every supplier country and city in the background,
with paginated results and visible progress. A country search narrows that import
to the selected country. Complete worldwide loading can take time; existing
supplier hotel content remains browsable during synchronization.
Local startup does not require supplier connectivity or credentials when reads
are disabled. It stops on failed checks, never resets a database, and preserves
the configured supplier read gate. It makes no administrator or Windows
security-policy changes. A `WSAEACCES/10013` socket error means the command runner
denies local network access; run the launcher in an ordinary PowerShell outside
that runner. Changing HTTP, CORS, or browser certificate settings cannot fix that
process restriction. Docker Desktop must be able to start for Redis.
PostgreSQL refuses elevated execution; the launcher checks this before setup.
Setup stages are recorded in `test-results/local-run-*/setup-status.log` so a
failed run can be diagnosed even before the application processes start.

- **Clerk:** set the backend verification secret (or JWT public key), frontend publishable key and frontend server secret. Set explicit authorized frontend origins. Internal users are provisioned after session verification. Admin rights come from the database role, never editable profile fields.
- **TBO:** hotel search, hotel details and PreBook price rechecks implement the supplied JSON v2.1 guide, documented in the [TBO API reference](apps/api/src/modules/tbo/API_REFERENCE.md) and [backend agent guide](apps/api/AGENTS.md). The backend validates supplier identities/currency, preserves cancellation policies and rate terms, and enforces minimum selling prices. Reads remain disabled by default; synthetic fixtures do not replace account sandbox verification. Supply your assigned HTTPS base URL and credentials, and read [the integration notes](apps/api/src/modules/tbo/INTEGRATION.md) before enabling `TBO_READS_ENABLED`. Customer-facing presentation of the new terms is still required before sales. Supplier booking, lookup and cancellation remain explicitly disabled.
- **Payments:** `PAYMENT_PROVIDER=disabled` is the only shipped adapter. Add a gateway behind `PaymentProvider`, implement raw-body webhook verification, lookup and refund handling, and exercise the integration tests before enabling checkout. No payment credentials are invented.
- **Jobs:** `JOBS_ENABLED=false` by default. Enabling it starts the durable outbox publisher and BullMQ worker. Notifications, payment reconciliation and refund handlers currently report configuration-required errors, preserving pending work for intervention.
- **Prices:** the backend computes minor-unit totals and stores immutable quotes and booking snapshots. Currency conversion is not implemented. The six accepted currencies currently share two decimal places.

Live search resolves names through an indexed PostgreSQL TBO catalogue, with debounced country/city/hotel suggestions. The public catalogue endpoint supports paginated browsing without dates, guest nationality or invented rates. Country browsing warms its supplier cities with bounded concurrency; the UI polls while synchronization is pending and reports supplier failures. Country/city content refreshes separately from availability. Static hotel content is cached for 24 hours by default, suggestions for five minutes, and complete priced availability for 30 seconds. Filters and pagination reuse the same rate references without extending their expiry. See [live hotel search](docs/live-hotel-search.md) for synchronization, configuration and verification. The preview retains its separate fictional inventory.

The supplied staging credentials are configured only in the ignored backend environment. Verification attempts on 28 and 29 October 2026 were blocked by this execution environment's DNS restrictions (`ENOTFOUND` for `api.tbotechnology.in`); real response shapes, account currency and pricing semantics remain unverified. Reads remain gated until the documented verification succeeds. `pnpm --filter @hotel/api tbo:verify` checks the account's country/city catalogue, hotel content, availability and PreBook schemas using only safe reads, and prints allowlisted counts/statuses. It does not enable sales or modify the running app's configuration.

## Commands

| Command                             | Purpose                                                                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                          | Generate Prisma and shared contracts, then run web and API                                                                          |
| `pnpm dev:mock`                     | Run web plus read-only hotel API backed by seeded PostgreSQL                                                                        |
| `pnpm build`                        | Build shared contracts, API and web                                                                                                 |
| `pnpm lint` / `pnpm lint:fix`       | Check/fix ESLint rules and import order                                                                                             |
| `pnpm typecheck`                    | Validate strict application and contract types                                                                                      |
| `pnpm test`                         | Run meaningful unit/contract/frontend tests without live services                                                                   |
| `pnpm test:integration`             | Run transactional PostgreSQL tests on `TEST_DATABASE_URL`                                                                           |
| `pnpm test:e2e`                     | Check real hotel browsing/search in an installed browser; see [setup](docs/live-hotel-search.md#repeatable-live-browser-acceptance) |
| `pnpm format` / `pnpm format:check` | Write/check formatting                                                                                                              |
| `pnpm db:generate`                  | Regenerate Prisma Client                                                                                                            |
| `pnpm db:migrate`                   | Create a development migration after schema edits                                                                                   |
| `pnpm db:deploy`                    | Apply checked-in migrations                                                                                                         |
| `pnpm db:prepare:mock`              | Generate clients, build contracts, migrate and seed local preview                                                                   |
| `pnpm db:seed:mock`                 | Repeat the local preview seed without duplicating records                                                                           |
| `pnpm db:studio`                    | Open Prisma Studio                                                                                                                  |
| `pnpm infra:up` / `pnpm infra:down` | Start/stop local infrastructure; preserve data volumes                                                                              |

For integration tests, the Compose initialization creates a separate `hotel_platform_test` database. Apply migrations to it and run:

```sh
pnpm --filter @hotel/api db:test:deploy
pnpm test:integration
```

Tests create uniquely identified fixtures and clean up only their records. They refuse to run unless an explicit test database URL is supplied. If using existing PostgreSQL volumes from another setup, create the dedicated test database separately.

Before submitting a change, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. For financial workflows, also run integration tests. See [development guidance](docs/development.md), [architecture](docs/architecture.md), [booking workflow](docs/booking-flow.md), and [agent rules](AGENTS.md).
