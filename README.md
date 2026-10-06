# Hotel platform

A TypeScript hotel-booking scaffold built as a pnpm/Turborepo monorepo. Next.js handles the customer experience; one NestJS application owns authentication, supplier access, pricing, payments and durable booking workflows.

This is production-oriented **structure**, with working validation, persistence boundaries and failure handling. Live bookings are intentionally unavailable until the account-specific TBO contract and a real payment gateway are implemented and verified. There are no fake hotel results or successful payment simulations in the application.

## Stack

- Next.js 16.3.8 App Router, React 19, Tailwind 4, local shadcn/ui primitives
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

## Configuration and integration boundaries

Backend settings live in root `.env`; Next.js settings live in `apps/web/.env.local`. Both are ignored by Git. The two `.env.example` files document supported variables.

- **Clerk:** set the backend verification secret (or JWT public key), frontend publishable key and frontend server secret. Set explicit authorized frontend origins. Internal users are provisioned after session verification. Admin rights come from the database role, never editable profile fields.
- **TBO:** supply your assigned HTTPS base URL and credentials. Read [the integration notes](apps/api/src/modules/tbo/INTEGRATION.md) before enabling `TBO_READS_ENABLED`. Candidate REST read mappings require account-specific validation. Supplier booking, lookup and cancellation remain gated until a certified implementation replaces their explicit errors.
- **Payments:** `PAYMENT_PROVIDER=disabled` is the only shipped adapter. Add a gateway behind `PaymentProvider`, implement raw-body webhook verification, lookup and refund handling, and exercise the integration tests before enabling checkout. No payment credentials are invented.
- **Jobs:** `JOBS_ENABLED=false` by default. Enabling it starts the durable outbox publisher and BullMQ worker. Notifications, payment reconciliation and refund handlers currently report configuration-required errors, preserving pending work for intervention.
- **Prices:** the backend computes minor-unit totals and stores immutable quotes and booking snapshots. Currency conversion is not implemented. The six accepted currencies currently share two decimal places.

Destination search initially accepts the supplier's **city code**. Catalogue synchronization/autocomplete is an explicit extension point. The date-range picker checks dates and maximum stay; live inventory always comes from the supplier.

## Commands

| Command                             | Purpose                                                           |
| ----------------------------------- | ----------------------------------------------------------------- |
| `pnpm dev`                          | Generate Prisma and shared contracts, then run web and API        |
| `pnpm build`                        | Build shared contracts, API and web                               |
| `pnpm lint` / `pnpm lint:fix`       | Check/fix ESLint rules and import order                           |
| `pnpm typecheck`                    | Validate strict application and contract types                    |
| `pnpm test`                         | Run meaningful unit/contract/frontend tests without live services |
| `pnpm test:integration`             | Run transactional PostgreSQL tests on `TEST_DATABASE_URL`         |
| `pnpm format` / `pnpm format:check` | Write/check formatting                                            |
| `pnpm db:generate`                  | Regenerate Prisma Client                                          |
| `pnpm db:migrate`                   | Create a development migration after schema edits                 |
| `pnpm db:deploy`                    | Apply checked-in migrations                                       |
| `pnpm db:studio`                    | Open Prisma Studio                                                |
| `pnpm infra:up` / `pnpm infra:down` | Start/stop local infrastructure; preserve data volumes            |

For integration tests, the Compose initialization creates a separate `hotel_platform_test` database. Apply migrations to it and run:

```sh
pnpm --filter @hotel/api db:test:deploy
pnpm test:integration
```

Tests create uniquely identified fixtures and clean up only their records. They refuse to run unless an explicit test database URL is supplied. If using existing PostgreSQL volumes from another setup, create the dedicated test database separately.

Before submitting a change, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. For financial workflows, also run integration tests. See [development guidance](docs/development.md), [architecture](docs/architecture.md), [booking workflow](docs/booking-flow.md), and [agent rules](AGENTS.md).
